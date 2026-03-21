import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { notifyMaintenanceDue } from '../../../lib/email.server'
import { createNotification } from '../../../lib/notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify cron secret
  const cronSecret = req.headers['x-cron-secret']
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Find upcoming maintenance tasks that haven't had reminders sent
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
    })

    let sentCount = 0

    for (const task of tasks) {
      // Create in-app notification
      await createNotification({
        userId: task.ownerId,
        type: 'MAINTENANCE_DUE',
        title: 'Maintenance Reminder',
        message: `"${task.title}" for ${task.vehicleName || 'vehicle'} is due on ${task.dueDate.toLocaleDateString()}`,
        data: { taskId: task.id, vehicleName: task.vehicleName, dueDate: task.dueDate },
      })

      // Send email reminder
      if (task.owner.email) {
        const vehicleInfo = { name: task.vehicleName || 'Unknown Vehicle' }
        await notifyMaintenanceDue(vehicleInfo, [task.title], [task.owner.email])
      }

      // Mark reminder as sent
      await prisma.maintenanceTask.update({
        where: { id: task.id },
        data: { reminderSentAt: now },
      })

      sentCount++
    }

    return res.status(200).json({
      success: true,
      remindersSent: sentCount,
    })
  } catch (error) {
    console.error('Maintenance reminder cron error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
