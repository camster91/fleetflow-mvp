import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'
import { parseBody, maintenanceBodySchema } from '../../../lib/validation'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageMaintenance, canViewMaintenance } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where: tenant.resourceWhere,
        orderBy: { dueDate: 'asc' },
        include: { vehicle: { select: { name: true } } },
        skip,
        take: limit,
      }),
      prisma.maintenanceTask.count({ where: tenant.resourceWhere }),
    ])
    return res.json({ data: tasks.map(dbToMaintenanceTask), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseBody(maintenanceBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const body = { ...req.body, ...parsed.data }

    let vehicleId: string | undefined = body.vehicleId
    if (vehicleId) {
      const owned = await prisma.vehicle.findFirst({ where: { AND: [{ id: vehicleId }, tenant.resourceWhere] }, select: { id: true } })
      if (!owned) return res.status(400).json({ error: 'Invalid vehicle' })
    } else if (body.vehicle) {
      const v = await prisma.vehicle.findFirst({ where: { AND: [{ name: body.vehicle }, tenant.resourceWhere] } })
      vehicleId = v?.id
    }
    const data = {
      ...maintenanceTaskToDb(body, tenant.ownerId, vehicleId),
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const task = await prisma.maintenanceTask.create({ data })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'created', entityType: 'maintenance',
      entityId: task.id, entityName: task.title,
      description: `Maintenance task "${task.title}" scheduled for ${task.vehicleName ?? 'unknown vehicle'}`,
    })
    return res.status(201).json(dbToMaintenanceTask(task))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
