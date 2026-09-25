import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { pilotEventSchema, pilotExpiry, pilotScopeKey } from '@/lib/pilot'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!(await rateLimitMiddleware(req, res, 'api', `pilot-event:${context.session.user.id}`))) return
  const parsed = pilotEventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pilot event' })
  const scopeKey = pilotScopeKey(context.tenant.ownerId, context.tenant.teamId)
  const enrollment = await prisma.pilotEnrollment.findUnique({
    where: { scopeKey },
    select: { status: true, pilotEndsAt: true },
  })
  if (!enrollment || enrollment.status !== 'ACTIVE' || (enrollment.pilotEndsAt && enrollment.pilotEndsAt <= new Date()))
    return res.status(409).json({ error: 'This workspace is not in an active pilot' })
  await prisma.pilotEvent.upsert({
    where: {
      scopeKey_actorId_sessionKey_eventType: {
        scopeKey,
        actorId: context.session.user.id,
        sessionKey: parsed.data.sessionKey,
        eventType: parsed.data.eventType,
      },
    },
    create: {
      scopeKey,
      ownerId: context.tenant.ownerId,
      teamId: context.tenant.teamId,
      actorId: context.session.user.id,
      sessionKey: parsed.data.sessionKey,
      eventType: parsed.data.eventType,
      expiresAt: pilotExpiry(),
    },
    update: {},
  })
  return res.status(204).end()
}
