import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { dbToDelivery, logActivity } from '../../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../../lib/apiAuth'
import { canManageDeliveries } from '../../../../lib/permissions'
import { applyDeliveryStatusTransition, deliveryStatusTransitionSchema } from '../../../../lib/deliveryTransitions'
import { z } from 'zod'
import { driverDeliveryDto, isDriverRole } from '../../../../lib/driverScope'

const driverStatusSchema = deliveryStatusTransitionSchema.extend({ latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return
  if (!canManageDeliveries(tenant.role) && !isDriverRole(tenant.role)) return res.status(403).json({ error: 'Forbidden' })

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const parsed = driverStatusSchema.safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ error: 'Invalid delivery status transition' })
  const { status, latitude, longitude } = parsed.data

  // Owner-scoped lookup prevents cross-tenant status mutation (IDOR)
  const delivery = await prisma.delivery.findFirst({ where: { AND: [{ id }, tenant.resourceWhere, ...(isDriverRole(tenant.role)?[{assignedDriverId:userId}]:[])] } })
  if (!delivery) return res.status(404).json({ error: 'Not found' })

  const updated = await prisma.$transaction(async (tx) => {
    const transition = applyDeliveryStatusTransition(delivery, { status, notes: parsed.data.notes }, new Date())
    const updatedDelivery = await tx.delivery.update({
      where: { id },
      data: transition.fields,
    })

    await tx.deliveryEvent.create({
      data: {
        deliveryId: id,
        status,
        notes: transition.event.notes,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        createdBy: userId,
      },
    })

    await logActivity(tx, {
      userId,
      teamId: tenant.teamId,
      userName: session.user.name,
      userRole: tenant.role,
      action: status === 'delivered' ? 'completed' : 'status_changed',
      entityType: 'delivery',
      entityId: id,
      entityName: updatedDelivery.customer,
      description: `Delivery for "${updatedDelivery.customer}" status changed to ${status}`,
    })

    return updatedDelivery
  })

  return res.json(isDriverRole(tenant.role)?driverDeliveryDto(updated):dbToDelivery(updated))
}
