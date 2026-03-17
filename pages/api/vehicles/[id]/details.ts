import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

/** GET /api/vehicles/[id]/details
 * Returns vehicle + real maintenance tasks + driver user info if matched */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Vehicle id required' });

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ownerId: userId },
  });
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  // Fetch real maintenance tasks for this vehicle
  const maintenanceTasks = await prisma.maintenanceTask.findMany({
    where: {
      OR: [
        { vehicleId: id },
        { vehicleName: vehicle.name, ownerId: userId },
      ],
    },
    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }],
    take: 10,
    select: {
      id: true, title: true, type: true, dueDate: true,
      priority: true, completed: true, completedDate: true,
      costEstimate: true, serviceProvider: true,
    },
  });

  // Try to look up driver as a team member or user by name
  let driverUser: { name: string | null; email: string; image: string | null } | null = null;
  if (vehicle.driver) {
    driverUser = await prisma.user.findFirst({
      where: {
        OR: [
          { name: { equals: vehicle.driver } },
          { email: { contains: vehicle.driver.toLowerCase().replace(/\s+/g, '.') } },
        ],
        id: userId, // stay within owner's org for now
      },
      select: { name: true, email: true, image: true },
    }).catch(() => null);
  }

  return res.json({
    vehicle,
    maintenanceTasks,
    driverUser,
  });
}
