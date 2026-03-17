import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'PUT') {
    const existing = await prisma.delivery.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { ownerId: _o, ...fields } = deliveryToDb(req.body, userId) as any
    const delivery = await prisma.delivery.update({ where: { id }, data: fields })
    const wasCompleted = req.body.status === 'delivered' && existing.status !== 'delivered'
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: wasCompleted ? 'completed' : 'status_changed',
      entityType: 'delivery', entityId: id, entityName: delivery.customer,
      description: wasCompleted
        ? `Delivery for "${delivery.customer}" was marked as delivered`
        : `Delivery for "${delivery.customer}" status changed to ${delivery.status}`,
    })
    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'DELETE') {
    const delivery = await prisma.delivery.findUnique({ where: { id } })
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
