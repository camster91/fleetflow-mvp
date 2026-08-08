import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireTenantContext } from '@/lib/apiAuth'
import { canViewBusinessData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'

const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const context = await requireTenantContext(req, res); if (!context) return
  if (!canViewBusinessData(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  if (!await rateLimitMiddleware(req, res, 'api', `assistant-cost-source:${context.session.user.id}`)) return
  const parsed = idSchema.safeParse(Array.isArray(req.query.vehicle) ? req.query.vehicle[0] : req.query.vehicle)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid vehicle' })
  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { AND: [context.tenant.resourceWhere, { id: parsed.data }] }, select: { id: true } })
    if (!vehicle) return res.status(404).json({ error: 'Source unavailable' })
    const where = { AND: [context.tenant.resourceWhere, { vehicleId: vehicle.id, actualCost: { not: null as null } }] }
    const [aggregate, contributors] = await Promise.all([
      prisma.maintenanceTask.aggregate({ where, _sum: { actualCost: true }, _count: { _all: true } }),
      prisma.maintenanceTask.findMany({ where, select: { id: true, actualCost: true }, orderBy: [{ actualCost: 'desc' }, { id: 'asc' }], take: 20 }),
    ])
    const count = aggregate._count._all
    return res.status(200).json({ vehicleId: vehicle.id, total: aggregate._sum.actualCost ?? 0, count, contributors: contributors.map(item => ({ id: item.id, actualCost: item.actualCost, href: `/maintenance?record=${encodeURIComponent(item.id)}` })), contributorsTruncated: count > contributors.length })
  } catch { console.error('Maintenance cost source failed'); return res.status(503).json({ error: 'Source could not be loaded' }) }
}
