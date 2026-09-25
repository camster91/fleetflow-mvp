import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import {
  deliveryEditPrefillSchema,
  deliveryStatusUpdateSchema,
  maintenanceCreateValuesSchema,
  vehicleEditPrefillSchema,
} from '@/lib/validation'
import { applyDeliveryStatusTransition } from '@/lib/deliveryTransitions'

const maintenanceActionSchema = z
  .object({
    type: z.literal('create_maintenance_task'),
    vehicleId: z.string().min(1).max(64),
    values: maintenanceCreateValuesSchema,
    expectedVehicleUpdatedAt: z.string().datetime(),
  })
  .strict()
const deliveryActionSchema = z
  .object({
    type: z.literal('update_delivery_status'),
    deliveryId: z.string().min(1).max(64),
    values: deliveryStatusUpdateSchema,
    expectedUpdatedAt: z.string().datetime(),
  })
  .strict()
const summaryActionSchema = z.object({ type: z.literal('draft_weekly_summary') }).strict()
const editActionSchema = z.union([
  z
    .object({
      type: z.literal('open_edit'),
      entityType: z.literal('vehicle'),
      entityId: z.string().min(1).max(64),
      values: vehicleEditPrefillSchema.default({}),
    })
    .strict(),
  z
    .object({
      type: z.literal('open_edit'),
      entityType: z.literal('delivery'),
      entityId: z.string().min(1).max(64),
      values: deliveryEditPrefillSchema.default({}),
    })
    .strict(),
])

export const suggestedActionSchema = z.union([
  maintenanceActionSchema,
  deliveryActionSchema,
  summaryActionSchema,
  editActionSchema,
])
export type SuggestedAction = z.infer<typeof suggestedActionSchema>

const sourceSuggestionSchema = z
  .object({ type: z.enum(['assistant_answer', 'record']), id: z.string().min(1).max(160) })
  .strict()
const payloadSchema = z
  .object({
    jti: z.string().min(1).max(100),
    proposerId: z.string().min(1).max(64),
    ownerId: z.string().min(1).max(64),
    teamId: z.string().max(64).nullable(),
    sourceFindingId: z.string().max(100).nullable(),
    sourceSuggestion: sourceSuggestionSchema.nullable(),
    generatedEntityId: z.string().max(64).nullable(),
    action: suggestedActionSchema,
    issuedAt: z.number().int(),
    expiresAt: z.number().int(),
  })
  .strict()
export type ActionPreviewPayload = z.infer<typeof payloadSchema>

const encode = (value: string) => Buffer.from(value).toString('base64url')
const signature = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url')

