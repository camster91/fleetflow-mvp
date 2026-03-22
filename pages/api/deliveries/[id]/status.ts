import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, logActivity } from '../../../../lib/fleet'

const VALID_STATUSES = ['pending', 'picked-up', 'in-transit', 'delivered', 'failed', 'cancelled']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id
  const { status, notes, latitude, longitude } = req.body

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const delivery = await prisma.delivery.findUnique({ where: { id } })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDelivery = await tx.delivery.update({
      where: { id },
      data: {
        status,
        progress: status === 'delivered' ? 100 : status === 'in-transit' ? 50 : status === 'picked-up' ? 25 : delivery.progress,
        completedTime: status === 'delivered' ? new Date() : delivery.completedTime,
      },
    })

    await tx.deliveryEvent.create({
      data: {
        deliveryId: id,
        status,
        notes: notes || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        createdBy: userId,
      },
    })

    await logActivity(tx, {
      userId,
      userName: session.user.name,
      userRole: (session.user as any).role,
      action: status === 'delivered' ? 'completed' : 'status_changed',
      entityType: 'delivery',
      entityId: id,
      entityName: updatedDelivery.customer,
      description: `Delivery for "${updatedDelivery.customer}" status changed to ${status}`,
    })

    return updatedDelivery
  })

  return res.json(dbToDelivery(updated))
}
