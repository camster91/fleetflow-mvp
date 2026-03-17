import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id
  const { id } = req.query as { id: string }

  if (req.method === 'PUT') {
    const data = vendingMachineToDb(req.body, userId)
    const machine = await prisma.vendingMachine.update({ where: { id }, data })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'updated', entityType: 'vending', entityId: machine.id, entityName: machine.name,
      description: `Vending machine "${machine.name}" was updated`,
    })
    return res.json(dbToVendingMachine(machine))
  }

  if (req.method === 'DELETE') {
    const machine = await prisma.vendingMachine.findUnique({ where: { id } })
    await prisma.vendingMachine.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'vending', entityId: id, entityName: machine?.name,
      description: `Vending machine "${machine?.name}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
