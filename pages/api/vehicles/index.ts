import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: 'asc' } })
    return res.json(vehicles.map(dbToVehicle))
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
