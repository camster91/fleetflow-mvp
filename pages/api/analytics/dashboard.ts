import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { subDays } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getUserFromRequest(req);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = session.user.id;

  try {
    const days = Math.max(7, Math.min(365, parseInt(req.query.days as string) || 30));
    const fromDate = subDays(new Date(), days);
    const today = new Date();
    const twoWeeksFromNow = new Date(today.getTime() + 14 * 86400000);

    // Find teams the user belongs to for team-scoped data access
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map(tm => tm.teamId);

    // Build ownership filter: user's own data OR data belonging to their teams
    const ownershipFilter = teamIds.length > 0
      ? { OR: [{ ownerId: userId }, { teamId: { in: teamIds } }] }
      : { ownerId: userId };

    const [
      // Vehicle counts by status
      totalVehicles,
      activeVehicles,
      // Delivery counts by status
      totalDeliveries,
      deliveredCount,
      inTransitCount,
      pendingCount,
      delayedCount,
      // Maintenance aggregations
      totalMaintenance,
      overdueCount,
      dueSoonCount,
      completedMaintCount,
      maintenanceCostAgg,
      // Upcoming maintenance (limited)
      upcomingTasks,
      // Client count
      clientCount,
      // Activity logs for charts
      activityLogs,
      // Vehicle names for utilization chart
      vehicles,
      // Delivery vehicle names for utilization
      deliveries,
    ] = await Promise.all([
      // Vehicle counts
      prisma.vehicle.count({ where: ownershipFilter }),
      prisma.vehicle.count({ where: { ...ownershipFilter, status: 'active' } }),
      // Delivery counts
      prisma.delivery.count({ where: ownershipFilter }),
      prisma.delivery.count({ where: { ...ownershipFilter, status: 'delivered' } }),
      prisma.delivery.count({ where: { ...ownershipFilter, status: 'in-transit' } }),
      prisma.delivery.count({ where: { ...ownershipFilter, status: 'pending' } }),
      prisma.delivery.count({ where: { ...ownershipFilter, status: 'delayed' } }),
      // Maintenance counts
      prisma.maintenanceTask.count({ where: ownershipFilter }),
      prisma.maintenanceTask.count({ where: { ...ownershipFilter, completed: false, dueDate: { lt: today } } }),
      prisma.maintenanceTask.count({ where: { ...ownershipFilter, completed: false, dueDate: { gte: today, lte: twoWeeksFromNow } } }),
      prisma.maintenanceTask.count({ where: { ...ownershipFilter, completed: true } }),
      prisma.maintenanceTask.aggregate({ where: ownershipFilter, _sum: { costEstimate: true } }),
      // Upcoming tasks (not completed, due in future, limit 3)
      prisma.maintenanceTask.findMany({
        where: { ...ownershipFilter, completed: false, dueDate: { gte: today } },
        orderBy: { dueDate: 'asc' },
        take: 3,
        select: { vehicleName: true, type: true, dueDate: true },
      }),
      // Client count
      prisma.client.count({ where: ownershipFilter }),
      // Activity logs (bounded for chart aggregation)
      prisma.auditLog.findMany({
        where: { userId, createdAt: { gte: fromDate } },
        orderBy: { createdAt: 'asc' },
        select: { entityType: true, action: true, createdAt: true },
        take: 5000,
      }),
      // Vehicles for utilization chart
      prisma.vehicle.findMany({
        where: ownershipFilter,
        select: { id: true, name: true },
        take: 500,
      }),
      // Deliveries with vehicle info for utilization
      prisma.delivery.groupBy({
        by: ['vehicleId'],
        where: { ...ownershipFilter, vehicleId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const totalMaintCost = maintenanceCostAgg._sum.costEstimate || 0;
    const fleetUtilization = totalVehicles > 0
      ? Math.round((activeVehicles / totalVehicles) * 100) : 0;

    const upcomingItems = upcomingTasks.map(t => ({
      vehicle: t.vehicleName || 'Unknown',
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

    // Maintenance by category — use groupBy
    const categoryGroups = await prisma.maintenanceTask.groupBy({
      by: ['type'],
      where: ownershipFilter,
      _count: true,
      _sum: { costEstimate: true },
    });
    const maintenanceByCategory = categoryGroups.length
      ? categoryGroups.map(g => ({ name: g.type || 'General', value: g._count, cost: g._sum.costEstimate || 0 }))
      : [{ name: 'No tasks yet', value: 1, cost: 0 }];

    // Vehicle utilization from groupBy counts
    const vehicleNameById = new Map(vehicles.map(v => [v.id, v.name]));
    const vDeliveries: Record<string, number> = {};
    for (const v of vehicles) vDeliveries[v.name] = 0;
    for (const row of deliveries) {
      if (!row.vehicleId) continue;
      const vehicleName = vehicleNameById.get(row.vehicleId);
      if (vehicleName && vDeliveries[vehicleName] !== undefined) {
        vDeliveries[vehicleName] += row._count._all;
      }
    }
    const vehicleUtilization = Object.entries(vDeliveries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, deliveries: count }));

    return res.json({
      stats: {
        fleetUtilization: { current: fleetUtilization, total: totalVehicles, active: activeVehicles },
        deliveries: { total: totalDeliveries, delivered: deliveredCount, inTransit: inTransitCount, pending: pendingCount, delayed: delayedCount },
        maintenance: { total: totalMaintenance, overdue: overdueCount, dueSoon: dueSoonCount, completed: completedMaintCount, totalCost: totalMaintCost, upcoming: upcomingItems },
        clients: { total: clientCount },
      },
      charts: { activityOverTime, maintenanceByCategory, vehicleUtilization },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
}
