import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, logActivity } from '../../../../lib/fleet'
import { requireSession, assertSameOrigin } from '../../../../lib/apiAuth'

const VALID_STATUSES = ['pending', 'picked-up', 'in-transit', 'delivered', 'failed', 'cancelled']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const session = await requireSession(req, res)
  if (!session) return
  if (!assertSameOrigin(req, res)) return

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const { status, notes, latitude, longitude } = req.body || {}

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  // Owner-scoped lookup prevents cross-tenant status mutation (IDOR)
  const delivery = await prisma.delivery.findFirst({ where: { id, ownerId: userId } })
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
        notes: typeof notes === 'string' ? notes.slice(0, 2000) : null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        createdBy: userId,
      },
    })

    await logActivity(tx, {
      userId,
      userName: session.user.name,
      userRole: session.user.role,
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
