import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'
import { parseBody, vehicleBodySchema } from '../../../lib/validation'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canAssignDrivers, canManageVehicles, canViewVehicles } from '../../../lib/permissions'
import { resolveDriverAssignment } from '../../../lib/driverAssignment'
import { assignedResourceWhere, driverVehicleDto, isDriverRole } from '../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const where=assignedResourceWhere(tenant.resourceWhere,tenant.role,userId)
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take: limit }),
      prisma.vehicle.count({ where }),
    ])
    return res.json({ data: vehicles.map(item=>isDriverRole(tenant.role)?driverVehicleDto(item):dbToVehicle(item)), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
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
    const vehicle = await prisma.vehicle.create({ data })
    await logActivity(prisma, {
      userId,
      teamId: tenant.teamId,
      userName: session.user.name,
      userRole: tenant.role,
      action: 'created',
      entityType: 'vehicle',
      entityId: vehicle.id,
      entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was added to the fleet`,
    })
    return res.status(201).json(dbToVehicle(vehicle))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
