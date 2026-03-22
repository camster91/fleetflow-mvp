import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }

  const delivery = await prisma.delivery.findUnique({ where: { id } })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const events = await prisma.deliveryEvent.findMany({
    where: { deliveryId: id },
    orderBy: { timestamp: 'asc' },
  })

  return res.json(events)
}
