import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { canManageDeliveries, canManageMaintenance, canViewBusinessData } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { deliveryStatusUpdateSchema, maintenanceCreateValuesSchema } from '@/lib/validation'
import {
  createActionPreview,
  parseActionPreviewKeyRing,
  safeEditHref,
  suggestedActionSchema,
  verifyActionPreview,
  type SuggestedAction,
} from '@/lib/ai/actionRegistry'
import { applyDeliveryStatusTransition } from '@/lib/deliveryTransitions'

const previewRequest = z
  .object({
    action: suggestedActionSchema,
    sourceFindingId: z.string().min(1).max(100).optional(),
  })
  .strict()
const confirmRequest = z
  .object({
    previewToken: z.string().min(20).max(12_000),
    confirm: z.literal(true),
  })
  .strict()
const keys = () => parseActionPreviewKeyRing(process.env)
const scopedFinding = (ownerId: string, teamId: string | null, id: string) => ({
  id,
  ownerId,
  teamId,
})

async function validSourceFinding(
  ownerId: string,
  teamId: string | null,
  id: string,
  action: SuggestedAction,
  db: Pick<typeof prisma, 'intelligenceFinding'> = prisma
) {
  const finding = await db.intelligenceFinding.findFirst({
    where: scopedFinding(ownerId, teamId, id),
    select: {
      id: true,
      status: true,
      resolvedAt: true,
      expiresAt: true,
      evidence: true,
    },
  })
  if (
    !finding ||
    finding.status !== 'OPEN' ||
    finding.resolvedAt ||
    (finding.expiresAt && finding.expiresAt <= new Date())
  )
    return false
  const target =
    action.type === 'update_delivery_status'
      ? { entityType: 'delivery', entityId: action.deliveryId }
      : action.type === 'create_maintenance_task'
        ? { entityType: 'vehicle', entityId: action.vehicleId }
        : null
  if (!target) return true
  try {
    const evidence: unknown = JSON.parse(finding.evidence)
    return (
      Array.isArray(evidence) &&
      evidence.some(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          (item as Record<string, unknown>).entityType === target.entityType &&
          (item as Record<string, unknown>).entityId === target.entityId
      )
    )
  } catch {
    return false
  }
}

function canUse(action: SuggestedAction, role: Parameters<typeof canViewBusinessData>[0]) {
  if (action.type === 'create_maintenance_task') return canManageMaintenance(role)
  if (action.type === 'update_delivery_status') return canManageDeliveries(role)
  return canViewBusinessData(role)
}

async function loadBefore(action: SuggestedAction, resourceWhere: object) {
  if (action.type === 'update_delivery_status') {
    const row = await prisma.delivery.findFirst({
      where: { AND: [{ id: action.deliveryId }, resourceWhere] },
      select: {
        id: true,
        customer: true,
        status: true,
        notes: true,
        progress: true,
        completedTime: true,
        updatedAt: true,
      },
    })
    if (!row) return null
    return {
      id: row.id,
      customer: row.customer,
      status: row.status,
      notes: row.notes,
      progress: row.progress,
      completedTime: row.completedTime?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }
  }
  if (action.type === 'create_maintenance_task') {
    const row = await prisma.vehicle.findFirst({
      where: { AND: [{ id: action.vehicleId }, resourceWhere] },
      select: { id: true, name: true, updatedAt: true },
    })
    if (!row) return null
    return {
      vehicleId: row.id,
      vehicle: row.name,
      vehicleUpdatedAt: row.updatedAt.toISOString(),
      maintenanceTask: null,
    }
  }
  if (action.type === 'open_edit') {
    if (action.entityType === 'vehicle') {
      const row = await prisma.vehicle.findFirst({
        where: { AND: [{ id: action.entityId }, resourceWhere] },
        select: { status: true, mileage: true },
      })
      if (!row) return null
      return Object.fromEntries(Object.keys(action.values).map((key) => [key, row[key as keyof typeof row]]))
    }
    const row = await prisma.delivery.findFirst({
      where: { AND: [{ id: action.entityId }, resourceWhere] },
      select: { status: true, notes: true },
    })
    if (!row) return null
    return Object.fromEntries(Object.keys(action.values).map((key) => [key, row[key as keyof typeof row]]))
  }
  if (action.type === 'draft_weekly_summary') {
    const [vehicles, openMaintenance, activeDeliveries, completedDeliveries] = await Promise.all([
      prisma.vehicle.count({ where: resourceWhere }),
      prisma.maintenanceTask.count({
        where: { AND: [resourceWhere, { completed: false }] },
      }),
      prisma.delivery.count({
        where: {
          AND: [resourceWhere, { status: { notIn: ['delivered', 'cancelled'] } }],
        },
      }),
      prisma.delivery.count({
        where: {
          AND: [
            resourceWhere,
            {
              status: 'delivered',
              updatedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
            },
          ],
        },
      }),
    ])
    return {
      vehicles,
      openMaintenance,
      activeDeliveries,
      completedDeliveriesLast7Days: completedDeliveries,
    }
  }
  return {}
}

