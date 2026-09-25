import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { canManageSettings } from '@/lib/permissions'
import { incidentSchema, pilotExpiry, pilotScopeKey } from '@/lib/pilot'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method === 'POST' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canManageSettings(context.tenant.role)) return res.status(403).json({ error: 'Administrator access required' })
  if (!(await rateLimitMiddleware(req, res, 'admin', `pilot-incidents:${context.session.user.id}`))) return
  const scopeKey = pilotScopeKey(context.tenant.ownerId, context.tenant.teamId)
  if (req.method === 'GET') {
    const incidents = await prisma.pilotIncident.findMany({
      where: { scopeKey },
      select: { id: true, severity: true, category: true, status: true, occurredAt: true, resolvedAt: true },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    })
    return res.status(200).json({
      incidents: incidents.map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
    })
  }
  const parsed = incidentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pilot incident' })
  const incident = await prisma.$transaction(async (tx) => {
    const row = await tx.pilotIncident.create({
      data: {
        scopeKey,
        ownerId: context.tenant.ownerId,
        teamId: context.tenant.teamId,
        ...parsed.data,
        createdById: context.session.user.id,
        expiresAt: pilotExpiry(),
      },
    })
    await tx.auditLog.create({
      data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name ?? null,
        userRole: context.tenant.role,
        action: 'PILOT_INCIDENT_RECORDED',
        entityType: 'pilot_incident',
        entityId: row.id,
        description: 'Recorded structured pilot incident',
        metadata: JSON.stringify({ severity: row.severity, category: row.category }),
      },
    })
    return row
  })
  return res.status(201).json({
    incident: {
      id: incident.id,
      severity: incident.severity,
      category: incident.category,
      status: incident.status,
      occurredAt: incident.occurredAt.toISOString(),
    },
  })
}
