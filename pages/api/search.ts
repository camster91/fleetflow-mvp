import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { requireTenantContext } from '../../lib/apiAuth'
import { canViewBusinessData } from '../../lib/permissions'
import { rateLimitMiddleware } from '../../lib/rateLimit'
import { parseSearchTerm } from '../../lib/readQuery'

const emptyResults = {
  vehicles: [],
  deliveries: [],
  clients: [],
  maintenance: [],
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `search:${session.user.id}`))) return

  const parsed = parseSearchTerm(req.query.q)
  if (!parsed.ok) return res.status(400).json({ error: parsed.error })
  if (!parsed.value) {
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json(emptyResults)
  }
  const q = parsed.value

  try {
    const [vehicles, deliveries, clients, maintenance] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          AND: [
            tenant.resourceWhere,
            { OR: [{ name: { contains: q } }, { driver: { contains: q } }, { location: { contains: q } }] },
          ],
        },
        select: { id: true, name: true, driver: true, status: true, location: true },
        take: 5,
      }),
      prisma.delivery.findMany({
        where: {
          AND: [
            tenant.resourceWhere,
            { OR: [{ customer: { contains: q } }, { address: { contains: q } }, { driver: { contains: q } }] },
          ],
        },
        select: { id: true, customer: true, address: true, status: true, driver: true },
        take: 5,
      }),
      prisma.client.findMany({
        where: {
          AND: [
            tenant.resourceWhere,
            {
              OR: [
                { name: { contains: q } },
                { address: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            },
          ],
        },
        select: { id: true, name: true, address: true, type: true },
        take: 5,
      }),
      prisma.maintenanceTask.findMany({
        where: { AND: [tenant.resourceWhere, { OR: [{ vehicleName: { contains: q } }, { type: { contains: q } }] }] },
        select: { id: true, vehicleName: true, type: true, dueDate: true, completed: true },
        take: 5,
      }),
    ])
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({ vehicles, deliveries, clients, maintenance })
  } catch {
    return res.status(500).json({ error: 'Search failed' })
  }
}
