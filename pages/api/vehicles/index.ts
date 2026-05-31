import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({ where: { ownerId: userId }, orderBy: { createdAt: 'asc' }, skip, take: limit }),
      prisma.vehicle.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: vehicles.map(dbToVehicle), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    const data = vehicleToDb(req.body, (session.user as any).id)
    const vehicle = await prisma.vehicle.create({ data })
    await logActivity(prisma, {
      userId: (session.user as any).id,
      userName: session.user.name,
      userRole: (session.user as any).role,
      action: 'created',
      entityType: 'vehicle',
      entityId: vehicle.id,
      entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was added to the fleet`,
    })
    return res.status(201).json(dbToVehicle(vehicle))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
