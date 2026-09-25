import { NextApiRequest, NextApiResponse } from 'next'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { notifyMaintenanceDue } from '../../../lib/email.server'
import { isAuthorizedCronRequest } from '../../../lib/cronAuth'
import { DEFAULT_TIME_ZONE, normalizeTimeZone, startOfTodayInZone, toDateOnly } from '../../../lib/dateOnly'

const DAY_MS = 24 * 60 * 60 * 1000
const DUE_SOON_DAYS = 7
const CANDIDATE_LIMIT = 200
// Claims run in small sequential batches so one run never holds more than this
// many pooled connections (Promise.all over 200 transactions could exhaust the
// pool with P2024).
const CLAIM_BATCH_SIZE = 10

type ReminderKind = 'due_soon' | 'overdue'

/**
 * Dedupe rules (at most one reminder of each kind per task):
 * - due soon: due between today and the end of the 7th day ahead, and
 *   reminderSentAt is unset. Claiming sets reminderSentAt.
 * - overdue: due before today and no overdue reminder since
 *   the due date (overdueReminderSentAt unset, or older than a rescheduled due
 *   date). Claiming sets overdueReminderSentAt. A separate column means a task
 *   reminded on its due day still gets its one overdue reminder later.
 *
 * Date-only due dates are stored at UTC midnight (lib/dateOnly.ts). "Today" is
 * the calendar day in each task's workspace time zone (Team.timeZone, or the
 * owner's User.timeZone for personal tasks), so tasks are grouped by the local
 * day their zone is currently on.
 */
function reminderConditions(kind: ReminderKind): Prisma.MaintenanceTaskWhereInput {
  if (kind === 'due_soon') return { reminderSentAt: null }
  return {
    OR: [
      { overdueReminderSentAt: null },
      { overdueReminderSentAt: { lt: prisma.maintenanceTask.fields.dueDate } },
    ],
  }
}

async function claimAndNotify(
  task: { id: string; ownerId: string; title: string; vehicleName: string | null; dueDate: Date },
  kind: ReminderKind,
  now: Date,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.maintenanceTask.updateMany({
      where: { id: task.id, completed: false, ...reminderConditions(kind) },
      data: kind === 'overdue' ? { overdueReminderSentAt: now } : { reminderSentAt: now },
    })
    if (claimed.count !== 1) return false

    const dueDay = toDateOnly(task.dueDate)
    const vehicle = task.vehicleName || 'vehicle'
    await tx.notification.create({
      data: {
        userId: task.ownerId,
        type: 'MAINTENANCE_DUE',
        title: kind === 'overdue' ? 'Maintenance Overdue' : 'Maintenance Reminder',
        message: kind === 'overdue'
          ? `"${task.title}" for ${vehicle} was due on ${dueDay} and is overdue`
          : `"${task.title}" for ${vehicle} is due on ${dueDay}`,
        data: JSON.stringify({
          taskId: task.id,
          vehicleName: task.vehicleName,
          dueDate: dueDay,
          reminder: kind,
        }),
      },
    })
    return true
  })
}

/**
 * Tasks whose workspace zone is one of `zones`. `unknownZonesExcept`, when set,
 * also matches stored zones outside that list (invalid values), which are
 * treated as the default zone.
 */
function workspaceZoneScope(zones: string[], unknownZonesExcept: string[] | null): Prisma.MaintenanceTaskWhereInput {
  const scopes: Prisma.MaintenanceTaskWhereInput[] = [
    { team: { timeZone: { in: zones } } },
    { teamId: null, owner: { timeZone: { in: zones } } },
  ]
  if (unknownZonesExcept) {
    scopes.push(
      { team: { timeZone: { notIn: unknownZonesExcept } } },
      { teamId: null, owner: { timeZone: { notIn: unknownZonesExcept } } },
    )
  }
  return { OR: scopes }
}

/**
 * Group the zones in use by the calendar day each is currently on. At any
 * instant all zones span at most three local days, so this is a handful of
 * queries rather than one per workspace.
 */
