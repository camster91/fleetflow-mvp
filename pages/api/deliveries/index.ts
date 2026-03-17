import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const deliveries = await prisma.delivery.findMany({ orderBy: { createdAt: 'desc' } })
    return res.json(deliveries.map(dbToDelivery))
  }

  if (req.method === 'POST') {
    const data = deliveryToDb(req.body, (session.user as any).id)
    const delivery = await prisma.delivery.create({ data })
    await logActivity(prisma, {
      userId: (session.user as any).id,
      userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'delivery',
      entityId: delivery.id, entityName: delivery.customer,
      description: `Delivery for "${delivery.customer}" was created`,
    })
    return res.status(201).json(dbToDelivery(delivery))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
