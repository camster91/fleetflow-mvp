import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { canManageVehicles, canViewBusinessData } from '@/lib/permissions'
import { presentStoredFinding } from '@/lib/intelligence/presentation'
import { intelligenceRunId } from './findings'

const MAX_BRIEF_FINDINGS = 5
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
export const BRIEF_TRANSACTION_MAX_WAIT_MS = 10_000
export const BRIEF_TRANSACTION_TIMEOUT_MS = 30_000

const briefSelect = {
  id: true,
  type: true,
  severity: true,
  confidence: true,
  score: true,
  ruleVersion: true,
  title: true,
  explanation: true,
  evidence: true,
  action: true,
  actionUrl: true,
  status: true,
  feedback: true,
  generatedAt: true,
  expiresAt: true,
  resolvedAt: true,
} as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBusinessData(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })

  const now = new Date()
  const scope = { ownerId: context.tenant.ownerId, teamId: context.tenant.teamId }
  const openWhere = { ...scope, status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
  try {
    const { rows, totalOpen, run } = await prisma.$transaction(
      async (tx) => {
        const [findings, count, latestRun] = await Promise.all([
          tx.intelligenceFinding.findMany({
            where: openWhere,
            select: briefSelect,
            orderBy: [{ score: 'desc' }, { id: 'asc' }],
            take: MAX_BRIEF_FINDINGS,
          }),
          tx.intelligenceFinding.count({ where: openWhere }),
          tx.intelligenceRun.findUnique({ where: { id: intelligenceRunId(context.tenant) } }),
        ])
        return { rows: findings, totalOpen: count, run: latestRun }
      },
      {
        isolationLevel: 'RepeatableRead',
        maxWait: BRIEF_TRANSACTION_MAX_WAIT_MS,
        timeout: BRIEF_TRANSACTION_TIMEOUT_MS,
      }
    )
    const findings = rows.map((row) => presentStoredFinding(row as unknown as Record<string, unknown>, now))
    let sourceCounts: Record<string, number> = {}
    try {
      const parsed = run && run.sourceCounts.length <= 1_024 ? JSON.parse(run.sourceCounts) : null
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const key of ['vehicle', 'delivery', 'maintenance', 'client']) {
          const value = parsed[key]
          if (Number.isSafeInteger(value) && value >= 0) sourceCounts[key] = value
        }
      }
    } catch {
      sourceCounts = {}
    }
    const reasons = !run
      ? ['NEVER_GENERATED']
      : [
          ...(!run.sourceComplete ? ['SOURCE_INCOMPLETE'] : []),
          ...(!run.findingsComplete ? ['FINDINGS_INCOMPLETE'] : []),
          ...(!run.reconciliationComplete ? ['RECONCILIATION_INCOMPLETE'] : []),
          ...(!run.evidenceComplete ? ['EVIDENCE_INCOMPLETE'] : []),
        ]
    const coverageComplete = Boolean(run) && reasons.length === 0
    return res.status(200).json({
      findings,
      totalOpen,
      generatedAt: run?.generatedAt.toISOString() ?? null,
      retrievedAt: now.toISOString(),
      stale: !run || now.getTime() - run.generatedAt.getTime() > STALE_AFTER_MS,
      coverage: {
        complete: coverageComplete,
        reason: reasons[0] ?? null,
        reasons,
        sourceTruncated: run ? !run.sourceComplete : false,
        evidenceComplete: run?.evidenceComplete ?? false,
        findingsComplete: run?.findingsComplete ?? false,
        reconciliationComplete: run?.reconciliationComplete ?? false,
        sourceCounts,
      },
      capabilities: {
        refresh: canManageVehicles(context.tenant.role),
        manage: canManageVehicles(context.tenant.role),
        feedback: true,
      },
    })
  } catch {
    console.error('Intelligence brief load failed')
    return res.status(500).json({ error: 'Unable to load intelligence brief' })
  }
}
