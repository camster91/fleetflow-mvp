import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'
import { createNotification } from '../../../lib/notifications'
import { notifyDeliveryAssigned } from '../../../lib/email.server'
import { parseBody, deliveryBodySchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canAssignDrivers, canManageDeliveries, canViewDeliveries } from '../../../lib/permissions'
import { resolveDriverAssignment } from '../../../lib/driverAssignment'
import { assignedResourceWhere, driverDeliveryDto, isDriverRole } from '../../../lib/driverScope'

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
    const parsed = parseBody(deliveryBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedDriverId') && !canAssignDrivers(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    let assignment
    try { assignment = await resolveDriverAssignment(prisma, tenant, parsed.data.assignedDriverId) } catch { return res.status(400).json({ error: 'Invalid driver assignment' }) }
    const mapped = deliveryToDb({ ...req.body, ...parsed.data, driver: assignment.driver }, tenant.ownerId)
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
      return created
    })
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
