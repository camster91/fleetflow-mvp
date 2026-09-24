import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, deliveryToDb, logActivity, mergeDeliveryUpdate } from '../../../../lib/fleet'
import { createNotification } from '../../../../lib/notifications'
import { notifyDeliveryAssigned, notifyDeliveryStatus } from '../../../../lib/email.server'
import { requireTenantContext, assertSameOrigin } from '../../../../lib/apiAuth'
import { canAssignDrivers, canManageDeliveries, canViewDeliveries } from '../../../../lib/permissions'
import { resolveDriverAssignment } from '../../../../lib/driverAssignment'
import { driverDeliveryDto, isDriverRole } from '../../../../lib/driverScope'
import { deliveryUpdateSchema } from '../../../../lib/deliveryTransitions'
import type { Delivery } from '../../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere, ...(isDriverRole(tenant.role)?[{assignedDriverId:userId}]:[])] }

  if (req.method === 'GET') {
    if (!canViewDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const delivery = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    return res.json(isDriverRole(tenant.role)?driverDeliveryDto(delivery):dbToDelivery(delivery))
  }

  if (req.method === 'PUT') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = deliveryUpdateSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid delivery update',
        fields: Array.from(new Set(parsed.error.issues.map((issue) => issue.path[0] ?? (issue.code === 'unrecognized_keys' ? issue.keys.join(',') : 'body')))),
      })
    }
    const { id: _bodyId, ...body } = parsed.data
    const existing = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    // Status controls submit partial records. Preserve all existing delivery data
    // instead of resetting omitted fields such as item count to defaults.
    if (Object.prototype.hasOwnProperty.call(body, 'assignedDriverId') && !canAssignDrivers(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    let assignment = { assignedDriverId: existing.assignedDriverId, driver: existing.driver }
    if (Object.prototype.hasOwnProperty.call(body, 'assignedDriverId')) {
      try { assignment = await resolveDriverAssignment(prisma, tenant, body.assignedDriverId) } catch { return res.status(400).json({ error: 'Invalid driver assignment' }) }
    }
    // Nullable date/location fields are cleared by deliveryToDb's falsy checks.
    const merged = mergeDeliveryUpdate(existing, { ...body, driver: assignment.driver ?? '' } as Partial<Delivery>)
    const { ownerId: _ownerId, ...fields } = deliveryToDb(merged, tenant.ownerId)
    const wasCompleted = body.status === 'delivered' && existing.status !== 'delivered'

    const delivery = await prisma.$transaction(async (tx) => {
      const updated = await tx.delivery.update({ where: { id }, data: { ...fields, ...assignment } })
      if (body.status && body.status !== existing.status) {
        await tx.deliveryEvent.create({
          data: {
            deliveryId: id,
            status: body.status,
            notes: body.notes ?? null,
            createdBy: userId,
          },
        })
      }
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: wasCompleted ? 'completed' : 'status_changed',
        entityType: 'delivery', entityId: id, entityName: updated.customer,
        description: wasCompleted
          ? `Delivery for "${updated.customer}" was marked as delivered`
          : `Delivery for "${updated.customer}" status changed to ${updated.status}`,
      })
      return updated
    })
    // Notify driver if newly assigned
    if (typeof delivery.assignedDriverId === 'string' && delivery.assignedDriverId !== existing.assignedDriverId) {
      const assignedDriverId = delivery.assignedDriverId
      const driverUser = await prisma.user.findFirst({
        where: {
          id: assignedDriverId,
        },
      })
      if (driverUser) {
        await createNotification({
          userId: driverUser.id,
          type: 'SYSTEM',
          title: 'New Delivery Assignment',
          message: `You have been assigned a delivery for "${delivery.customer}"`,
          data: { deliveryId: delivery.id, customer: delivery.customer },
        })
        if (driverUser.email) {
          notifyDeliveryAssigned(
            delivery,
            driverUser.name || delivery.driver || 'Unknown driver',
            driverUser.email,
            session.user.name || 'Manager',
          ).catch(console.error)
        }
      }
    }

    // Notify owner when delivery is completed
    if (wasCompleted) {
      await createNotification({
        userId: existing.ownerId,
        type: 'SYSTEM',
        title: 'Delivery Completed',
        message: `Delivery for "${delivery.customer}" has been marked as delivered`,
        data: { deliveryId: delivery.id, customer: delivery.customer },
      })
      const owner = await prisma.user.findUnique({ where: { id: existing.ownerId } })
      if (owner?.email) {
        notifyDeliveryStatus(delivery, [owner.email], 'admin').catch(console.error)
      }
    }

    return res.json(dbToDelivery(delivery))
  }

  if (req.method === 'DELETE') {
    if (!canManageDeliveries(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const delivery = await prisma.delivery.findFirst({ where: scopedWhere })
    if (!delivery) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      await tx.delivery.delete({ where: { id } })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'delivery', entityId: id, entityName: delivery.customer,
        description: `Delivery for "${delivery.customer}" was deleted`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
