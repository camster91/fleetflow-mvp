import type { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { canManageSettings } from '@/lib/permissions'
import { enrollmentSchema, pilotScopeKey } from '@/lib/pilot'

function present(row: {
  status: string
  pilotStartsAt: Date | null
  pilotEndsAt: Date | null
  consentedAt: Date | null
  supportOwnerLabel: string | null
  updatedAt: Date
}) {
  return {
    status: row.status,
    pilotStartsAt: row.pilotStartsAt?.toISOString() ?? null,
    pilotEndsAt: row.pilotEndsAt?.toISOString() ?? null,
    consentedAt: row.consentedAt?.toISOString() ?? null,
    supportOwnerLabel: row.supportOwnerLabel,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method === 'PUT' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canManageSettings(context.tenant.role)) return res.status(403).json({ error: 'Administrator access required' })
  if (!(await rateLimitMiddleware(req, res, 'admin', `pilot-enrollment:${context.session.user.id}`))) return
  const scopeKey = pilotScopeKey(context.tenant.ownerId, context.tenant.teamId)
  const existing = await prisma.pilotEnrollment.findUnique({ where: { scopeKey } })
  if (req.method === 'GET') return res.status(200).json({ enrollment: existing ? present(existing) : null })
  const parsed = enrollmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pilot enrollment' })
  const now = new Date()
  const status = parsed.data.status
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.pilotEnrollment.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        ownerId: context.tenant.ownerId,
        teamId: context.tenant.teamId,
        status,
        pilotStartsAt: parsed.data.pilotStartsAt
          ? new Date(parsed.data.pilotStartsAt)
          : status === 'ACTIVE'
            ? now
            : null,
        pilotEndsAt: parsed.data.pilotEndsAt ? new Date(parsed.data.pilotEndsAt) : null,
        consentedAt: parsed.data.consent ? now : null,
        supportOwnerId: context.session.user.id,
        supportOwnerLabel: parsed.data.supportOwnerLabel ?? null,
        createdById: context.session.user.id,
      },
      update: {
        status,
        pilotStartsAt: parsed.data.pilotStartsAt ? new Date(parsed.data.pilotStartsAt) : undefined,
        pilotEndsAt: parsed.data.pilotEndsAt ? new Date(parsed.data.pilotEndsAt) : undefined,
        consentedAt: parsed.data.consent ? now : undefined,
        supportOwnerId: context.session.user.id,
        supportOwnerLabel: parsed.data.supportOwnerLabel ?? undefined,
      },
    })
    await tx.auditLog.create({
      data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name ?? null,
        userRole: context.tenant.role,
        action: 'PILOT_ENROLLMENT_UPDATED',
        entityType: 'pilot_enrollment',
        entityId: row.id,
        description: 'Updated controlled pilot enrollment',
        metadata: JSON.stringify({ status: row.status, consented: Boolean(row.consentedAt) }),
      },
    })
    return row
  })
  return res.status(200).json({ enrollment: present(saved) })
}
