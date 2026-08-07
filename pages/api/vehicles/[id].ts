import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageVehicles, canViewVehicles } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'GET') {
    if (!canViewVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const vehicle = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToVehicle(vehicle))
  }

  if (req.method === 'PUT') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const { ownerId: _ownerId, ...updateFields } = vehicleToDb(req.body, tenant.ownerId)
    const result = await prisma.vehicle.updateMany({
      where: scopedWhere,
      data: { ...updateFields, lastUpdated: new Date() },
    })
    // Must re-read with owner scope — findUnique after updateMany leaked other tenants' rows
    if (result.count === 0) return res.status(404).json({ error: 'Not found' })
    const vehicle = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'updated', entityType: 'vehicle', entityId: id, entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was updated`,
    })
    return res.json(dbToVehicle(vehicle))
  }

  if (req.method === 'DELETE') {
    if (!canManageVehicles(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const vehicle = await prisma.vehicle.findFirst({ where: scopedWhere })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    await prisma.vehicle.delete({ where: { id } })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'deleted', entityType: 'vehicle', entityId: id, entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was removed from the fleet`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