async function zoneGroupsByToday(now: Date) {
  const [teamZones, userZones] = await Promise.all([
    prisma.team.findMany({ distinct: ['timeZone'], select: { timeZone: true } }),
    prisma.user.findMany({ distinct: ['timeZone'], select: { timeZone: true } }),
  ])
  const validZones = new Set<string>([DEFAULT_TIME_ZONE])
  for (const { timeZone } of [...teamZones, ...userZones]) {
    if (normalizeTimeZone(timeZone) === timeZone) validZones.add(timeZone)
  }
  const allValid = [...validZones]

  const groups = new Map<number, { startOfToday: Date; zones: string[] }>()
  for (const zone of allValid) {
    const startOfToday = startOfTodayInZone(zone, now)
    const group = groups.get(startOfToday.getTime()) ?? { startOfToday, zones: [] }
    group.zones.push(zone)
    groups.set(startOfToday.getTime(), group)
  }
  return [...groups.values()].map(({ startOfToday, zones }) => ({
    startOfToday,
    scope: workspaceZoneScope(zones, zones.includes(DEFAULT_TIME_ZONE) ? allValid : null),
  }))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const include = {
      owner: { select: { id: true, email: true, name: true } },
      vehicle: { select: { name: true } },
    } as const

    const overdue = []
    const dueSoon = []
    for (const { startOfToday, scope } of await zoneGroupsByToday(now)) {
      const dueSoonEnd = new Date(startOfToday.getTime() + (DUE_SOON_DAYS + 1) * DAY_MS)
      overdue.push(...await prisma.maintenanceTask.findMany({
        where: {
          AND: [scope, reminderConditions('overdue')],
          completed: false,
          dueDate: { lt: startOfToday },
        },
        include,
        take: CANDIDATE_LIMIT,
        orderBy: { dueDate: 'asc' },
      }))
      dueSoon.push(...await prisma.maintenanceTask.findMany({
        where: {
          AND: [scope, reminderConditions('due_soon')],
          completed: false,
          dueDate: { gte: startOfToday, lt: dueSoonEnd },
        },
        include,
        take: CANDIDATE_LIMIT,
        orderBy: { dueDate: 'asc' },
      }))
    }

    const candidates = [
      ...overdue.map((task) => ({ task, kind: 'overdue' as const })),
      ...dueSoon.map((task) => ({ task, kind: 'due_soon' as const })),
    ]

    let skipped = 0
    let failed = 0
    const claimed: typeof candidates = []
    for (let i = 0; i < candidates.length; i += CLAIM_BATCH_SIZE) {
      const batch = candidates.slice(i, i + CLAIM_BATCH_SIZE)
      const results = await Promise.allSettled(batch.map(({ task, kind }) => claimAndNotify(task, kind, now)))
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          failed += 1
          console.error('Maintenance reminder claim failed:', batch[index].task.id, result.reason)
        } else if (result.value) {
          claimed.push(batch[index])
        } else {
          skipped += 1
        }
      })
    }

    // Email remains best-effort, but only the invocation that claimed a task
    // can enqueue its email.
    await Promise.allSettled(
      claimed
        .filter(({ task }) => !!task.owner.email)
        .map(({ task, kind }) => {
          const vehicleInfo = { name: task.vehicleName || 'Unknown Vehicle' }
          const label = kind === 'overdue' ? `${task.title} (overdue since ${toDateOnly(task.dueDate)})` : task.title
          return notifyMaintenanceDue(vehicleInfo, [label], [task.owner.email!])
        })
    )

    const stats = {
      remindersSent: claimed.length,
      dueSoonSent: claimed.filter(({ kind }) => kind === 'due_soon').length,
      overdueSent: claimed.filter(({ kind }) => kind === 'overdue').length,
      skipped,
      failed,
    }
    console.info('Maintenance reminder cron run:', JSON.stringify(stats))

    return res.status(200).json({ success: true, ...stats })
  } catch (error) {
    console.error('Maintenance reminder cron error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
