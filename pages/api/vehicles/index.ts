import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'
import { parseBody, vehicleBodySchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canAssignDrivers, canManageVehicles, canViewVehicles } from '../../../lib/permissions'
import { resolveDriverAssignment } from '../../../lib/driverAssignment'
import { assignedResourceWhere, driverVehicleDto, isDriverRole } from '../../../lib/driverScope'
import { beginIdempotentRequest } from '../../../lib/idempotency'
import { parseListQuery, scopedWhere, VEHICLE_LIST_SPEC } from '../../../lib/listQuery'
import type { Prisma } from '@prisma/client'

/** Whole-scope counts for the list page stat cards (independent of search/filters/page). */
async function vehicleSummary(scope: object) {
  const [total, active, maintenanceDue, mileage] = await Promise.all([
    prisma.vehicle.count({ where: scope }),
    prisma.vehicle.count({ where: scopedWhere(scope, [{ status: 'active' }]) }),
    prisma.vehicle.count({ where: scopedWhere(scope, [{ maintenanceDue: true }]) }),
    prisma.vehicle.aggregate({ where: scope, _avg: { mileage: true } }),
  ])
  return { total, active, maintenanceDue, averageMileage: Math.round(mileage._avg.mileage ?? 0) }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseListQuery(req.query, VEHICLE_LIST_SPEC)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const { page, limit, skip, conditions, orderBy } = parsed.value

    const scope=assignedResourceWhere(tenant.resourceWhere,tenant.role,userId)
    const where = scopedWhere(scope, conditions)
    const [vehicles, total, summary] = await Promise.all([
      prisma.vehicle.findMany({ where, orderBy: orderBy as Prisma.VehicleOrderByWithRelationInput[], skip, take: limit }),
      prisma.vehicle.count({ where }),
      parsed.value.summary ? vehicleSummary(scope) : undefined,
    ])
    return res.json({ data: vehicles.map(item=>isDriverRole(tenant.role)?driverVehicleDto(item):dbToVehicle(item)), total, page, limit, hasMore: skip + limit < total, ...(summary ? { summary } : {}) })
  }

  if (req.method === 'POST') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const idempotency = await beginIdempotentRequest(req, res, { tenant, userId, route: 'POST /api/vehicles' })
    if (!idempotency.proceed) return
    const parsed = parseBody(vehicleBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    if (Object.prototype.hasOwnProperty.call(req.body, 'assignedDriverId') && !canAssignDrivers(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    let assignment
    try { assignment = await resolveDriverAssignment(prisma, tenant, parsed.data.assignedDriverId) } catch { return res.status(400).json({ error: 'Invalid driver assignment' }) }
    const data = {
      ...vehicleToDb({ ...req.body, ...parsed.data, driver: assignment.driver }, tenant.ownerId), ...assignment,
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const vehicle = await prisma.$transaction(async (tx) => {
      const created = await tx.vehicle.create({ data })
      await logActivity(tx, {
        userId,
        teamId: tenant.teamId,
        userName: session.user.name,
        userRole: tenant.role,
        action: 'created',
        entityType: 'vehicle',
        entityId: created.id,
        entityName: created.name,
        description: `Vehicle "${created.name}" was added to the fleet`,
      })
      await idempotency.store(tx, 201, dbToVehicle(created))
      return created
    }).catch(idempotency.replayOnConflict)
    if (!vehicle) return
    return res.status(201).json(dbToVehicle(vehicle))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
