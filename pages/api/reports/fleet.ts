import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { requireTenantContext } from '../../../lib/apiAuth';
import { canViewReports } from '../../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const context = await requireTenantContext(req, res);
  if (!context) return;
  const { tenant } = context;
  if (!canViewReports(tenant.role)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: tenant.resourceWhere,
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
