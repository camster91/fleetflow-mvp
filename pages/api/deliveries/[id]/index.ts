import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../../lib/fleet'
import { createNotification } from '../../../../lib/notifications'
import { notifyDeliveryAssigned, notifyDeliveryStatus } from '../../../../lib/email.server'
import { requireTenantContext } from '../../../../lib/apiAuth'
import { canManageDeliveries, canViewDeliveries } from '../../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'GET') {
    if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const delivery = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'PUT') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const existing = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { ownerId: _ownerId, ...fields } = deliveryToDb(req.body, tenant.ownerId)
    const wasCompleted = req.body.status === 'delivered' && existing.status !== 'delivered'

    const delivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data: fields })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: wasCompleted ? 'completed' : 'status_changed',
        entityType: 'delivery', entityId: id, entityName: updated.customer,
        description: wasCompleted
          ? `Delivery for "${updated.customer}" was marked as delivered`
          : `Delivery for "${updated.customer}" status changed to ${updated.status}`,
      })
      return updated
    })
    // Notify driver if newly assigned
    const driverChanged = delivery.driver && delivery.driver !== existing.driver
    if (driverChanged) {
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

    // Notify owner when delivery is completed
    if (wasCompleted) {
      await createNotification({
        userId: existing.ownerId,
        type: 'SYSTEM',
        title: 'Delivery Completed',
        message: `Delivery for "${delivery.customer}" has been marked as delivered`,
        data: { deliveryId: delivery.id, customer: delivery.customer },
      })
      const owner = await prisma.user.findUnique({ where: { id: existing.ownerId } })
      if (owner?.email) {
        notifyDeliveryStatus(delivery, [owner.email], 'admin').catch(console.error)
      }
    }

    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'DELETE') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const delivery = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    await prisma.delivery.delete({ where: { id } })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'deleted', entityType: 'delivery', entityId: id, entityName: delivery.customer,
      description: `Delivery for "${delivery.customer}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
