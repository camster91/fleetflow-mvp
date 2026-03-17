import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToVehicle, vehicleToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToVehicle(vehicle))
  }

  if (req.method === 'PUT') {
    const { ownerId: _o, ...updateFields } = vehicleToDb(req.body, userId) as any
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { ...updateFields, lastUpdated: new Date() },
    })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'updated', entityType: 'vehicle', entityId: id, entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was updated`,
    })
    return res.json(dbToVehicle(vehicle))
  }

  if (req.method === 'DELETE') {
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return res.status(404).json({ error: 'Not found' })
    await prisma.vehicle.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'vehicle', entityId: id, entityName: vehicle.name,
      description: `Vehicle "${vehicle.name}" was removed from the fleet`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
