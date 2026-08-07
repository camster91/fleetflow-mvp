import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'
import { createNotification } from '../../../lib/notifications'
import { notifyDeliveryAssigned } from '../../../lib/email.server'
import { parseBody, deliveryBodySchema } from '../../../lib/validation'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageDeliveries, canViewDeliveries } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({ where: tenant.resourceWhere, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.delivery.count({ where: tenant.resourceWhere }),
    ])
    return res.json({ data: deliveries.map(dbToDelivery), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseBody(deliveryBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const mapped = deliveryToDb({ ...req.body, ...parsed.data }, tenant.ownerId)
    const data = { ...mapped, ownerId: tenant.ownerId, teamId: tenant.teamId }
    const delivery = await prisma.delivery.create({ data })
    await logActivity(prisma, {
      userId,
      teamId: tenant.teamId,
      userName: session.user.name, userRole: tenant.role,
      action: 'created', entityType: 'delivery',
      entityId: delivery.id, entityName: delivery.customer,
      description: `Delivery for "${delivery.customer}" was created`,
    })
    if (delivery.driver) {
      const driverUser = await prisma.user.findFirst({
        where: {
          name: delivery.driver,
          ...(tenant.teamId
            ? { OR: [
                { id: tenant.ownerId },
                { teamMemberships: { some: { teamId: tenant.teamId, status: 'ACCEPTED' } } },
              ] }
            : { id: tenant.ownerId }),
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
    }

    return res.status(201).json(dbToDelivery(delivery))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
