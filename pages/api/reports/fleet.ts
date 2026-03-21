import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getUserFromRequest(req);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = session.user.id;

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        status: true,
        maintenanceDue: true,
        mileage: true,
        lastService: true,
        nextService: true,
        vehicleType: true,
        driver: true,
      },
    });

    // Status breakdown (pie chart)
    const statusCounts: Record<string, number> = {};
    for (const v of vehicles) {
      const status = v.maintenanceDue ? 'maintenance' : v.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Vehicles needing maintenance
    const vehiclesNeedingMaintenance = vehicles
      .filter(v => v.maintenanceDue)
      .map(v => ({
        id: v.id,
        name: v.name,
        vehicleType: v.vehicleType,
        mileage: v.mileage,
        lastService: v.lastService?.toISOString() || null,
        nextService: v.nextService?.toISOString() || null,
        driver: v.driver,
      }));

    return res.json({
      statusBreakdown,
      vehiclesNeedingMaintenance,
      totalVehicles: vehicles.length,
    });
  } catch (error) {
    console.error('Fleet report error:', error);
    return res.status(500).json({ error: 'Failed to generate fleet report' });
  }
}
