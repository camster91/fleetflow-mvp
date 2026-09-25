import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'
import type { Delivery } from '../../../lib/fleet'
import { createNotification } from '../../../lib/notifications'
import { notifyDeliveryAssigned } from '../../../lib/email.server'
import { deliveryCreateSchema, invalidDeliveryFields } from '../../../lib/deliveryTransitions'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canAssignDrivers, canManageDeliveries, canViewDeliveries } from '../../../lib/permissions'
import { resolveDriverAssignment } from '../../../lib/driverAssignment'
import { assignedResourceWhere, driverDeliveryDto, isDriverRole } from '../../../lib/driverScope'
import { beginIdempotentRequest } from '../../../lib/idempotency'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const where=assignedResourceWhere(tenant.resourceWhere,tenant.role,userId)
    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
      prisma.delivery.count({ where }),
    ])
    return res.json({ data: deliveries.map(item=>isDriverRole(tenant.role)?driverDeliveryDto(item):dbToDelivery(item)), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const idempotency = await beginIdempotentRequest(req, res, { tenant, userId, route: 'POST /api/deliveries' })
    if (!idempotency.proceed) return
    const parsed = deliveryCreateSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid delivery', fields: invalidDeliveryFields(parsed.error) })
    // Only validated fields reach the database; the driver name is derived from the assignment.
    const { driver: _driver, ...body } = parsed.data
    if (Object.prototype.hasOwnProperty.call(body, 'assignedDriverId') && !canAssignDrivers(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    let assignment
    try { assignment = await resolveDriverAssignment(prisma, tenant, body.assignedDriverId) } catch { return res.status(400).json({ error: 'Invalid driver assignment' }) }
    const mapped = deliveryToDb({ ...body, driver: assignment.driver } as Omit<Delivery, 'id'>, tenant.ownerId)
    const data = { ...mapped, ...assignment, ownerId: tenant.ownerId, teamId: tenant.teamId }
    const delivery = await prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({ data })
      await logActivity(tx, {
        userId,
        teamId: tenant.teamId,
        userName: session.user.name, userRole: tenant.role,
        action: 'created', entityType: 'delivery',
        entityId: created.id, entityName: created.customer,
        description: `Delivery for "${created.customer}" was created`,
      })
      await idempotency.store(tx, 201, dbToDelivery(created))
      return created
    }).catch(idempotency.replayOnConflict)
    if (!delivery) return
    // The delivery is already committed. Notifications are best-effort so a
    // failure here never turns into a 500 that prompts a duplicate retry.
    if (delivery.assignedDriverId) {
      try {
        const driverUser = await prisma.user.findFirst({
          where: {
            id: delivery.assignedDriverId,
          },
        })
        if (driverUser) {
          await createNotification({
            userId: driverUser.id,
            type: 'SYSTEM',
            title: 'New Delivery Assignment',
            message: `You have been assigned a delivery for "${delivery.customer}"`,
            data: { deliveryId: delivery.id, customer: delivery.customer },
          })
          if (driverUser.email) {
            notifyDeliveryAssigned(
              delivery,
              driverUser.name || delivery.driver || 'Unknown driver',
              driverUser.email,
              session.user.name || 'Manager',
            ).catch(console.error)
          }
        }
      } catch (error) {
        console.error('Delivery assignment notification failed', error)
      }
    }

    return res.status(201).json(dbToDelivery(delivery))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
