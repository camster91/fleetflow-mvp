import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageVendingMachines } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!canManageVendingMachines(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  const userId = session.user.id
  const { id } = req.query as { id: string }
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'PUT') {
    const existing = await prisma.vendingMachine.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { ownerId: _ownerId, ...data } = vendingMachineToDb(req.body, tenant.ownerId)
    const machine = await prisma.vendingMachine.update({ where: { id }, data })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'updated', entityType: 'vending', entityId: machine.id, entityName: machine.name,
      description: `Vending machine "${machine.name}" was updated`,
    })
    return res.json(dbToVendingMachine(machine))
  }

  if (req.method === 'DELETE') {
    const machine = await prisma.vendingMachine.findFirst({ where: scopedWhere })
    if (!machine) return res.status(404).json({ error: 'Not found' })
    await prisma.vendingMachine.delete({ where: { id } })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'deleted', entityType: 'vending', entityId: id, entityName: machine?.name,
      description: `Vending machine "${machine?.name}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
