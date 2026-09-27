/**
 * Lapsed-workspace retention (#150): a workspace that stays read-only for 90 days is deleted.
 *
 * - Warnings go to the owner and the admins of the owner's teams 30 and 7 days before deletion.
 * - Deletion never happens sooner than 7 days after a 7-day warning was actually delivered; a failed
 *   email or a missed run postpones it.
 * - What is deleted: every business record the owner's workspaces hold (personal and team), the owned
 *   teams and their memberships. What is kept: user accounts and sign-in, the subscription, invoices,
 *   API keys and audit logs (which age out under their own retention).
 * - Dry run unless WORKSPACE_DELETION_ENABLED=true: nothing is sent or deleted, the run reports what
 *   it would do so an operator can review it first.
 * - Right before deleting, the owner's subscription row is locked and the entitlement re-checked, so a
 *   workspace that has just been reactivated is never deleted.
 */
import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { billingEnforced, getWorkspaceEntitlement } from './entitlements'
import { sendWorkspaceDeletionWarningEmail } from './email'

export const DELETION_AFTER_DAYS = 90
const DAY_MS = 86_400_000

type Tx = Prisma.TransactionClient

export type RetentionAction = 'NONE' | 'WARN_30' | 'WARN_7' | 'WAIT' | 'DELETE'

export interface RetentionMarkers {
  warned30At: Date | null
  warned7At: Date | null
}

export function workspaceDeletionEnabled(): boolean {
  return process.env.WORKSPACE_DELETION_ENABLED === 'true'
}

export function deletionDueAt(readOnlySince: Date): Date {
  return new Date(readOnlySince.getTime() + DELETION_AFTER_DAYS * DAY_MS)
}

const addDays = (date: Date | number, days: number) => new Date(new Date(date).getTime() + days * DAY_MS)
const latest = (...dates: Date[]) => new Date(Math.max(...dates.map((date) => date.getTime())))

/**
 * When the workspace may be deleted: 90 days read-only, at least 30 days after the 30-day warning and
 * at least 7 days after the 7-day warning. Null until both warnings were delivered.
 */
export function earliestDeletionAt(readOnlySince: Date, markers: RetentionMarkers | null): Date | null {
  if (!markers?.warned30At || !markers.warned7At) return null
  return latest(deletionDueAt(readOnlySince), addDays(markers.warned30At, 30), addDays(markers.warned7At, 7))
}

/**
 * Pure schedule: what today's run should do for a read-only workspace. The 30-day warning always comes
 * first, so a workspace that lapsed long ago (e.g. before plans were enforced) still gets full notice.
 */
export function planRetention(readOnlySince: Date, markers: RetentionMarkers | null, now: Date): RetentionAction {
  const due = deletionDueAt(readOnlySince)
  if (!markers?.warned30At) return now >= addDays(due, -30) ? 'WARN_30' : 'NONE'
  const noticeEnds = latest(due, addDays(markers.warned30At, 30))
  if (!markers.warned7At) return now >= addDays(noticeEnds, -7) ? 'WARN_7' : 'NONE'
  return now >= earliestDeletionAt(readOnlySince, markers)! ? 'DELETE' : 'WAIT'
}

/** The deletion date a warning sent `now` can honestly promise. */
export function promisedDeletionAt(
  readOnlySince: Date,
  markers: RetentionMarkers | null,
  action: 'WARN_30' | 'WARN_7',
  now: Date
): Date {
  const due = deletionDueAt(readOnlySince)
  if (action === 'WARN_30') return latest(due, addDays(now, 30))
  return latest(due, addDays(markers?.warned30At ?? now, 30), addDays(now, 7))
}

