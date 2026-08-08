import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { createHash } from 'crypto'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { consumePublicApiQuota } from '@/lib/apiRateLimit'
import { canViewReports } from '@/lib/permissions'
import { scoreMaintenanceRisk } from '@/lib/intelligence/maintenanceRisk'

const TASK_LIMIT = 500
const requestSchema = z.object({
  vehicleId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/),
  helpful: z.boolean(),
  actionTaken: z.boolean(),
  outcomeCategory: z.enum(['SERVICE_SCHEDULED', 'SERVICE_COMPLETED', 'MONITORING', 'NO_ACTION', 'OTHER']).optional(),
  notes: z.string().trim().max(500).optional(),
  consent: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.actionTaken && !value.outcomeCategory) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['outcomeCategory'], message: 'Select an operational outcome' })
  if (!value.actionTaken && value.outcomeCategory) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['outcomeCategory'], message: 'Outcome requires an action' })
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') { res.setHeader('Allow', 'POST, DELETE'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (req.method === 'DELETE') return withdrawFeedback(req, res, context)
  if (!canViewReports(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  const rawKey = req.headers['idempotency-key']; const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey
  if (!idempotencyKey || !/^[A-Za-z0-9_.:-]{8,128}$/.test(idempotencyKey)) return res.status(400).json({ error: 'A valid Idempotency-Key is required' })
  const scopeKey = context.tenant.teamId ? `team:${context.tenant.teamId}` : `owner:${context.tenant.ownerId}`
  const unique = { submittedById_scopeKey_idempotencyKey: { submittedById: context.session.user.id, scopeKey, idempotencyKey } }
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pilot feedback' })
  const requestHash = feedbackRequestHash(parsed.data)
  const replay = await prisma.maintenanceRiskFeedback.findUnique({ where: unique })
  if (replay) return replay.requestHash === requestHash ? res.status(200).json({ feedback: presentFeedback(replay), replayed: true }) : res.status(409).json({ error: 'Idempotency-Key was already used for different feedback' })
  const quota = await consumePublicApiQuota(prisma, `maintenance-risk:${context.session.user.id}:${scopeKey}`)
  if (!quota.allowed) { res.setHeader('Retry-After', String(quota.retryAfter)); return res.status(429).json({ error: 'Too many pilot feedback requests' }) }
  const now = new Date()
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { AND: [{ id: parsed.data.vehicleId }, context.tenant.resourceWhere] },
      select: { id: true, name: true, year: true, mileage: true, lastService: true, maintenanceDue: true },
    })
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })
    const taskRows = await prisma.maintenanceTask.findMany({
      where: { AND: [context.tenant.resourceWhere, { vehicleId: vehicle.id }] },
      select: { id: true, vehicleId: true, type: true, dueDate: true, completed: true, completedDate: true, actualCost: true },
      orderBy: { id: 'asc' }, take: TASK_LIMIT + 1,
    })
    const risk = scoreMaintenanceRisk({ vehicle, tasks: taskRows.slice(0, TASK_LIMIT), serviceMileage: null, currency: process.env.MAINTENANCE_RISK_CURRENCY, costUnit: 'major', sourceComplete: taskRows.length <= TASK_LIMIT }, { now })
    const expiresAt = new Date(now.getTime() + 180 * 86_400_000)
    const row = await prisma.$transaction(async tx => {
      const feedback = await tx.maintenanceRiskFeedback.create({ data: {
        ownerId: context.tenant.ownerId, teamId: context.tenant.teamId, vehicleId: vehicle.id,
        rubricVersion: risk.rubricVersion, scoreSnapshot: risk.score, bandSnapshot: risk.band,
        sourceComplete: risk.sourceComplete, completenessPercent: risk.completeness.percent,
        helpful: parsed.data.helpful, actionTaken: parsed.data.actionTaken,
        outcomeCategory: parsed.data.outcomeCategory ?? null, notes: parsed.data.notes || null,
        consentedAt: now, submittedById: context.session.user.id,
        scopeKey, idempotencyKey, requestHash, expiresAt,
      } })
      await tx.auditLog.create({ data: {
        userId: context.session.user.id, teamId: context.tenant.teamId,
        userName: context.session.user.name ?? null, userRole: context.tenant.role,
        action: 'pilot_feedback_recorded', entityType: 'maintenance_risk', entityId: feedback.id,
        entityName: vehicle.name, description: 'Recorded consented maintenance attention pilot feedback',
        metadata: JSON.stringify({ vehicleId: vehicle.id, rubricVersion: risk.rubricVersion, scoreSnapshot: risk.score, helpful: parsed.data.helpful, actionTaken: parsed.data.actionTaken, outcomeCategory: parsed.data.outcomeCategory ?? null }),
      } })
      return feedback
    })
    return res.status(201).json({ feedback: presentFeedback(row), replayed: false })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const replay = await prisma.maintenanceRiskFeedback.findUnique({ where: unique })
      if (replay) return replay.requestHash === requestHash ? res.status(200).json({ feedback: presentFeedback(replay), replayed: true }) : res.status(409).json({ error: 'Idempotency-Key was already used for different feedback' })
    }
    console.error('Maintenance risk pilot feedback failed')
    return res.status(500).json({ error: 'Unable to record pilot feedback' })
  }
}

export function feedbackRequestHash(value: z.infer<typeof requestSchema>) {
  const canonical = JSON.stringify({ vehicleId: value.vehicleId, helpful: value.helpful, actionTaken: value.actionTaken, outcomeCategory: value.outcomeCategory ?? null, notes: value.notes?.trim() || null, consent: true })
  return createHash('sha256').update(canonical).digest('hex')
}

function presentFeedback(row: { id: string; rubricVersion: string; scoreSnapshot: number; bandSnapshot: string; createdAt: Date; expiresAt?: Date }) {
  return { id: row.id, rubricVersion: row.rubricVersion, scoreSnapshot: row.scoreSnapshot, bandSnapshot: row.bandSnapshot, createdAt: row.createdAt.toISOString(), ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}) }
}

async function withdrawFeedback(req: NextApiRequest, res: NextApiResponse, context: Awaited<ReturnType<typeof requireTenantContext>> & {}) {
  const id = typeof req.body?.id === 'string' && /^[\x21-\x7e]{1,128}$/.test(req.body.id) ? req.body.id : ''
  if (!id) return res.status(400).json({ error: 'Invalid feedback ID' })
  const scopeKey = context.tenant.teamId ? `team:${context.tenant.teamId}` : `owner:${context.tenant.ownerId}`
  const row = await prisma.maintenanceRiskFeedback.findFirst({ where: { id, submittedById: context.session.user.id, scopeKey, ownerId: context.tenant.ownerId, teamId: context.tenant.teamId } })
  if (!row) return res.status(404).json({ error: 'Pilot feedback not found' })
  await prisma.$transaction(async tx => {
    await tx.maintenanceRiskFeedback.delete({ where: { id: row.id } })
    await tx.auditLog.create({ data: { userId: context.session.user.id, teamId: context.tenant.teamId, userName: context.session.user.name ?? null, userRole: context.tenant.role, action: 'pilot_feedback_withdrawn', entityType: 'maintenance_risk', entityId: row.id, description: 'Withdrew maintenance attention pilot feedback', metadata: JSON.stringify({ vehicleId: row.vehicleId, rubricVersion: row.rubricVersion }) } })
  })
  return res.status(200).json({ withdrawn: true })
}
