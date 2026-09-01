import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToMaintenanceTask, maintenanceTaskToDb, logActivity, mergeMaintenanceUpdate } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageMaintenance, canViewMaintenance } from '../../../lib/permissions'
import { driverMaintenanceDto, isDriverRole } from '../../../lib/driverScope'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere, ...(isDriverRole(tenant.role)?[{vehicle:{assignedDriverId:userId}}]:[])] }

  if (req.method === 'GET') {
    if (!canViewMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const task = await prisma.maintenanceTask.findFirst({
      where: scopedWhere,
      include: { vehicle: { select: { name: true } } },
    })
    if (!task) return res.status(404).json({ error: 'Not found' })
    return res.json(isDriverRole(tenant.role)?driverMaintenanceDto(task):dbToMaintenanceTask(task))
  }

  if (req.method === 'PUT') {
    if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const existing = await prisma.maintenanceTask.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    let vehicleId: string | undefined = req.body.vehicleId || existing.vehicleId || undefined
    if (req.body.vehicleId) {
      const owned = await prisma.vehicle.findFirst({
        where: { AND: [{ id: req.body.vehicleId }, tenant.resourceWhere] },
        select: { id: true },
      })
      if (!owned) return res.status(400).json({ error: 'Invalid vehicle' })
      vehicleId = owned.id
    } else if (!vehicleId && req.body.vehicle) {
      const v = await prisma.vehicle.findFirst({ where: { AND: [{ name: req.body.vehicle }, tenant.resourceWhere] } })
      vehicleId = v?.id
    }
    // The client sends partial updates (for example only `completed`). Merge them
    // with the stored task before converting so required fields are never erased.
    const merged = mergeMaintenanceUpdate(existing, req.body)
    const { ownerId: _ownerId, ...fields } = maintenanceTaskToDb(merged, tenant.ownerId, vehicleId)
    const wasCompleted = req.body.completed === true && !existing.completed
    const task = await prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceTask.update({ where: { id }, data: fields })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: wasCompleted ? 'completed' : 'updated',
        entityType: 'maintenance', entityId: id, entityName: updated.title,
        description: wasCompleted
          ? `Maintenance "${updated.title}" for ${updated.vehicleName ?? 'vehicle'} was completed`
          : `Maintenance task "${updated.title}" was updated`,
      })
      return updated
    })
    return res.json(dbToMaintenanceTask(task))
  }

  if (req.method === 'DELETE') {
    if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const task = await prisma.maintenanceTask.findFirst({ where: scopedWhere })
    if (!task) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      await tx.maintenanceTask.delete({ where: { id } })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'maintenance', entityId: id, entityName: task.title,
        description: `Maintenance task "${task.title}" was deleted`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