/** Owners whose workspaces hold anything: every team owner, plus personal workspaces with records. */
export async function findWorkspaceOwners(): Promise<string[]> {
  const personal = { teamId: null }
  const groups = await Promise.all([
    prisma.team.findMany({ select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.vehicle.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.delivery.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.maintenanceTask.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.client.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.sOPCategory.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.vendingMachine.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.documentUpload.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.expenseRecord.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.announcement.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.integrationConnection.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.intelligenceFinding.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.intelligenceRun.findMany({ where: personal, select: { ownerId: true }, distinct: ['ownerId'] }),
    prisma.userData
      .findMany({ select: { userId: true }, distinct: ['userId'] })
      .then((rows) => rows.map((row) => ({ ownerId: row.userId }))),
  ])
  return [...new Set(groups.flat().map((row) => row.ownerId))].sort()
}

/**
 * Delete everything the owner's workspaces hold. Children before parents: expenses restrict vehicle
 * deletion, and business rows reference teams with NO ACTION.
 */
export async function deleteOwnerWorkspaceData(tx: Tx, ownerId: string, teamIds: string[]) {
  const scope = { OR: [{ ownerId }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : [])] }
  const scopeKeys = [`owner:${ownerId}`, ...teamIds.map((id) => `team:${id}`)]
  const counts: Record<string, number> = {}
  const run = async (name: string, op: Promise<{ count: number }>) => {
    counts[name] = (await op).count
  }
  await run('taskShareLinks', tx.taskShareLink.deleteMany({ where: { ownerId } }))
  await run('expenses', tx.expenseRecord.deleteMany({ where: scope }))
  await run('maintenanceRiskFeedback', tx.maintenanceRiskFeedback.deleteMany({ where: scope }))
  await run('deliveries', tx.delivery.deleteMany({ where: scope }))
  await run('maintenanceTasks', tx.maintenanceTask.deleteMany({ where: scope }))
  await run('vehicles', tx.vehicle.deleteMany({ where: scope }))
  await run('clients', tx.client.deleteMany({ where: scope }))
  await run('sopCategories', tx.sOPCategory.deleteMany({ where: scope }))
  await run('vendingMachines', tx.vendingMachine.deleteMany({ where: scope }))
  await run('announcements', tx.announcement.deleteMany({ where: scope }))
  await run('intelligenceFindings', tx.intelligenceFinding.deleteMany({ where: scope }))
  await run('intelligenceRuns', tx.intelligenceRun.deleteMany({ where: scope }))
  await run('actionExecutions', tx.actionExecution.deleteMany({ where: scope }))
  await run('aiWorkspaceConfigs', tx.aiWorkspaceConfig.deleteMany({ where: scope }))
  await run('aiControlAudits', tx.aiControlAudit.deleteMany({ where: { scopeKey: { in: scopeKeys } } }))
  await run('aiTelemetryBuckets', tx.aiTelemetryBucket.deleteMany({ where: { scopeKey: { in: scopeKeys } } }))
  await run('integrationConnections', tx.integrationConnection.deleteMany({ where: scope }))
  await run('integrationRateLimits', tx.integrationRateLimit.deleteMany({ where: { scopeKey: { in: scopeKeys } } }))
  await run('pilotEvents', tx.pilotEvent.deleteMany({ where: scope }))
  await run('pilotIncidents', tx.pilotIncident.deleteMany({ where: scope }))
  await run('pilotEnrollments', tx.pilotEnrollment.deleteMany({ where: scope }))
  // Only file-less tombstones remain here: live documents are expired first and removed by document-retention.
  await run('documents', tx.documentUpload.deleteMany({ where: scope }))
  await run('legacyUserData', tx.userData.deleteMany({ where: { userId: ownerId } }))
  await run('teamMembers', tx.teamMember.deleteMany({ where: { teamId: { in: teamIds } } }))
  await run('teams', tx.team.deleteMany({ where: { id: { in: teamIds }, ownerId } }))
  return counts
}

export interface RetentionResult {
  ownerId: string
  action: RetentionAction | 'RESET' | 'WAIT_DOCUMENTS' | 'EMAIL_FAILED' | 'SKIPPED_REACTIVATED' | 'ERROR'
  deletionDueAt?: string
  deleted?: Record<string, number>
}

async function warn(ownerId: string, teams: { id: string; name: string }[], deletionDate: Date) {
  const [owner, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: ownerId }, select: { email: true } }),
    teams.length
      ? prisma.teamMember.findMany({
          where: { teamId: { in: teams.map((team) => team.id) }, role: 'ADMIN', status: 'ACCEPTED' },
          select: { user: { select: { email: true } } },
        })
      : Promise.resolve([]),
  ])
  if (!owner?.email) return false
  const workspaceName = teams.length ? teams.map((team) => team.name).join(', ') : 'Your personal workspace'
  // The owner's notice is the one that must arrive; admins are copied on a best-effort basis.
  const ownerResult = await sendWorkspaceDeletionWarningEmail(owner.email, workspaceName, deletionDate)
  const adminEmails = [...new Set(admins.map((row) => row.user?.email).filter((email): email is string => !!email))]
  await Promise.all(
    adminEmails
      .filter((email) => email !== owner.email)
      .map((email) => sendWorkspaceDeletionWarningEmail(email, workspaceName, deletionDate).catch(() => null))
  )
  return ownerResult.success
}

