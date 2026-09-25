import { NextApiRequest, NextApiResponse } from 'next'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { notifyMaintenanceDue } from '../../../lib/email.server'
import { isAuthorizedCronRequest } from '../../../lib/cronAuth'
import { startOfUtcDay, toDateOnly } from '../../../lib/dateOnly'

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
 * - due soon: due between the start of today (UTC) and the end of the 7th day
 *   ahead, and reminderSentAt is unset. Claiming sets reminderSentAt.
 * - overdue: due before the start of today (UTC) and no overdue reminder since
 *   the due date (overdueReminderSentAt unset, or older than a rescheduled due
 *   date). Claiming sets overdueReminderSentAt. A separate column means a task
 *   reminded on its due day still gets its one overdue reminder later.
 *
 * Date-only due dates are stored at UTC midnight (lib/dateOnly.ts), so "today"
 * is the current UTC day. A per-workspace time zone is a follow-up.
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const startOfToday = startOfUtcDay(now)
    const dueSoonEnd = new Date(startOfToday.getTime() + (DUE_SOON_DAYS + 1) * DAY_MS)
    const include = {
      owner: { select: { id: true, email: true, name: true } },
      vehicle: { select: { name: true } },
    } as const

    const overdue = await prisma.maintenanceTask.findMany({
      where: {
        completed: false,
        dueDate: { lt: startOfToday },
        ...reminderConditions('overdue'),
      },
      include,
      take: CANDIDATE_LIMIT,
      orderBy: { dueDate: 'asc' },
    })
    const dueSoon = await prisma.maintenanceTask.findMany({
      where: {
        completed: false,
        dueDate: { gte: startOfToday, lt: dueSoonEnd },
        ...reminderConditions('due_soon'),
      },
      include,
      take: CANDIDATE_LIMIT,
      orderBy: { dueDate: 'asc' },
    })

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
