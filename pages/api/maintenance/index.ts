import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const tasks = await prisma.maintenanceTask.findMany({
      orderBy: { dueDate: 'asc' },
      include: { vehicle: { select: { name: true } } },
    })
    return res.json(tasks.map(dbToMaintenanceTask))
  }

  if (req.method === 'POST') {
    const userId = (session.user as any).id
    // Try to resolve vehicleId from name if not provided
    let vehicleId: string | undefined = req.body.vehicleId
    if (!vehicleId && req.body.vehicle) {
      const v = await prisma.vehicle.findFirst({ where: { name: req.body.vehicle } })
      vehicleId = v?.id
    }
    const data = maintenanceTaskToDb(req.body, userId, vehicleId)
    const task = await prisma.maintenanceTask.create({ data })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'maintenance',
      entityId: task.id, entityName: task.title,
      description: `Maintenance task "${task.title}" scheduled for ${task.vehicleName ?? 'unknown vehicle'}`,
    })
    return res.status(201).json(dbToMaintenanceTask(task))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
