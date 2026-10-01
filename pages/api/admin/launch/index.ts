import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePlatformAdmin } from '@/lib/platformAdmin'
import { blockingChecks, deployConfigured, launchChecks, releaseMode } from '@/lib/launchReadiness'

const YEAR_MS = 366 * 24 * 60 * 60 * 1000
const CLOCK_SKEW_MS = 5 * 60 * 1000

const evidenceUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password
    } catch {
      return false
    }
  }, 'Evidence link must be an https URL')

const common = {
  performedAt: z.coerce
    .date({ message: 'Enter when it happened' })
    .refine((date) => date.getTime() <= Date.now() + CLOCK_SKEW_MS, 'Cannot be in the future')
    .refine((date) => date.getTime() >= Date.now() - YEAR_MS, 'Must be within the last year'),
  summary: z.string().trim().min(3, 'Describe what was done (at least 3 characters)').max(1000),
  evidenceUrl: evidenceUrl.optional().or(z.literal('').transform(() => undefined)),
  reference: z
    .string()
    .trim()
    .max(128)
    .regex(/^[A-Za-z0-9:._/-]{4,128}$/, 'Checksum or ID: 4-128 letters, digits and : . _ / -')
    .optional()
    .or(z.literal('').transform(() => undefined)),
}

const recordSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('backup_drill'), outcome: z.enum(['pass', 'fail']), ...common }).strict(),
  z.object({ kind: z.literal('restore_drill'), outcome: z.enum(['pass', 'fail']), ...common }).strict(),
  z.object({ kind: z.literal('monitoring_test'), outcome: z.enum(['pass', 'fail']), ...common }).strict(),
  z.object({ kind: z.literal('go_no_go'), outcome: z.enum(['go', 'no_go']), ...common }).strict(),
])

const KIND_LABEL = {
  backup_drill: 'backup drill',
  restore_drill: 'restore drill',
  monitoring_test: 'monitoring test',
  go_no_go: 'go/no-go decision',
} as const

async function snapshot() {
  const [checks, records] = await Promise.all([
    launchChecks(),
    prisma.opsRecord.findMany({ orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }], take: 50 }),
  ])
  return {
    mode: releaseMode(),
    ready: blockingChecks(checks).length === 0,
    checks,
    records: records.map((record) => ({
      ...record,
      performedAt: record.performedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    })),
    deployConfigured: deployConfigured(),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requirePlatformAdmin(req, res, { methods: ['GET', 'POST'], rateKey: 'launch' })
  if (!context) return
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'GET') return res.status(200).json(await snapshot())

    const parsed = recordSchema.safeParse(req.body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return res.status(400).json({
        error: issue?.message ?? 'Invalid record',
        field: typeof issue?.path[0] === 'string' ? issue.path[0] : undefined,
      })
    }
    const record = parsed.data
    if (record.kind === 'go_no_go' && record.outcome === 'go') {
      const blocking = blockingChecks(await launchChecks())
      if (blocking.length)
        return res.status(409).json({
          error: `Resolve the failing checks before recording a go: ${blocking.map((check) => check.label).join(', ')}`,
          field: 'outcome',
        })
    }

    const user = context.session.user
    await prisma.$transaction(async (tx) => {
      const created = await tx.opsRecord.create({
        data: { ...record, recordedById: user.id, recordedByName: user.name ?? null },
      })
      await tx.auditLog.create({
        data: {
          userId: user.id,
          teamId: context.tenant.teamId,
          userName: user.name ?? null,
          userRole: context.tenant.role,
          action: record.kind === 'go_no_go' ? 'LAUNCH_DECISION_RECORDED' : 'OPS_EVIDENCE_RECORDED',
          entityType: 'ops_record',
          entityId: created.id,
          description: `Recorded ${KIND_LABEL[record.kind]}: ${record.outcome.replace('_', '-')}`,
          metadata: JSON.stringify({ kind: record.kind, outcome: record.outcome }),
        },
      })
    })
    return res.status(201).json(await snapshot())
  } catch {
    return res.status(500).json({ error: 'Launch readiness could not be loaded' })
  }
}
