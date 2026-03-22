import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const userId = (session.user as any).id

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

  const interval = setInterval(async () => {
    try {
      const deliveries = await prisma.delivery.findMany({
        where: {
          ownerId: userId,
          status: { in: ['pending', 'picked-up', 'in-transit'] },
        },
        include: {
          events: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      })

      const data = deliveries.map((d) => ({
        id: d.id,
        customer: d.customer,
        status: d.status,
        progress: d.progress,
        lastEvent: d.events[0] || null,
        updatedAt: d.updatedAt.toISOString(),
      }))

      res.write(`data: ${JSON.stringify({ type: 'update', deliveries: data })}\n\n`)
    } catch {
      // Connection may have closed
    }
  }, 30000)

  req.on('close', () => {
    clearInterval(interval)
    res.end()
  })
}
