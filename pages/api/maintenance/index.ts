import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'
import { parseBody, maintenanceCreateValuesSchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageMaintenance, canViewMaintenance } from '../../../lib/permissions'
import { assignedMaintenanceWhere, driverMaintenanceDto, isDriverRole } from '../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const where=assignedMaintenanceWhere(tenant.resourceWhere,tenant.role,userId)
    const [tasks, total] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: { vehicle: { select: { name: true } } },
        skip,
        take: limit,
      }),
      prisma.maintenanceTask.count({ where }),
    ])
    return res.json({ data: tasks.map(task=>isDriverRole(tenant.role)?driverMaintenanceDto(task):dbToMaintenanceTask(task)), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseBody(maintenanceCreateValuesSchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const body = parsed.data

    const v = await prisma.vehicle.findFirst({ where: { AND: [{ name: body.vehicle }, tenant.resourceWhere] } })
    const vehicleId = v?.id
    const data = {
      ...maintenanceTaskToDb(body, tenant.ownerId, vehicleId),
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceTask.create({ data })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'created', entityType: 'maintenance',
        entityId: created.id, entityName: created.title,
        description: `Maintenance task "${created.title}" scheduled for ${created.vehicleName ?? 'unknown vehicle'}`,
      })
      return created
    })
    return res.status(201).json(dbToMaintenanceTask(task))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
