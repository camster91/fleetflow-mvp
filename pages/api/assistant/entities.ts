import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { requireTenantContext } from '@/lib/apiAuth'
import { canViewBusinessData } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'

const querySchema = z.object({ type: z.enum(['vehicle', 'client']), q: z.string().trim().max(100).optional().default('') })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const context = await requireTenantContext(req, res); if (!context) return
  if (!canViewBusinessData(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  if (!await rateLimitMiddleware(req, res, 'api', `assistant-entities:${context.session.user.id}`)) return
  const parsed = querySchema.safeParse({ type: Array.isArray(req.query.type) ? req.query.type[0] : req.query.type, q: Array.isArray(req.query.q) ? req.query.q[0] : req.query.q })
  if (!parsed.success) return res.status(400).json({ error: 'Invalid selector query' })
  try {
    if (parsed.data.type === 'vehicle') {
      const rows = await prisma.vehicle.findMany({ where: parsed.data.q ? { AND: [context.tenant.resourceWhere, { name: { contains: parsed.data.q, mode: 'insensitive' } }] } : context.tenant.resourceWhere, select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 20 })
      return res.status(200).json({ entities: rows.map(row => ({ id: row.id, label: row.name.slice(0, 120) })) })
    }
    const rows = await prisma.client.findMany({ where: parsed.data.q ? { AND: [context.tenant.resourceWhere, { OR: [{ businessName: { contains: parsed.data.q, mode: 'insensitive' } }, { name: { contains: parsed.data.q, mode: 'insensitive' } }] }] } : context.tenant.resourceWhere, select: { id: true, name: true, businessName: true }, orderBy: [{ businessName: 'asc' }, { name: 'asc' }, { id: 'asc' }], take: 20 })
    return res.status(200).json({ entities: rows.map(row => ({ id: row.id, label: (row.businessName || row.name).slice(0, 120) })) })
  } catch { console.error('Assistant selector failed'); return res.status(503).json({ error: 'Records could not be loaded' }) }
}
