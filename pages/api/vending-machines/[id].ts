import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { parseBody, vendingMachineBodySchema } from '../../../lib/validation'
import { canManageVendingMachines } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return
  if (!canManageVendingMachines(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  const userId = session.user.id
  const { id } = req.query as { id: string }
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'PUT') {
    const existing = await prisma.vendingMachine.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const parsed = parseBody(vendingMachineBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const { ownerId: _ownerId, ...data } = vendingMachineToDb(parsed.data, tenant.ownerId)
    const machine = await prisma.$transaction(async (tx) => {
      const result = await tx.vendingMachine.updateMany({ where: scopedWhere, data })
      if (result.count === 0) return null
      const updated = await tx.vendingMachine.findFirst({ where: scopedWhere })
      if (!updated) return null
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'updated', entityType: 'vending', entityId: updated.id, entityName: updated.name,
        description: `Vending machine "${updated.name}" was updated`,
      })
      return updated
    })
    if (!machine) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToVendingMachine(machine))
  }

  if (req.method === 'DELETE') {
    const machine = await prisma.vendingMachine.findFirst({ where: scopedWhere })
    if (!machine) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      const result = await tx.vendingMachine.deleteMany({ where: scopedWhere })
      if (result.count === 0) return
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'vending', entityId: id, entityName: machine.name,
        description: `Vending machine "${machine.name}" was deleted`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
