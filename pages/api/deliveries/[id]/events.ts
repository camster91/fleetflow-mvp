import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireTenantContext } from '../../../../lib/apiAuth'
import { canViewDeliveries } from '../../../../lib/permissions'
import { isDriverRole } from '../../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query as { id: string }
  const delivery = await prisma.delivery.findFirst({
    where: {
      AND: [
        { id },
        tenant.resourceWhere,
        ...(isDriverRole(tenant.role) ? [{ assignedDriverId: session.user.id }] : []),
      ],
    },
  })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const events = await prisma.deliveryEvent.findMany({
    where: { deliveryId: id },
    orderBy: { timestamp: 'asc' },
    take: 500,
  })

  return res.json(
    isDriverRole(tenant.role)
      ? events.map((event) => ({
          id: event.id,
          status: event.status,
          timestamp: event.timestamp,
          latitude: event.latitude,
          longitude: event.longitude,
        }))
      : events
  )
}
