import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '../../../../lib/prisma'
import { requireIntegrationAdmin } from '../../../../lib/integrations/runtime'
import { reviewTransition, type ReviewAction } from '../../../../lib/integrations/review'
import { enforceIntegrationRateLimit } from '../../../../lib/integrations/rateLimit'

const mutationSchema = z
  .object({
    recordId: z.string().min(1).max(128),
    revision: z.number().int().positive(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
    action: z.enum(['MAP', 'APPROVE', 'REJECT']),
    vehicleId: z.string().min(1).max(128).optional(),
  })
  .strict()

function safeJson(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PATCH'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireIntegrationAdmin(req, res, req.method === 'PATCH')
  if (!context) return
  if (!(await enforceIntegrationRateLimit(context.session.user.id, context.scopeKey, 'records', 'review', res))) return
  if (req.method === 'GET') {
    const [records, vehicles] = await Promise.all([
      prisma.integrationRecord.findMany({
        where: { connection: { scopeKey: context.scopeKey }, remoteType: { in: ['purchase', 'delivery_geocode'] } },
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: {
          id: true,
          remoteType: true,
          remoteId: true,
          payloadHash: true,
          reviewPayload: true,
          provenance: true,
          reviewStatus: true,
          outcome: true,
          attemptCount: true,
          nextRetryAt: true,
          lastErrorCode: true,
          conflictReason: true,
          revision: true,
          localEntityId: true,
          lastSeenAt: true,
          connection: { select: { provider: true } },
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { revision: true, decision: true, reviewerSnapshot: true, mappedVehicleId: true, createdAt: true },
          },
        },
      }),
      prisma.vehicle.findMany({
        where: context.tenant.resourceWhere,
        orderBy: { name: 'asc' },
        take: 100,
        select: { id: true, name: true },
      }),
    ])
    return res.status(200).json({
      vehicles,
      records: records.map(({ reviewPayload, provenance, ...record }) => ({
        ...record,
        payload: safeJson(reviewPayload),
        provenance: safeJson(provenance),
      })),
    })
  }
  const parsed = mutationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid review request' })
  const body = parsed.data
  try {
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.integrationRecord.findFirst({
        where: { id: body.recordId, connection: { scopeKey: context.scopeKey } },
        include: { connection: { select: { provider: true } } },
      })
      if (!record) return { status: 404 as const, error: 'Staged record not found' }
      if (record.revision !== body.revision || record.payloadHash !== body.payloadHash)
        return { status: 409 as const, error: 'This record changed; reload before reviewing' }
      if (body.action === 'MAP') {
        const vehicle = await tx.vehicle.findFirst({
          where: { id: body.vehicleId, AND: [context.tenant.resourceWhere] },
          select: { id: true },
        })
        if (!vehicle) return { status: 404 as const, error: 'Vehicle not found in this workspace' }
      }
      let transition
      try {
        transition = reviewTransition(record, body.action as ReviewAction, body.vehicleId)
      } catch (error) {
        return { status: 409 as const, error: error instanceof Error ? error.message : 'Invalid review transition' }
      }
      const isCorrection =
        body.action === 'MAP' && ['MAPPED_PENDING_APPROVAL', 'REJECTED'].includes(record.reviewStatus)
      const decisionRevision = isCorrection ? record.revision + 1 : record.revision
      const updated = await tx.integrationRecord.updateMany({
        where: {
          id: record.id,
          revision: body.revision,
          payloadHash: body.payloadHash,
          reviewStatus: record.reviewStatus,
        },
        data: { ...transition, ...(isCorrection ? { revision: { increment: 1 } } : {}) },
      })
      if (updated.count !== 1) return { status: 409 as const, error: 'This record changed; reload before reviewing' }
      await tx.integrationRecordReview.create({
        data: {
          recordId: record.id,
          revision: decisionRevision,
          decision: body.action,
          payloadHash: record.payloadHash,
          payloadSnapshot: record.reviewPayload || '{}',
          reviewerId: context.session.user.id,
          reviewerSnapshot: context.session.user.email || context.session.user.name || context.session.user.id,
          mappedVehicleId: body.vehicleId || record.localEntityId,
        },
      })
      await tx.auditLog.create({
        data: {
          userId: context.session.user.id,
          teamId: context.tenant.teamId,
          userName: context.session.user.name,
          userRole: context.tenant.role,
          action: `integration_record_${body.action.toLowerCase()}`,
          entityType: 'integration_record',
          entityId: record.id,
          entityName: `${record.connection.provider}:${record.remoteType}`,
          description: `Reviewed staged integration record revision ${decisionRevision}`,
          metadata: JSON.stringify({
            provider: record.connection.provider,
            revision: decisionRevision,
            decision: body.action,
            correction: isCorrection,
          }),
        },
      })
      return {
        status: 200 as const,
        record: await tx.integrationRecord.findUnique({
          where: { id: record.id },
          select: { id: true, reviewStatus: true, revision: true, localEntityId: true, conflictReason: true },
        }),
      }
    })
    return res.status(result.status).json('error' in result ? { error: result.error } : { record: result.record })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002')
      return res.status(409).json({ error: 'This review decision was already recorded' })
    return res.status(500).json({ error: 'Review could not be saved' })
  }
}
