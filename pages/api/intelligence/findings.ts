import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { assertSameOrigin, requireTenantContext, type TenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { canManageVehicles, canViewBusinessData } from '@/lib/permissions'
import { resolveApiCursorSecret } from '@/lib/publicApi'
import { constantTimeCompare } from '@/lib/tokens'
import { assessDataQuality } from '@/lib/intelligence/dataQuality'
import { generateFindings } from '@/lib/intelligence/generateFindings'
import { getWorkspaceTimeZone } from '@/lib/workspaceTimeZone'
import type { Finding, IntelligenceRecords } from '@/lib/intelligence/types'
import { packFindingEvidence, parseStoredEvidence, presentStoredFinding } from '@/lib/intelligence/presentation'
export { FINDING_EVIDENCE_BYTES_MAX, FINDING_EVIDENCE_ITEMS_MAX, packFindingEvidence, parseStoredEvidence } from '@/lib/intelligence/presentation'

export const FINDING_SOURCE_LIMIT = 500
export const FINDING_PAGE_LIMIT_MAX = 50
export const FINDING_PERSIST_LIMIT = 500
export const FINDING_RECONCILE_LIMIT = 500
export const FINDING_TRANSACTION_MAX_WAIT_MS = 10_000
export const FINDING_TRANSACTION_TIMEOUT_MS = 30_000

const READ_STATUSES = new Set(['OPEN', 'DISMISSED', 'RESOLVED', 'EXPIRED'])
const PATCH_ACTIONS = new Set(['HELPFUL', 'NOT_HELPFUL', 'DISMISS', 'RESOLVE'])
const STORED_FEEDBACK = new Set(['HELPFUL', 'NOT_HELPFUL'])
const FINDING_CURSOR_ENDPOINT = 'intelligence/findings'

const findingSelect = {
  id: true, type: true, severity: true, confidence: true, score: true,
  ruleVersion: true, title: true, explanation: true, evidence: true,
  action: true, actionUrl: true, status: true, feedback: true,
  generatedAt: true, expiresAt: true, resolvedAt: true,
} as const

const vehicleSelect = {
  id: true, status: true, mileage: true, driver: true, lastService: true,
  nextService: true, createdAt: true, updatedAt: true, lastUpdated: true,
} as const
const deliverySelect = {
  id: true, status: true, vehicleId: true, driver: true, scheduledTime: true,
  estimatedArrival: true, contactPerson: true, updatedAt: true,
} as const
const maintenanceSelect = {
  id: true, completed: true, dueDate: true, completedDate: true, vehicleId: true,
  costEstimate: true, actualCost: true, updatedAt: true,
} as const
const clientSelect = {
  id: true, phone: true, email: true, contactPerson: true, updatedAt: true,
} as const

class FindingIdentityConflict extends Error {}
class InvalidFindingTransition extends Error {}
class ConcurrentFindingUpdate extends Error {
  code = 'P2034'
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value
}

function positiveInteger(value: string | undefined, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number | null {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null
}


type ExistingFindingLifecycle = {
  id?: string
  ownerId?: string
  teamId?: string | null
  status: string
  feedback: string | null
  ruleVersion: string
  expiresAt: Date | null
  resolvedAt?: Date | null
}

export function prepareFindingWrite(finding: Finding, existing: ExistingFindingLifecycle | null, now: Date) {
  const protectedDismissal = existing?.status === 'DISMISSED' &&
    existing.ruleVersion === finding.ruleVersion &&
    existing.expiresAt instanceof Date && existing.expiresAt.getTime() > now.getTime()
  return {
    type: finding.type,
    severity: finding.severity,
    confidence: finding.confidence.score,
    score: finding.score,
    ruleVersion: finding.ruleVersion,
    title: finding.title,
    explanation: finding.explanation,
    evidence: packFindingEvidence(finding.evidence),
    action: finding.recommendedAction,
    actionUrl: finding.actionUrl,
    status: protectedDismissal ? 'DISMISSED' : 'OPEN',
    feedback: typeof existing?.feedback === 'string' && STORED_FEEDBACK.has(existing.feedback)
      ? existing.feedback : null,
    generatedAt: finding.generatedAt,
    expiresAt: protectedDismissal ? existing.expiresAt : finding.expiresAt,
    resolvedAt: null,
  }
}

function scopedFindingWhere(tenant: TenantContext) {
  // Findings are generated for one selected workspace. Unlike legacy source
  // records, they must never inherit the owner's null-team compatibility scope.
  return { ownerId: tenant.ownerId, teamId: tenant.teamId }
}

function findingTenantKey(tenant: TenantContext): string {
  return tenant.teamId ? `team:${tenant.teamId}` : `personal:${tenant.ownerId}`
}

export function intelligenceRunId(tenant: TenantContext): string {
  const key = findingTenantKey(tenant)
  return key.length <= 191 ? key : `${tenant.teamId ? 'team' : 'personal'}:sha256:${crypto.createHash('sha256').update(key).digest('hex')}`
}

export function createFindingCursor(
  tenant: TenantContext,
  status: string,
  key: { score: number; id: string }
): string {
  const payload = Buffer.from(JSON.stringify({
    v: 1, endpoint: FINDING_CURSOR_ENDPOINT, tenant: findingTenantKey(tenant),
    status, score: key.score, id: key.id,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', resolveApiCursorSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function readFindingCursor(
  value: string,
  tenant: TenantContext,
  status: string
): { score: number; id: string } | null {
  try {
    if (value.length > 4_096) return null
    const [payload, signature, extra] = value.split('.')
    if (!payload || !signature || extra) return null
    const expected = crypto.createHmac('sha256', resolveApiCursorSecret()).update(payload).digest('base64url')
    if (!constantTimeCompare(signature, expected)) return null
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      parsed?.v !== 1 || parsed.endpoint !== FINDING_CURSOR_ENDPOINT ||
      parsed.tenant !== findingTenantKey(tenant) || parsed.status !== status ||
      !Number.isSafeInteger(parsed.score) || typeof parsed.id !== 'string' ||
      !/^[\x21-\x7e]{1,1024}$/.test(parsed.id)
    ) return null
    return { score: parsed.score, id: parsed.id }
  } catch {
    return null
  }
}

const serializeFinding = presentStoredFinding

function auditData(
  session: { user: { id: string } },
  tenant: TenantContext,
  action: string,
  finding: Pick<Finding, 'id' | 'type' | 'ruleVersion'> | { id: string; type: string; ruleVersion: string },
  metadata?: Record<string, string>
) {
  return {
    userId: session.user.id,
    teamId: tenant.teamId,
    userRole: tenant.role,
    action,
    entityType: 'intelligence_finding',
    entityId: finding.id,
    description: `Intelligence finding ${action.replace(/_/g, ' ')}`,
    metadata: JSON.stringify({
      ruleVersion: /^[a-z0-9._-]{1,64}$/i.test(finding.ruleVersion) ? finding.ruleVersion : 'unknown',
      ...metadata,
    }),
  }
}

async function getFindings(req: NextApiRequest, res: NextApiResponse, tenant: TenantContext) {
  if (Array.isArray(req.query.status)) return res.status(400).json({ error: 'Invalid status filter' })
  if (Array.isArray(req.query.limit)) return res.status(400).json({ error: 'Invalid limit' })
  if (Array.isArray(req.query.cursor)) return res.status(400).json({ error: 'Invalid cursor' })
  const status = one(req.query.status)?.toUpperCase()
  if (status && !READ_STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status filter' })
  const requestedLimit = positiveInteger(one(req.query.limit), 25)
  if (requestedLimit === null) return res.status(400).json({ error: 'Invalid limit' })
  const limit = Math.min(requestedLimit, FINDING_PAGE_LIMIT_MAX)
  try {
    resolveApiCursorSecret()
  } catch {
    return res.status(503).json({ error: 'Pagination security is not configured' })
  }
  const cursorStatus = status || 'ALL'
  const rawCursor = one(req.query.cursor)
  const cursor = rawCursor ? readFindingCursor(rawCursor, tenant, cursorStatus) : null
  if (rawCursor && !cursor) return res.status(400).json({ error: 'Invalid cursor' })
  const now = new Date()
  const statusWhere = status === 'EXPIRED'
    ? { status: 'OPEN', expiresAt: { lte: now } }
    : status === 'OPEN'
      ? { status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      : status ? { status } : undefined
  const whereParts: Array<Record<string, unknown>> = [scopedFindingWhere(tenant)]
  if (statusWhere) whereParts.push(statusWhere)
  if (cursor) whereParts.push({
    OR: [{ score: { lt: cursor.score } }, { score: cursor.score, id: { gt: cursor.id } }],
  })
  const where = whereParts.length === 1 ? whereParts[0] : { AND: whereParts }

  try {
    const rows = await prisma.intelligenceFinding.findMany({
      where, select: findingSelect, orderBy: [{ score: 'desc' }, { id: 'asc' }], take: limit + 1,
    })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page[page.length - 1]
    return res.status(200).json({
      findings: page.map(row => serializeFinding(row as unknown as Record<string, unknown>, now)),
      pagination: {
        limit,
        nextCursor: hasMore && last ? createFindingCursor(tenant, cursorStatus, last) : null,
      },
      generatedAt: now.toISOString(),
    })
  } catch {
    console.error('Intelligence findings list failed')
    return res.status(500).json({ error: 'Unable to load findings' })
  }
}

async function generateFindingSnapshot(tx: Prisma.TransactionClient, tenant: TenantContext, now: Date, timeZone: string) {
  const take = FINDING_SOURCE_LIMIT + 1
  const where = tenant.resourceWhere
  const [vehicleRows, deliveryRows, maintenanceRows, clientRows] = await Promise.all([
    tx.vehicle.findMany({ where, select: vehicleSelect, orderBy: { id: 'asc' }, take }),
    tx.delivery.findMany({ where, select: deliverySelect, orderBy: { id: 'asc' }, take }),
    tx.maintenanceTask.findMany({ where, select: maintenanceSelect, orderBy: { id: 'asc' }, take }),
    tx.client.findMany({ where, select: clientSelect, orderBy: { id: 'asc' }, take }),
  ])
  const sourceTruncated = [vehicleRows, deliveryRows, maintenanceRows, clientRows]
    .some(rows => rows.length > FINDING_SOURCE_LIMIT)
  const vehicles = vehicleRows.slice(0, FINDING_SOURCE_LIMIT)
  const deliveries = deliveryRows.slice(0, FINDING_SOURCE_LIMIT)
  const maintenance = maintenanceRows.slice(0, FINDING_SOURCE_LIMIT)
  const clients = clientRows.slice(0, FINDING_SOURCE_LIMIT)
  const dataQualityIssues = assessDataQuality({ vehicles, deliveries, maintenance, clients })
    .map(issue => ({
      entityType: issue.entityType,
      entityId: issue.entityId,
      severity: issue.severity,
      field: issue.field,
      actionUrl: issue.actionUrl,
    }))
  const records: IntelligenceRecords = { vehicles, deliveries, maintenance, dataQualityIssues }
  const tenantKey = tenant.teamId ? `team:${tenant.teamId}` : `owner:${tenant.ownerId}`
  return {
    findings: generateFindings({ tenantKey, now, timeZone, records }),
    sourceTruncated,
    recordsScannedByEntity: {
      vehicle: vehicles.length,
      delivery: deliveries.length,
      maintenance: maintenance.length,
      client: clients.length,
    },
  }
}

type ExistingFinding = Prisma.IntelligenceFindingGetPayload<{
  select: {
    id: true; ownerId: true; teamId: true; type: true; status: true; feedback: true;
    ruleVersion: true; expiresAt: true; resolvedAt: true
  }
}>

type FindingWrite = ReturnType<typeof prepareFindingWrite>
type FindingUpdate = { id: string; expected: ExistingFinding; data: FindingWrite }

function bulkUpdateSql(updates: readonly FindingUpdate[], tenant: TenantContext): Prisma.Sql {
  const values = updates.map(update => Prisma.sql`(
    ${update.id}::text, ${update.data.type}::text, ${update.data.severity}::text,
    ${update.data.confidence}::double precision, ${update.data.score}::integer,
    ${update.data.ruleVersion}::text, ${update.data.title}::text,
    ${update.data.explanation}::text, ${update.data.evidence}::text,
    ${update.data.action}::text, ${update.data.actionUrl}::text,
    ${update.data.status}::text, ${update.data.feedback}::text,
    ${update.data.generatedAt}::timestamp(3), ${update.data.expiresAt}::timestamp(3),
    ${update.data.resolvedAt}::timestamp(3), ${update.expected.status}::text,
    ${update.expected.feedback}::text, ${update.expected.expiresAt}::timestamp(3),
    ${update.expected.resolvedAt}::timestamp(3)
  )`)
  return Prisma.sql`
    UPDATE "IntelligenceFinding" AS target SET
      "type" = data."type", "severity" = data."severity",
      "confidence" = data."confidence", "score" = data."score",
      "ruleVersion" = data."ruleVersion", "title" = data."title",
      "explanation" = data."explanation", "evidence" = data."evidence",
      "action" = data."action", "actionUrl" = data."actionUrl",
      "status" = data."status", "feedback" = data."feedback",
      "generatedAt" = data."generatedAt", "expiresAt" = data."expiresAt",
      "resolvedAt" = data."resolvedAt"
    FROM (VALUES ${Prisma.join(values)}) AS data(
      "id", "type", "severity", "confidence", "score", "ruleVersion",
      "title", "explanation", "evidence", "action", "actionUrl", "status",
      "feedback", "generatedAt", "expiresAt", "resolvedAt", "expectedStatus",
      "expectedFeedback", "expectedExpiresAt", "expectedResolvedAt"
    )
    WHERE target."id" = data."id"
      AND target."ownerId" = ${tenant.ownerId}::text
      AND target."teamId" IS NOT DISTINCT FROM ${tenant.teamId}::text
      AND target."status" = data."expectedStatus"
      AND target."feedback" IS NOT DISTINCT FROM data."expectedFeedback"
      AND target."expiresAt" IS NOT DISTINCT FROM data."expectedExpiresAt"
      AND target."resolvedAt" IS NOT DISTINCT FROM data."expectedResolvedAt"
  `
}

async function persistFindingSnapshot(
  tx: Prisma.TransactionClient,
  snapshot: Awaited<ReturnType<typeof generateFindingSnapshot>>,
  session: { user: { id: string } },
  tenant: TenantContext,
  now: Date
) {
  const generatedTotal = snapshot.findings.length
  const persistedFindings = snapshot.findings.slice(0, FINDING_PERSIST_LIMIT)
  const findingsTruncated = generatedTotal > persistedFindings.length
  const evidenceComplete = !findingsTruncated && persistedFindings.every(finding => {
    const parsed = parseStoredEvidence(packFindingEvidence(finding.evidence))
    return parsed.valid && !parsed.evidenceTruncated && parsed.evidenceTotal === finding.evidence.length
  })
  const persistedIds = persistedFindings.map(finding => finding.id)
  const existing = persistedIds.length > 0 ? await tx.intelligenceFinding.findMany({
    where: { AND: [scopedFindingWhere(tenant), { id: { in: persistedIds } }] },
    select: {
      id: true, ownerId: true, teamId: true, type: true, status: true, feedback: true,
      ruleVersion: true, expiresAt: true, resolvedAt: true,
    },
    orderBy: { id: 'asc' },
    take: FINDING_PERSIST_LIMIT,
  }) : []
  const existingById = new Map(existing.map(row => [row.id, row]))
  const generatedIds = new Set(persistedFindings.map(finding => finding.id))
  const creates: Array<{ id: string; ownerId: string; teamId: string | null } & FindingWrite> = []
  const updates: FindingUpdate[] = []
  for (const finding of persistedFindings) {
    const current = existingById.get(finding.id) ?? null
    const data = prepareFindingWrite(finding, current, now)
    if (current) updates.push({ id: finding.id, expected: current, data })
    else creates.push({ id: finding.id, ownerId: tenant.ownerId, teamId: tenant.teamId, ...data })
  }
  const generationComplete = !snapshot.sourceTruncated && !findingsTruncated
  const absentCandidates = generationComplete ? await tx.intelligenceFinding.findMany({
    where: {
      AND: [
        scopedFindingWhere(tenant),
        { status: 'OPEN' },
        ...(persistedIds.length > 0 ? [{ id: { notIn: persistedIds } }] : []),
      ],
    },
    select: {
      id: true, ownerId: true, teamId: true, type: true, status: true, feedback: true,
      ruleVersion: true, expiresAt: true, resolvedAt: true,
    },
    orderBy: { id: 'asc' },
    take: FINDING_RECONCILE_LIMIT + 1,
  }) : []
  const absent = absentCandidates
    .filter(row => !generatedIds.has(row.id))
    .slice(0, FINDING_RECONCILE_LIMIT)
  const reconciliationComplete = generationComplete && absentCandidates.length <= FINDING_RECONCILE_LIMIT
  const coverageComplete = generationComplete && reconciliationComplete
  const audits = [
    ...persistedFindings.map(finding => auditData(
      session, tenant, existingById.has(finding.id) ? 'regenerated' : 'generated', finding
    )),
    ...absent.map(finding => auditData(session, tenant, 'auto_resolved', finding)),
  ]

  if (creates.length > 0) {
    const created = await tx.intelligenceFinding.createMany({ data: creates })
    if (created.count !== creates.length) throw new FindingIdentityConflict()
  }
  if (updates.length > 0) {
    const updated = await tx.$executeRaw(bulkUpdateSql(updates, tenant))
    if (updated !== updates.length) throw new ConcurrentFindingUpdate()
  }
  let autoResolved = 0
  if (absent.length > 0) {
    const resolved = await tx.intelligenceFinding.updateMany({
      where: {
        AND: [scopedFindingWhere(tenant), { id: { in: absent.map(row => row.id) }, status: 'OPEN' }],
      },
      data: { status: 'RESOLVED', resolvedAt: now },
    })
    if (resolved.count !== absent.length) throw new ConcurrentFindingUpdate()
    autoResolved = resolved.count
  }
  if (audits.length > 0) await tx.auditLog.createMany({ data: audits })

  const sourceComplete = !snapshot.sourceTruncated
  const findingsComplete = !findingsTruncated
  const runData = {
    ownerId: tenant.ownerId,
    teamId: tenant.teamId,
    generatedAt: now,
    sourceComplete,
    findingsComplete,
    reconciliationComplete,
    evidenceComplete,
    findingTotal: generatedTotal,
    sourceCounts: JSON.stringify(snapshot.recordsScannedByEntity),
  }
  await tx.intelligenceRun.upsert({
    where: { id: intelligenceRunId(tenant) },
    create: { id: intelligenceRunId(tenant), ...runData },
    update: runData,
  })

  return {
    generatedTotal,
    persistedTotal: persistedFindings.length,
    findingsTruncated,
    autoResolved,
    coverage: {
      complete: coverageComplete && evidenceComplete,
      sourceTruncated: snapshot.sourceTruncated,
      findingsTruncated,
      reconciliationComplete,
      evidenceComplete,
      sourceLimitPerEntity: FINDING_SOURCE_LIMIT,
      findingPersistLimit: FINDING_PERSIST_LIMIT,
      reconciliationLimit: FINDING_RECONCILE_LIMIT,
      recordsScannedByEntity: snapshot.recordsScannedByEntity,
    },
    generatedAt: now.toISOString(),
  }
}

function prismaErrorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined
}

function isUniqueConflict(error: unknown): boolean {
  return prismaErrorCode(error) === 'P2002'
}

async function withFindingRetry<T>(operation: () => Promise<T>, includeUniqueConflict = false): Promise<T> {
  let retried = false
  while (true) {
    try {
      return await operation()
    } catch (error) {
      const retryable = prismaErrorCode(error) === 'P2034' || (includeUniqueConflict && isUniqueConflict(error))
      if (!retried && retryable) {
        retried = true
        continue
      }
      throw error
    }
  }
}

const FINDING_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable' as const,
  maxWait: FINDING_TRANSACTION_MAX_WAIT_MS,
  timeout: FINDING_TRANSACTION_TIMEOUT_MS,
}

async function regenerate(req: NextApiRequest, res: NextApiResponse, context: Awaited<ReturnType<typeof requireTenantContext>> & {}) {
  if (!canManageVehicles(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  const now = new Date()
  const timeZone = await getWorkspaceTimeZone(context.tenant)
  try {
    const result = await withFindingRetry(
      () => prisma.$transaction(async tx => {
        // All bounded reads, deterministic calculation, and bulk writes share
        // one serializable workspace snapshot. No external I/O occurs here.
        const snapshot = await generateFindingSnapshot(tx, context.tenant, now, timeZone)
        return persistFindingSnapshot(tx, snapshot, context.session, context.tenant, now)
      }, FINDING_TRANSACTION_OPTIONS),
      true
    )
    return res.status(200).json(result)
  } catch (error) {
    if (error instanceof FindingIdentityConflict || isUniqueConflict(error)) {
      return res.status(409).json({ error: 'Finding identity conflict; regeneration was not applied' })
    }
    console.error('Intelligence finding regeneration failed')
    return res.status(500).json({ error: 'Unable to regenerate findings' })
  }
}

async function patchFinding(req: NextApiRequest, res: NextApiResponse, context: Awaited<ReturnType<typeof requireTenantContext>> & {}) {
  const id = typeof req.body?.id === 'string' ? req.body.id : ''
  const action = typeof req.body?.action === 'string' ? req.body.action.toUpperCase() : ''
  if (!id || id.length > 1024 || !/^[\x21-\x7e]+$/.test(id)) return res.status(400).json({ error: 'Invalid finding ID' })
  if (!PATCH_ACTIONS.has(action)) return res.status(400).json({ error: 'Invalid action' })
  if ((action === 'DISMISS' || action === 'RESOLVE') && !canManageVehicles(context.tenant.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' })
  }
  const now = new Date()
  const timeZone = await getWorkspaceTimeZone(context.tenant)
  try {
    const result = await withFindingRetry(() => prisma.$transaction(async tx => {
      const finding = await tx.intelligenceFinding.findFirst({
        where: { AND: [{ id }, scopedFindingWhere(context.tenant)] },
      })
      if (!finding) return null
      const expired = finding.expiresAt instanceof Date && finding.expiresAt.getTime() <= now.getTime()
      const lifecycle = action === 'DISMISS' || action === 'RESOLVE'
      if ((lifecycle && (finding.status !== 'OPEN' || expired)) || (!lifecycle && expired)) {
        throw new InvalidFindingTransition()
      }
      if (!lifecycle && finding.feedback === action) return { row: finding, noop: true }
      const data = action === 'HELPFUL' || action === 'NOT_HELPFUL'
        ? { feedback: action }
        : action === 'DISMISS'
          ? { status: 'DISMISSED', resolvedAt: null }
          : { status: 'RESOLVED', resolvedAt: now }
      const changed = await tx.intelligenceFinding.updateMany({
        where: {
          id,
          ...scopedFindingWhere(context.tenant),
          status: finding.status,
          feedback: finding.feedback,
          expiresAt: finding.expiresAt,
          resolvedAt: finding.resolvedAt,
        },
        data,
      })
      if (changed.count !== 1) throw new ConcurrentFindingUpdate()
      const auditAction = action === 'HELPFUL' || action === 'NOT_HELPFUL'
        ? 'feedback_recorded' : action === 'DISMISS' ? 'dismissed' : 'resolved'
      await tx.auditLog.create({
        data: auditData(context.session, context.tenant, auditAction, finding, {
          ...(action === 'HELPFUL' || action === 'NOT_HELPFUL' ? { feedback: action } : { status: data.status as string }),
        }),
      })
      return { row: { ...finding, ...data }, noop: false }
    }, FINDING_TRANSACTION_OPTIONS))
    if (!result) return res.status(404).json({ error: 'Finding not found' })
    return res.status(200).json({ finding: serializeFinding(result.row as unknown as Record<string, unknown>, now), noop: result.noop })
  } catch (error) {
    if (error instanceof InvalidFindingTransition) return res.status(409).json({ error: 'INVALID_TRANSITION' })
    console.error('Intelligence finding update failed')
    return res.status(500).json({ error: 'Unable to update finding' })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method !== 'GET' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBusinessData(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  if (req.method === 'GET') return getFindings(req, res, context.tenant)
  if (req.method === 'POST') return regenerate(req, res, context)
  return patchFinding(req, res, context)
}
