import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../../lib/fleet'
import { createNotification } from '../../../../lib/notifications'
import { notifyDeliveryAssigned, notifyDeliveryStatus } from '../../../../lib/email.server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const delivery = await prisma.delivery.findFirst({ where: { id, ownerId: userId } })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'PUT') {
    const existing = await prisma.delivery.findFirst({ where: { id, ownerId: userId } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { ownerId: _o, ...fields } = deliveryToDb(req.body, userId) as any
    const wasCompleted = req.body.status === 'delivered' && existing.status !== 'delivered'

    const delivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id, ownerId: userId }, data: fields })
      await logActivity(tx, {
        userId, userName: session.user.name, userRole: (session.user as any).role,
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
      const driverUser = await prisma.user.findFirst({ where: { name: delivery.driver } })
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
    const delivery = await prisma.delivery.findFirst({ where: { id, ownerId: userId } })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    await prisma.delivery.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'delivery', entityId: id, entityName: delivery.customer,
      description: `Delivery for "${delivery.customer}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