async function execute(
  payload: ReturnType<typeof verifyActionPreview>,
  context: Awaited<ReturnType<typeof requireTenantContext>>
) {
  if (!context) throw new Error('missing context')
  const { tenant, session } = context
  return prisma.$transaction(
    async (tx) => {
      let result: Record<string, unknown>
      const action = payload.action
      if (
        payload.sourceFindingId &&
        !(await validSourceFinding(tenant.ownerId, tenant.teamId, payload.sourceFindingId, action, tx))
      )
        throw Object.assign(new Error('Source finding changed'), { statusCode: 409 })
      if (action.type === 'update_delivery_status') {
        const values = deliveryStatusUpdateSchema.parse(action.values)
        const current = await tx.delivery.findFirst({
          where: { AND: [{ id: action.deliveryId }, tenant.resourceWhere] },
          select: {
            id: true,
            customer: true,
            status: true,
            notes: true,
            progress: true,
            completedTime: true,
            updatedAt: true,
          },
        })
        if (!current) throw Object.assign(new Error('Not found'), { statusCode: 404 })
        if (current.updatedAt.toISOString() !== action.expectedUpdatedAt)
          throw Object.assign(new Error('Record changed since preview'), {
            statusCode: 409,
          })
        const transition = applyDeliveryStatusTransition(current, values, new Date(payload.issuedAt))
        const updated = await tx.delivery.updateMany({
          where: {
            AND: [{ id: action.deliveryId, updatedAt: current.updatedAt }, tenant.resourceWhere],
          },
          data: transition.fields,
        })
        if (updated.count !== 1)
          throw Object.assign(new Error('Record changed since preview'), {
            statusCode: 409,
          })
        if (current.status !== values.status)
          await tx.deliveryEvent.create({
            data: {
              deliveryId: action.deliveryId,
              ...transition.event,
              createdBy: session.user.id,
            },
          })
        result = {
          entityType: 'delivery',
          entityId: action.deliveryId,
          before: {
            status: current.status,
            notes: current.notes,
            progress: current.progress,
            completedTime: current.completedTime?.toISOString() ?? null,
          },
          after: {
            ...transition.fields,
            completedTime: transition.fields.completedTime?.toISOString() ?? null,
          },
          eventCreated: current.status !== values.status,
        }
      } else if (action.type === 'create_maintenance_task') {
        const values = maintenanceCreateValuesSchema.parse(action.values)
        const vehicle = await tx.vehicle.findFirst({
          where: { AND: [{ id: action.vehicleId }, tenant.resourceWhere] },
          select: { id: true, name: true, updatedAt: true },
        })
        if (!vehicle) throw Object.assign(new Error('Not found'), { statusCode: 404 })
        if (vehicle.updatedAt.toISOString() !== action.expectedVehicleUpdatedAt)
          throw Object.assign(new Error('Record changed since preview'), {
            statusCode: 409,
          })
        if (!payload.generatedEntityId) throw new Error('Missing generated entity ID')
        const task = await tx.maintenanceTask.create({
          data: {
            id: payload.generatedEntityId,
            title: values.type,
            type: values.type,
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            dueDate: new Date(`${values.dueDate}T00:00:00.000Z`),
            priority: values.priority,
            completed: false,
            notes: values.notes ?? null,
            estimatedDuration: values.estimatedDuration ?? null,
            partsNeeded: values.partsNeeded ? JSON.stringify(values.partsNeeded) : null,
            serviceProvider: values.serviceProvider ?? null,
            costEstimate: values.costEstimate ?? null,
            ownerId: tenant.ownerId,
            teamId: tenant.teamId,
          },
        })
        result = {
          entityType: 'maintenance',
          entityId: task.id,
          before: null,
          after: {
            id: task.id,
            title: task.title,
            type: task.type,
            vehicleId: task.vehicleId,
            vehicleName: task.vehicleName,
            dueDate: task.dueDate.toISOString().slice(0, 10),
            priority: task.priority,
            completed: task.completed,
            notes: task.notes,
            estimatedDuration: task.estimatedDuration,
            partsNeeded: task.partsNeeded ? JSON.parse(task.partsNeeded) : null,
            serviceProvider: task.serviceProvider,
            costEstimate: task.costEstimate,
            ownerId: task.ownerId,
            teamId: task.teamId,
          },
        }
      } else
        throw Object.assign(new Error('This action does not write records'), {
          statusCode: 400,
        })
      const sanitized = JSON.stringify(result)
      await tx.actionExecution.create({
        data: {
          previewNonce: payload.jti,
          ownerId: tenant.ownerId,
          teamId: tenant.teamId,
          proposerId: payload.proposerId,
          confirmerId: session.user.id,
          sourceFindingId: payload.sourceFindingId,
          actionType: action.type,
          result: sanitized,
        },
      })
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          teamId: tenant.teamId,
          userName: session.user.name ?? null,
          userRole: tenant.role,
          action: 'ai_action_confirmed',
          entityType: String(result.entityType),
          entityId: String(result.entityId),
          description: `Confirmed Fleetvera suggested action: ${action.type}`,
          metadata: JSON.stringify({
            proposerId: payload.proposerId,
            confirmerId: session.user.id,
            sourceFindingId: payload.sourceFindingId,
            previewNonce: payload.jti,
            result,
          }),
        },
      })
      return result
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!(await rateLimitMiddleware(req, res, 'api', `assistant-actions:${context.session.user.id}`))) return
  const confirmation = confirmRequest.safeParse(req.body)
  if (confirmation.success) {
    let payload
    try {
      payload = verifyActionPreview(confirmation.data.previewToken, { secrets: keys().secrets })
    } catch (error) {
      return res.status(String(error).includes('expired') ? 410 : 400).json({
        error: String(error).includes('expired') ? 'Action preview expired' : 'Invalid action preview',
      })
    }
    if (payload.ownerId !== context.tenant.ownerId || payload.teamId !== context.tenant.teamId)
      return res.status(403).json({ error: 'Workspace mismatch' })
    if (!canUse(payload.action, context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
    if (
      payload.sourceFindingId &&
      !(await validSourceFinding(
        context.tenant.ownerId,
        context.tenant.teamId,
        payload.sourceFindingId,
        payload.action
      ))
    )
      return res.status(409).json({ error: 'Source finding is no longer available' })
    try {
      return res.status(200).json({ executed: true, result: await execute(payload, context) })
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError || (typeof error === 'object' && error !== null)) &&
        'code' in error &&
        (error.code === 'P2002' || error.code === 'P2034')
      )
        return res.status(409).json({
          error: 'This action was already confirmed or conflicted with another update',
        })
      const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 500
      if (status === 500) console.error('Assistant action failed')
      return res.status(status).json({
        error:
          status === 409
            ? 'Record changed since preview'
            : status === 404
              ? 'Record not found'
              : 'Action could not be completed',
      })
    }
  }
  const parsed = previewRequest.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid suggested action' })
  const { action, sourceFindingId } = parsed.data
  if (!canUse(action, context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  const isWrite = action.type === 'create_maintenance_task' || action.type === 'update_delivery_status'
  if (isWrite && !sourceFindingId)
    return res.status(400).json({
      error: 'A current source finding is required for record changes',
    })
  if (
    sourceFindingId &&
    !(await validSourceFinding(context.tenant.ownerId, context.tenant.teamId, sourceFindingId, action))
  )
    return res.status(404).json({ error: 'Source finding not found' })
  const before = await loadBefore(action, context.tenant.resourceWhere)
  if (before === null) return res.status(404).json({ error: 'Record not found' })
  if (action.type === 'update_delivery_status' && before.updatedAt !== action.expectedUpdatedAt)
    return res.status(409).json({ error: 'Record changed since suggestion' })
  if (action.type === 'create_maintenance_task' && before.vehicleUpdatedAt !== action.expectedVehicleUpdatedAt)
    return res.status(409).json({ error: 'Record changed since suggestion' })
  if (action.type === 'open_edit' || action.type === 'draft_weekly_summary') {
    const sourceSuggestion =
      action.type === 'open_edit'
        ? {
            type: 'record' as const,
            id: `${action.entityType}:${action.entityId}`,
          }
        : { type: 'assistant_answer' as const, id: 'weekly-fleet-summary' }
    const keyRing = keys()
    const issued = createActionPreview(
      {
        action,
        proposerId: context.session.user.id,
        ownerId: context.tenant.ownerId,
        teamId: context.tenant.teamId,
        sourceSuggestion,
        before,
      },
      { secret: keyRing.currentSecret, kid: keyRing.currentKid }
    )
    await prisma.auditLog.create({
      data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name ?? null,
        userRole: context.tenant.role,
        action: 'ai_action_suggested',
        entityType: sourceSuggestion.type,
        entityId: sourceSuggestion.id,
        description: `Opened Fleetvera suggestion: ${action.type}`,
        metadata: JSON.stringify({
          sourceSuggestion,
          previewNonce: verifyActionPreview(issued.token, { secrets: keyRing.secrets }).jti,
          actionType: action.type,
        }),
      },
    })
    if (action.type === 'open_edit')
      return res.status(200).json({
        requiresConfirmation: false,
        provenanceToken: issued.token,
        preview: {
          kind: 'navigation',
          label: issued.preview.label,
          before,
          after: action.values,
        },
        href: safeEditHref(action),
      })
    return res.status(200).json({
      requiresConfirmation: false,
      provenanceToken: issued.token,
      preview: {
        kind: 'read',
        label: 'Draft weekly fleet summary',
        before: {},
        after: { ...before, persistence: 'Not saved; copy this draft.' },
      },
    })
  }
  const signedAction =
    action.type === 'create_maintenance_task'
      ? {
          ...action,
          values: { ...action.values, vehicle: String(before.vehicle) },
        }
      : action
  try {
    const keyRing = keys()
    const issued = createActionPreview(
      {
        action: signedAction,
        proposerId: context.session.user.id,
        ownerId: context.tenant.ownerId,
        teamId: context.tenant.teamId,
        sourceFindingId,
        before,
      },
      { secret: keyRing.currentSecret, kid: keyRing.currentKid }
    )
    return res.status(200).json({ requiresConfirmation: true, ...issued })
  } catch {
    return res.status(503).json({ error: 'Suggested actions are not configured' })
  }
}
