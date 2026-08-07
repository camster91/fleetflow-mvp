import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { notifyMaintenanceDue } from '../../../lib/email.server'
import { createNotification } from '../../../lib/notifications'
import { constantTimeCompare } from '../../../lib/tokens'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = req.headers['x-cron-secret']
  const configuredSecret = process.env.CRON_SECRET
  if (typeof cronSecret !== 'string' || !configuredSecret || !constantTimeCompare(cronSecret, configuredSecret)) {
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

    // Create notifications in parallel
    await Promise.all(
      tasks.map((task) =>
        createNotification({
          userId: task.ownerId,
          type: 'MAINTENANCE_DUE',
          title: 'Maintenance Reminder',
          message: `"${task.title}" for ${task.vehicleName || 'vehicle'} is due on ${task.dueDate.toLocaleDateString()}`,
          data: { taskId: task.id, vehicleName: task.vehicleName, dueDate: task.dueDate },
        })
      )
    )

    // Send emails in parallel (best-effort)
    await Promise.allSettled(
      tasks
        .filter((task) => !!task.owner.email)
        .map((task) => {
          const vehicleInfo = { name: task.vehicleName || 'Unknown Vehicle' }
          return notifyMaintenanceDue(vehicleInfo, [task.title], [task.owner.email!])
        })
    )

    // Mark all reminders sent in one updateMany
    await prisma.maintenanceTask.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data: { reminderSentAt: now },
    })

    return res.status(200).json({
      success: true,
      remindersSent: tasks.length,
    })
  } catch (error) {
    console.error('Maintenance reminder cron error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
