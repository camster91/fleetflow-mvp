import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewDeliveries } from '../../../lib/permissions'
import { isDriverRole } from '../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant,session } = context
  if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)

  const interval = setInterval(async () => {
    try {
      const deliveries = await prisma.delivery.findMany({
        where: { AND: [tenant.resourceWhere, { status: { in: ['pending', 'picked-up', 'in-transit'] } }, ...(isDriverRole(tenant.role)?[{assignedDriverId:session.user.id}]:[])] },
        include: {
          events: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
        take: 200,
        orderBy: { updatedAt: 'desc' },
      })

      const data = deliveries.map((d) => ({
        id: d.id,
        customer: d.customer,
        status: d.status,
        progress: d.progress,
        lastEvent: d.events[0]?{id:d.events[0].id,status:d.events[0].status,timestamp:d.events[0].timestamp}:null,
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
