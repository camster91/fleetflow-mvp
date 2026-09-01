import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { notifyMaintenanceDue } from '../../../lib/email.server'
import { isAuthorizedCronRequest } from '../../../lib/cronAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const tasks = await prisma.maintenanceTask.findMany({
      where: {
        completed: false,
        dueDate: { gte: now, lte: sevenDaysFromNow },
        reminderSentAt: null,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        vehicle: { select: { name: true } },
      },
      take: 200,
      orderBy: { dueDate: 'asc' },
    })

    if (tasks.length === 0) {
      return res.status(200).json({ success: true, remindersSent: 0 })
    }

    // Atomically claim each task and create its durable in-app notification.
    // A concurrent invocation can observe the same candidate list, but only one
    // transaction can change reminderSentAt from null.
    const claims = await Promise.all(
      tasks.map((task) =>
        prisma.$transaction(async (tx) => {
          const claimed = await tx.maintenanceTask.updateMany({
            where: {
              id: task.id,
              completed: false,
              reminderSentAt: null,
            },
            data: { reminderSentAt: now },
          })
          if (claimed.count !== 1) return false

          await tx.notification.create({
            data: {
              userId: task.ownerId,
              type: 'MAINTENANCE_DUE',
              title: 'Maintenance Reminder',
              message: `"${task.title}" for ${task.vehicleName || 'vehicle'} is due on ${task.dueDate.toLocaleDateString()}`,
              data: JSON.stringify({
                taskId: task.id,
                vehicleName: task.vehicleName,
                dueDate: task.dueDate,
              }),
            },
          })
          return true
        })
      )
    )
    const claimedTasks = tasks.filter((_, index) => claims[index])

    // Email remains best-effort, but only the invocation that claimed a task
    // can enqueue its email.
    await Promise.allSettled(
      claimedTasks
        .filter((task) => !!task.owner.email)
        .map((task) => {
          const vehicleInfo = { name: task.vehicleName || 'Unknown Vehicle' }
          return notifyMaintenanceDue(vehicleInfo, [task.title], [task.owner.email!])
        })
    )

    return res.status(200).json({
      success: true,
      remindersSent: claimedTasks.length,
    })
  } catch (error) {
    console.error('Maintenance reminder cron error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