export function parseActionPreviewKeyRing(env: Record<string, string | undefined>) {
  const fail = (): never => {
    throw new Error('Action preview key ring is not configured')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(env.ACTION_PREVIEW_KEYS ?? '')
  } catch {
    return fail()
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail()
  const entries = Object.entries(parsed as Record<string, unknown>)
  if (entries.length < 1 || entries.length > 3) return fail()
  const secrets: Record<string, string> = {}
  const seen = new Set<string>()
  for (const [kid, value] of entries) {
    if (
      !/^[A-Za-z0-9_-]{1,40}$/.test(kid) ||
      typeof value !== 'string' ||
      Buffer.byteLength(value) < 32 ||
      seen.has(value)
    )
      return fail()
    secrets[kid] = value
    seen.add(value)
  }
  const currentKid = env.ACTION_PREVIEW_CURRENT_KID
  if (!currentKid || !secrets[currentKid]) return fail()
  return { currentKid, currentSecret: secrets[currentKid], secrets }
}

export function actionPreview(
  action: SuggestedAction,
  before: Record<string, unknown> = {},
  generatedEntityId?: string | null,
  ownerId?: string,
  teamId?: string | null,
  issuedAt = new Date()
) {
  if (action.type === 'draft_weekly_summary')
    return {
      kind: 'read' as const,
      label: 'Draft weekly fleet summary',
      before: {},
      after: { result: 'A non-persisted summary ready to copy or download' },
    }
  if (action.type === 'open_edit')
    return { kind: 'navigation' as const, label: `Open ${action.entityType} edit screen`, before, after: action.values }
  if (action.type === 'create_maintenance_task')
    return {
      kind: 'write' as const,
      label: 'Create suggested maintenance task',
      before,
      after: {
        id: generatedEntityId,
        title: action.values.type,
        type: action.values.type,
        vehicleId: action.vehicleId,
        vehicleName: action.values.vehicle,
        dueDate: action.values.dueDate,
        priority: action.values.priority,
        completed: false,
        notes: action.values.notes ?? null,
        estimatedDuration: action.values.estimatedDuration ?? null,
        partsNeeded: action.values.partsNeeded ?? null,
        serviceProvider: action.values.serviceProvider ?? null,
        costEstimate: action.values.costEstimate ?? null,
        ownerId,
        teamId: teamId ?? null,
      },
    }
  const deliveryBefore = {
    status: String(before.status ?? ''),
    notes: (before.notes ?? null) as string | null,
    progress: Number(before.progress ?? 0),
    completedTime: before.completedTime ? new Date(String(before.completedTime)) : null,
  }
  const transition = applyDeliveryStatusTransition(deliveryBefore, action.values, issuedAt)
  return {
    kind: 'write' as const,
    label: 'Apply suggested delivery status',
    before: { ...deliveryBefore, completedTime: deliveryBefore.completedTime?.toISOString() ?? null },
    after: { ...transition.fields, completedTime: transition.fields.completedTime?.toISOString() ?? null },
  }
}

export function createActionPreview(
  input: {
    action: unknown
    proposerId: string
    ownerId: string
    teamId: string | null
    sourceFindingId?: string | null
    sourceSuggestion?: { type: 'assistant_answer' | 'record'; id: string } | null
    before?: Record<string, unknown>
  },
  options: { secret: string; kid?: string; now?: Date; nonce?: string }
) {
  if (Buffer.byteLength(options.secret) < 32) throw new Error('Action preview secret is not configured')
  const action = suggestedActionSchema.parse(input.action)
  const now = (options.now ?? new Date()).getTime()
  const generatedEntityId =
    action.type === 'create_maintenance_task' ? `mt_${randomBytes(18).toString('base64url')}` : null
  const payload: ActionPreviewPayload = {
    jti: options.nonce ?? randomBytes(18).toString('base64url'),
    proposerId: input.proposerId,
    ownerId: input.ownerId,
    teamId: input.teamId,
    sourceFindingId: input.sourceFindingId ?? null,
    sourceSuggestion: input.sourceSuggestion ? sourceSuggestionSchema.parse(input.sourceSuggestion) : null,
    generatedEntityId,
    action,
    issuedAt: now,
    expiresAt: now + 5 * 60_000,
  }
  const body = encode(JSON.stringify(payload))
  const kid = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/)
    .parse(options.kid ?? 'v1')
  return {
    token: `${kid}.${body}.${signature(`${kid}.${body}`, options.secret)}`,
    preview: actionPreview(action, input.before, generatedEntityId, input.ownerId, input.teamId, new Date(now)),
  }
}

export function verifyActionPreview(
  token: string,
  options: { secret?: string; secrets?: Record<string, string>; now?: Date }
): ActionPreviewPayload {
  const [kid, body, supplied, extra] = token.split('.')
  const secret = options.secrets?.[kid] ?? (kid === 'v1' ? options.secret : undefined)
  if (!kid || !body || !supplied || extra || !secret || Buffer.byteLength(secret) < 32)
    throw new Error('Invalid action preview')
  const expected = signature(`${kid}.${body}`, secret)
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid action preview')
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    throw new Error('Invalid action preview')
  }
  const payload = payloadSchema.parse(parsed)
  const now = (options.now ?? new Date()).getTime()
  if (
    payload.issuedAt > now ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > 5 * 60_000
  )
    throw new Error('Invalid action preview')
  if (now > payload.expiresAt) throw new Error('Action preview expired')
  return payload
}

export function safeEditHref(action: Extract<SuggestedAction, { type: 'open_edit' }>): string {
  const base = action.entityType === 'vehicle' ? '/vehicles' : '/deliveries'
  const params = new URLSearchParams({ edit: action.entityId })
  for (const [key, value] of Object.entries(action.values)) params.set(key, String(value ?? ''))
  return `${base}?${params.toString()}`
}
