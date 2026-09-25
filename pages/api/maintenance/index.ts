import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity } from '../../../lib/fleet'
import { parseBody, maintenanceCreateValuesSchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageMaintenance, canViewMaintenance } from '../../../lib/permissions'
import { assignedMaintenanceWhere, driverMaintenanceDto, isDriverRole } from '../../../lib/driverScope'
import { beginIdempotentRequest } from '../../../lib/idempotency'
import { addDays, MAINTENANCE_LIST_SPEC, parseDueRange, parseListQuery, scopedWhere } from '../../../lib/listQuery'
import type { Prisma } from '@prisma/client'

/** Whole-scope counts for the list page stat cards, relative to the caller's `today`. */
async function maintenanceSummary(scope: object, today: Date) {
  const [total, overdue, dueThisWeek, completed] = await Promise.all([
    prisma.maintenanceTask.count({ where: scope }),
    prisma.maintenanceTask.count({ where: scopedWhere(scope, [{ completed: false, dueDate: { lt: today } }]) }),
    prisma.maintenanceTask.count({
      where: scopedWhere(scope, [{ completed: false, dueDate: { gte: today, lt: addDays(today, 8) } }]),
    }),
    prisma.maintenanceTask.count({ where: scopedWhere(scope, [{ completed: true }]) }),
  ])
  return { total, overdue, dueThisWeek, completed }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseListQuery(req.query, MAINTENANCE_LIST_SPEC)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const range = parseDueRange(req.query)
    if (!range.ok) return res.status(400).json({ error: range.error })
    const { page, limit, skip, conditions, orderBy, today } = parsed.value

    const scope = assignedMaintenanceWhere(tenant.resourceWhere, tenant.role, userId)
    const where = scopedWhere(scope, range.value ? [...conditions, range.value] : conditions)
    const [tasks, total, summary] = await Promise.all([
      prisma.maintenanceTask.findMany({
        where,
        orderBy: orderBy as Prisma.MaintenanceTaskOrderByWithRelationInput[],
        include: { vehicle: { select: { name: true } } },
        skip,
        take: limit,
      }),
      prisma.maintenanceTask.count({ where }),
      parsed.value.summary ? maintenanceSummary(scope, today) : undefined,
    ])
    return res.json({
      data: tasks.map((task) => (isDriverRole(tenant.role) ? driverMaintenanceDto(task) : dbToMaintenanceTask(task))),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
      ...(summary ? { summary } : {}),
    })
  }

  if (req.method === 'POST') {
    if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const idempotency = await beginIdempotentRequest(req, res, { tenant, userId, route: 'POST /api/maintenance' })
    if (!idempotency.proceed) return
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
    const task = await prisma
      .$transaction(async (tx) => {
        const created = await tx.maintenanceTask.create({ data })
        await logActivity(tx, {
          userId,
          teamId: tenant.teamId,
          userName: session.user.name,
          userRole: tenant.role,
          action: 'created',
          entityType: 'maintenance',
          entityId: created.id,
          entityName: created.title,
          description: `Maintenance task "${created.title}" scheduled for ${created.vehicleName ?? 'unknown vehicle'}`,
        })
        await idempotency.store(tx, 201, dbToMaintenanceTask(created))
        return created
      })
      .catch(idempotency.replayOnConflict)
    if (!task) return
    return res.status(201).json(dbToMaintenanceTask(task))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
