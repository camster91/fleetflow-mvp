import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canAssignDrivers, canManageVehicles, canViewVehicles } from '../../../lib/permissions'
import { parseBody, vehicleBodySchema } from '../../../lib/validation'
import { resolveDriverAssignment } from '../../../lib/driverAssignment'
import { driverVehicleDto, isDriverRole } from '../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere, ...(isDriverRole(tenant.role)?[{assignedDriverId:userId}]:[])] }

  if (req.method === 'GET') {
    if (!canViewVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const vehicle = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    return res.json(isDriverRole(tenant.role)?driverVehicleDto(vehicle):dbToVehicle(vehicle))
  }

  if (req.method === 'PUT') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const current = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!current) return res.status(404).json({ error: 'Not found' })
    const parsed = parseBody(vehicleBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'assignedDriverId') && !canAssignDrivers(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    let assignment = { assignedDriverId: current.assignedDriverId, driver: current.driver }
    if (Object.prototype.hasOwnProperty.call(parsed.data, 'assignedDriverId')) {
      try { assignment = await resolveDriverAssignment(prisma, tenant, parsed.data.assignedDriverId) } catch { return res.status(400).json({ error: 'Invalid driver assignment' }) }
    }
    const { ownerId: _ownerId, ...updateFields } = vehicleToDb({ ...req.body, ...parsed.data, driver: assignment.driver }, tenant.ownerId)
    const vehicle = await prisma.$transaction(async (tx) => {
      const result = await tx.vehicle.updateMany({
        where: scopedWhere,
        data: { ...updateFields, ...assignment, lastUpdated: new Date() },
      })
      // Must re-read with owner scope — findUnique after updateMany leaked other tenants' rows
      if (result.count === 0) return null
      const updated = await tx.vehicle.findFirst({ where: scopedWhere })
      if (!updated) return null
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'updated', entityType: 'vehicle', entityId: id, entityName: updated.name,
        description: `Vehicle "${updated.name}" was updated`,
      })
      return updated
    })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToVehicle(vehicle))
  }

  if (req.method === 'DELETE') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const vehicle = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.delete({ where: { id } })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'vehicle', entityId: id, entityName: vehicle.name,
        description: `Vehicle "${vehicle.name}" was removed from the fleet`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
