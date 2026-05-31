import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVendingMachine, vendingMachineToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [machines, total] = await Promise.all([
      prisma.vendingMachine.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.vendingMachine.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: machines.map(dbToVendingMachine), total, page, limit, hasMore: skip + limit < total })
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
