import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { subDays } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const days = Math.max(7, Math.min(365, parseInt(req.query.days as string) || 30));
    const fromDate = subDays(new Date(), days);

    const [vehicles, deliveries, maintenanceTasks, clients, activityLogs] = await Promise.all([
      prisma.vehicle.findMany(),
      prisma.delivery.findMany(),
      prisma.maintenanceTask.findMany(),
      prisma.client.findMany({ select: { id: true } }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: fromDate } },
        orderBy: { createdAt: 'asc' },
        select: { entityType: true, action: true, createdAt: true },
      }),
    ]);

    const today = new Date();
    const activeVehicles = vehicles.filter(v => v.status === 'active');
    const fleetUtilization = vehicles.length > 0
      ? Math.round((activeVehicles.length / vehicles.length) * 100) : 0;

    const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;
    const inTransitCount = deliveries.filter(d => d.status === 'in-transit').length;
    const pendingCount = deliveries.filter(d => d.status === 'pending').length;
    const delayedCount = deliveries.filter(d => d.status === 'delayed').length;

    const overdueCount = maintenanceTasks.filter(
      t => !t.completed && new Date(t.dueDate) < today
    ).length;
    const dueSoonCount = maintenanceTasks.filter(t => {
      const d = new Date(t.dueDate);
      return !t.completed && d >= today && d <= new Date(today.getTime() + 14 * 86400000);
    }).length;
    const completedMaintCount = maintenanceTasks.filter(t => t.completed).length;
    const totalMaintCost = maintenanceTasks.reduce((s, t) => s + ((t as any).cost || 0), 0);

    const upcomingItems = maintenanceTasks
      .filter(t => !t.completed && new Date(t.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3)
      .map(t => ({
        vehicle: (t as any).vehicleName || (t as any).vehicle || 'Unknown',
        task: t.type,
        dueIn: Math.ceil((new Date(t.dueDate).getTime() - today.getTime()) / 86400000),
      }));

    // Build activity-per-day chart data
    const dayMap: Record<string, { deliveries: number; maintenance: number }> = {};
    const labelFor = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    for (let i = 0; i < Math.min(days, 30); i++) {
      dayMap[labelFor(subDays(new Date(), Math.min(days, 30) - 1 - i))] = { deliveries: 0, maintenance: 0 };
    }
    for (const log of activityLogs) {
      const key = labelFor(new Date(log.createdAt));
      if (dayMap[key]) {
        if (log.entityType === 'delivery') dayMap[key].deliveries++;
        if (log.entityType === 'maintenance') dayMap[key].maintenance++;
      }
    }
    const activityOverTime = Object.entries(dayMap).map(([name, v]) => ({ name, ...v }));

    // Maintenance by category
    const catMap: Record<string, { count: number; cost: number }> = {};
    for (const t of maintenanceTasks) {
      const key = t.type || 'General';
      if (!catMap[key]) catMap[key] = { count: 0, cost: 0 };
      catMap[key].count++;
      catMap[key].cost += (t as any).cost || 0;
    }
    const maintenanceByCategory = Object.keys(catMap).length
      ? Object.entries(catMap).map(([name, v]) => ({ name, value: v.count, cost: v.cost }))
      : [{ name: 'No tasks yet', value: 1, cost: 0 }];

    // Vehicle utilization (delivery assignments)
    const vDeliveries: Record<string, number> = {};
    for (const v of vehicles) vDeliveries[v.name] = 0;
    for (const d of deliveries) {
      const dVehicle = (d as any).vehicleName || (d as any).vehicle;
      if (dVehicle && vDeliveries[dVehicle] !== undefined) vDeliveries[dVehicle]++;
    }
    const vehicleUtilization = Object.entries(vDeliveries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, deliveries: count }));

    return res.json({
      stats: {
        fleetUtilization: { current: fleetUtilization, total: vehicles.length, active: activeVehicles.length },
        deliveries: { total: deliveries.length, delivered: deliveredCount, inTransit: inTransitCount, pending: pendingCount, delayed: delayedCount },
        maintenance: { total: maintenanceTasks.length, overdue: overdueCount, dueSoon: dueSoonCount, completed: completedMaintCount, totalCost: totalMaintCost, upcoming: upcomingItems },
        clients: { total: clients.length },
      },
      charts: { activityOverTime, maintenanceByCategory, vehicleUtilization },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
}
