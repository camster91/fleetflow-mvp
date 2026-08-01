import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'
import { createNotification } from '../../../lib/notifications'
import { notifyDeliveryAssigned } from '../../../lib/email.server'
import { parseBody, deliveryBodySchema } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [deliveries, total] = await Promise.all([
      prisma.delivery.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.delivery.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: deliveries.map(dbToDelivery), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    const parsed = parseBody(deliveryBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const data = deliveryToDb({ ...req.body, ...parsed.data }, userId)
    const delivery = await prisma.delivery.create({ data })
    await logActivity(prisma, {
      userId,
      userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'delivery',
      entityId: delivery.id, entityName: delivery.customer,
      description: `Delivery for "${delivery.customer}" was created`,
    })
    if (delivery.driver) {
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

    return res.status(201).json(dbToDelivery(delivery))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
