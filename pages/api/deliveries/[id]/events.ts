import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { requireTenantContext } from '../../../../lib/apiAuth'
import { canViewDeliveries } from '../../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant } = context
  if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query as { id: string }
  const delivery = await prisma.delivery.findFirst({ where: { AND: [{ id }, tenant.resourceWhere] } })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const events = await prisma.deliveryEvent.findMany({
    where: { deliveryId: id },
    orderBy: { timestamp: 'asc' },
    take: 500,
  })

  return res.json(events)
}
