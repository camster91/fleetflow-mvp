import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const task = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: { vehicle: { select: { name: true } } },
    })
    if (!task) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToMaintenanceTask(task))
  }

  if (req.method === 'PUT') {
    const existing = await prisma.maintenanceTask.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    let vehicleId: string | undefined = req.body.vehicleId || existing.vehicleId || undefined
    if (!vehicleId && req.body.vehicle) {
      const v = await prisma.vehicle.findFirst({ where: { name: req.body.vehicle } })
      vehicleId = v?.id
    }
    const { ownerId: _o, ...fields } = maintenanceTaskToDb(req.body, userId, vehicleId) as any
    const wasCompleted = req.body.completed === true && !existing.completed
    const task = await prisma.maintenanceTask.update({ where: { id }, data: fields })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: wasCompleted ? 'completed' : 'updated',
      entityType: 'maintenance', entityId: id, entityName: task.title,
      description: wasCompleted
        ? `Maintenance "${task.title}" for ${task.vehicleName ?? 'vehicle'} was completed`
        : `Maintenance task "${task.title}" was updated`,
    })
    return res.json(dbToMaintenanceTask(task))
  }

  if (req.method === 'DELETE') {
    const task = await prisma.maintenanceTask.findUnique({ where: { id } })
    if (!task) return res.status(404).json({ error: 'Not found' })
    await prisma.maintenanceTask.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'maintenance', entityId: id, entityName: task.title,
      description: `Maintenance task "${task.title}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
