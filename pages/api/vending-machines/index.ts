import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageVendingMachines, canViewBusinessData } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [machines, total] = await Promise.all([
      prisma.vendingMachine.findMany({ where: tenant.resourceWhere, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.vendingMachine.count({ where: tenant.resourceWhere }),
    ])
    return res.json({ data: machines.map(dbToVendingMachine), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageVendingMachines(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const data = { ...vendingMachineToDb(req.body, tenant.ownerId), ownerId: tenant.ownerId, teamId: tenant.teamId }
    const machine = await prisma.vendingMachine.create({ data })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'created', entityType: 'vending', entityId: machine.id, entityName: machine.name,
      description: `Vending machine "${machine.name}" at ${machine.location} was added`,
    })
    return res.status(201).json(dbToVendingMachine(machine))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
