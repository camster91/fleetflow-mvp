import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where: { ownerId: userId },
        orderBy: { dueDate: 'asc' },
        include: { vehicle: { select: { name: true } } },
        skip,
        take: limit,
      }),
      prisma.maintenanceTask.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: tasks.map(dbToMaintenanceTask), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    const userId = (session.user as any).id
    // Resolve vehicle only within the caller's ownership scope (prevents cross-tenant attach)
    let vehicleId: string | undefined = req.body.vehicleId
    if (vehicleId) {
      const owned = await prisma.vehicle.findFirst({ where: { id: vehicleId, ownerId: userId }, select: { id: true } })
      if (!owned) return res.status(400).json({ error: 'Invalid vehicle' })
    } else if (req.body.vehicle) {
      const v = await prisma.vehicle.findFirst({ where: { name: req.body.vehicle, ownerId: userId } })
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
