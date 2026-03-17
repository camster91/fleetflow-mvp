import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const machines = await prisma.vendingMachine.findMany({ orderBy: { name: 'asc' } })
    return res.json(machines.map(dbToVendingMachine))
  }

  if (req.method === 'POST') {
    const data = vendingMachineToDb(req.body, userId)
    const machine = await prisma.vendingMachine.create({ data })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'vending', entityId: machine.id, entityName: machine.name,
      description: `Vending machine "${machine.name}" at ${machine.location} was added`,
    })
    return res.status(201).json(dbToVendingMachine(machine))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
