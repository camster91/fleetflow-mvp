import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireSession } from '../../../../lib/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await requireSession(req, res)
  if (!session) return

  const { id } = req.query as { id: string }
  const userId = session.user.id

  // Owner-scoped lookup prevents cross-tenant event enumeration (IDOR)
  const delivery = await prisma.delivery.findFirst({ where: { id, ownerId: userId } })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const events = await prisma.deliveryEvent.findMany({
    where: { deliveryId: id },
    orderBy: { timestamp: 'asc' },
    take: 500,
  })

  return res.json(events)
}
