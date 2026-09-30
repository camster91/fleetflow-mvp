import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

/**
 * Business models that belong to a workspace through ownerId + teamId. A personal-workspace row has
 * teamId null. Keep in sync with deleteOwnerWorkspaceData in lib/workspaceRetention.ts.
 */
const OWNED_MODELS = [
  'vehicle',
  'delivery',
  'maintenanceTask',
  'client',
  'sOPCategory',
  'vendingMachine',
  'announcement',
  'expenseRecord',
  'intelligenceFinding',
  'intelligenceRun',
  'actionExecution',
] as const

/** Workspace models that also carry a scopeKey (`owner:<id>` / `team:<id>`). */
const OWNED_SCOPED_MODELS = [
  'maintenanceRiskFeedback',
  'documentUpload',
  'integrationConnection',
  'aiWorkspaceConfig',
  'pilotEnrollment',
  'pilotEvent',
  'pilotIncident',
] as const

/** Models keyed only by scopeKey. */
const SCOPE_ONLY_MODELS = ['integrationRateLimit', 'aiControlAudit', 'aiTelemetryBucket'] as const

type UpdateManyDelegate = { updateMany: (args: { where: object; data: object }) => Promise<{ count: number }> }

/**
 * Move everything in a user's personal workspace into their new, empty team workspace. A user's
 * personal workspace is only reachable while they belong to no team (lib/apiAuth.ts
 * resolveTenantContext), so creating a team without this would hide their records. The team is new,
 * so no scopeKey unique constraint can collide.
 */
export async function movePersonalWorkspaceIntoTeam(tx: Tx, ownerId: string, teamId: string) {
  const from = `owner:${ownerId}`
  const to = `team:${teamId}`
  const moved: Record<string, number> = {}
  const client = tx as unknown as Record<string, UpdateManyDelegate>
  for (const model of OWNED_MODELS) {
    moved[model] = (await client[model].updateMany({ where: { ownerId, teamId: null }, data: { teamId } })).count
  }
  for (const model of OWNED_SCOPED_MODELS) {
    moved[model] = (
      await client[model].updateMany({ where: { ownerId, teamId: null }, data: { teamId, scopeKey: to } })
    ).count
  }
  for (const model of SCOPE_ONLY_MODELS) {
    moved[model] = (await client[model].updateMany({ where: { scopeKey: from }, data: { scopeKey: to } })).count
  }
  return moved
}