/**
 * A user who owns no team but belongs to someone else's team cannot reach (or pay for) their personal
 * workspace: tenant resolution only offers teams once a user has one. Their leftover personal data is not
 * deleted on a timer they cannot see or act on.
 */
async function personalWorkspaceUnreachable(db: Pick<Tx, 'team' | 'teamMember'>, ownerId: string) {
  const [owned, memberships] = await Promise.all([
    db.team.count({ where: { ownerId } }),
    db.teamMember.count({ where: { userId: ownerId, status: 'ACCEPTED', team: { ownerId: { not: ownerId } } } }),
  ])
  return owned === 0 && memberships > 0
}

/** Process one owner. Exported for tests; the cron calls it for every owner with workspace data. */
export async function processOwner(ownerId: string, now: Date, dryRun: boolean): Promise<RetentionResult> {
  const entitlement = await getWorkspaceEntitlement(ownerId, now)
  const row = await prisma.workspaceRetention.findUnique({ where: { ownerId } })

  if (
    entitlement.access !== 'READ_ONLY' ||
    !entitlement.readOnlySince ||
    (await personalWorkspaceUnreachable(prisma, ownerId))
  ) {
    if (row && !row.deletedAt && !dryRun) await prisma.workspaceRetention.delete({ where: { ownerId } })
    return { ownerId, action: row && !row.deletedAt ? 'RESET' : 'NONE' }
  }

  const readOnlySince = entitlement.readOnlySince
  const samePeriod = row?.readOnlySince.getTime() === readOnlySince.getTime()
  // Already deleted for this lapse: nothing left to warn about.
  if (row?.deletedAt && samePeriod) return { ownerId, action: 'NONE' }
  const current = row && !row.deletedAt && samePeriod ? row : null
  const action = planRetention(readOnlySince, current, now)
  const scheduled =
    action === 'WARN_30' || action === 'WARN_7' ? promisedDeletionAt(readOnlySince, current, action, now) : null
  const due = scheduled ?? earliestDeletionAt(readOnlySince, current) ?? deletionDueAt(readOnlySince)
  const result: RetentionResult = { ownerId, action, deletionDueAt: due.toISOString() }
  if (dryRun || action === 'NONE' || action === 'WAIT') return result

  if (action === 'WARN_30' || action === 'WARN_7') {
    const teams = await prisma.team.findMany({ where: { ownerId }, select: { id: true, name: true } })
    if (!(await warn(ownerId, teams, scheduled!))) return { ...result, action: 'EMAIL_FAILED' }
    // A stale row (earlier read-only period, or already deleted) is reset rather than reused.
    const markers =
      action === 'WARN_7' ? { warned30At: current!.warned30At, warned7At: now } : { warned30At: now, warned7At: null }
    await prisma.workspaceRetention.upsert({
      where: { ownerId },
      create: { ownerId, readOnlySince, ...markers },
      update: { readOnlySince, deletedAt: null, ...markers },
    })
    return result
  }

  // DELETE: everything is decided again under the lock, so a reactivation cannot interleave.
  const outcome = await prisma.$transaction(
    async (tx) => {
      // Same lock as checkout, plus the subscription row.
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))) AS billing_lock`
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE "userId" = ${ownerId} FOR UPDATE`
      const fresh = await getWorkspaceEntitlement(ownerId, now, tx)
      const marker = await tx.workspaceRetention.findUnique({ where: { ownerId } })
      if (
        fresh.access !== 'READ_ONLY' ||
        fresh.readOnlySince?.getTime() !== readOnlySince.getTime() ||
        !marker ||
        marker.deletedAt ||
        planRetention(readOnlySince, marker, now) !== 'DELETE' ||
        (await personalWorkspaceUnreachable(tx, ownerId))
      )
        return { kind: 'skipped' as const }
      const teamIds = (await tx.team.findMany({ where: { ownerId }, select: { id: true } })).map((team) => team.id)
      // Stored documents go through document-retention first so their files are removed too.
      const docScope = { OR: [{ ownerId }, ...(teamIds.length ? [{ teamId: { in: teamIds } }] : [])], deletedAt: null }
      if ((await tx.documentUpload.count({ where: docScope })) > 0) {
        await tx.documentUpload.updateMany({ where: { ...docScope, expiresAt: { gt: now } }, data: { expiresAt: now } })
        return { kind: 'documents' as const }
      }
      const deleted = await deleteOwnerWorkspaceData(tx, ownerId, teamIds)
      await tx.workspaceRetention.update({ where: { ownerId }, data: { deletedAt: now } })
      await tx.auditLog.create({
        data: {
          userId: ownerId,
          action: 'WORKSPACE_DELETED',
          entityType: 'workspace',
          entityId: ownerId,
          description: `Deleted lapsed workspace data after ${DELETION_AFTER_DAYS} days read-only`,
          metadata: JSON.stringify({ readOnlySince: readOnlySince.toISOString(), teams: teamIds.length, deleted }),
        },
      })
      return { kind: 'deleted' as const, deleted }
    },
    { maxWait: 10_000, timeout: 120_000 }
  )
  if (outcome.kind === 'documents') return { ...result, action: 'WAIT_DOCUMENTS' }
  if (outcome.kind === 'skipped') return { ...result, action: 'SKIPPED_REACTIVATED' }
  return { ...result, deleted: outcome.deleted }
}

export async function runWorkspaceRetention(now = new Date()) {
  if (!billingEnforced()) return { enforced: false as const }
  const dryRun = !workspaceDeletionEnabled()
  const results: RetentionResult[] = []
  for (const ownerId of await findWorkspaceOwners()) {
    try {
      results.push(await processOwner(ownerId, now, dryRun))
    } catch {
      // One owner's failure must not stop the others; the next daily run retries.
      console.error('Workspace retention failed for one owner')
      results.push({ ownerId, action: 'ERROR' })
    }
  }
  const tally = (action: RetentionResult['action']) => results.filter((result) => result.action === action).length
  return {
    enforced: true as const,
    dryRun,
    scanned: results.length,
    warned30: tally('WARN_30'),
    warned7: tally('WARN_7'),
    deleted: results.filter((result) => result.deleted).length,
    waitingOnDocuments: tally('WAIT_DOCUMENTS'),
    emailFailures: tally('EMAIL_FAILED'),
    errors: tally('ERROR'),
    // Only owner IDs and dates: enough for an operator to review a dry run, no personal data.
    actions: results
      .filter((result) => result.action !== 'NONE')
      .map(({ ownerId, action, deletionDueAt }) => ({ ownerId, action, deletionDueAt })),
  }
}
