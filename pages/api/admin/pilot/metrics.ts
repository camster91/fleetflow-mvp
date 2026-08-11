import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { canManageSettings } from '@/lib/permissions'
import { pilotScopeKey } from '@/lib/pilot'

const WEEK = 7 * 86_400_000
const median = (values: number[]) => values.length ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)] : null

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const context = await requireTenantContext(req, res); if (!context) return
  if (!canManageSettings(context.tenant.role)) return res.status(403).json({ error: 'Administrator access required' })
  if (!await rateLimitMiddleware(req, res, 'admin', `pilot-metrics:${context.session.user.id}`)) return
  const scopeKey = pilotScopeKey(context.tenant.ownerId, context.tenant.teamId), now = new Date(), since = new Date(now.getTime() - 4 * WEEK)
  const [enrollment, events, incidents, members] = await Promise.all([
    prisma.pilotEnrollment.findUnique({ where: { scopeKey }, select: { status: true, pilotStartsAt: true, pilotEndsAt: true, consentedAt: true, supportOwnerLabel: true } }),
    prisma.pilotEvent.findMany({ where: { scopeKey, occurredAt: { gte: since } }, select: { actorId: true, sessionKey: true, eventType: true, occurredAt: true }, orderBy: { occurredAt: 'asc' }, take: 5000 }),
    prisma.pilotIncident.groupBy({ by: ['severity', 'status'], where: { scopeKey, occurredAt: { gte: since } }, _count: { _all: true } }),
    context.tenant.teamId ? prisma.teamMember.count({ where: { teamId: context.tenant.teamId, status: 'ACCEPTED' } }) : Promise.resolve(1),
  ])
  const weekly = Array.from({ length: 4 }, (_, index) => { const start = new Date(now.getTime() - (4 - index) * WEEK), end = new Date(start.getTime() + WEEK); const actors = new Set(events.filter(event => event.occurredAt >= start && event.occurredAt < end).map(event => event.actorId)); return { startsAt: start.toISOString(), activeOperators: actors.size, adoptionRate: members ? Number((actors.size / members).toFixed(4)) : 0 } })
  const firstBySession = new Map<string, Date>(), times: number[] = []
  for (const event of events) { const key = `${event.actorId}:${event.sessionKey}`; if (event.eventType === 'DASHBOARD_OPENED' && !firstBySession.has(key)) firstBySession.set(key, event.occurredAt); if (event.eventType === 'FIRST_USEFUL_ACTION') { const started = firstBySession.get(key); if (started && event.occurredAt >= started) times.push(event.occurredAt.getTime() - started.getTime()) } }
  return res.status(200).json({ enrollment: enrollment ? { ...enrollment, pilotStartsAt: enrollment.pilotStartsAt?.toISOString() ?? null, pilotEndsAt: enrollment.pilotEndsAt?.toISOString() ?? null, consentedAt: enrollment.consentedAt?.toISOString() ?? null } : null, members, weekly, signals: { dashboardOpens: events.filter(event => event.eventType === 'DASHBOARD_OPENED').length, firstUsefulActions: events.filter(event => event.eventType === 'FIRST_USEFUL_ACTION').length, medianTimeToFirstUsefulActionMs: median(times) }, incidents: incidents.map(item => ({ severity: item.severity, status: item.status, count: item._count._all })), window: { startsAt: since.toISOString(), endsAt: now.toISOString() } })
}
