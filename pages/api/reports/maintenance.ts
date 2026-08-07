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
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 86400000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { AND: [tenant.resourceWhere, { createdAt: { gte: startDate, lte: endDate } }] },
      include: { vehicle: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Cost by vehicle (bar chart)
    const vehicleCosts: Record<string, number> = {};
    for (const t of tasks) {
      const name = t.vehicle?.name || t.vehicleName || 'Unassigned';
      vehicleCosts[name] = (vehicleCosts[name] || 0) + (t.costEstimate || 0);
    }
    const costByVehicle = Object.entries(vehicleCosts).map(([vehicle, cost]) => ({ vehicle, cost: Math.round(cost * 100) / 100 }));

    // Cost over time (line chart) - group by month
    const monthCosts: Record<string, number> = {};
    for (const t of tasks) {
      const month = t.createdAt.toISOString().slice(0, 7); // YYYY-MM
      monthCosts[month] = (monthCosts[month] || 0) + (t.costEstimate || 0);
    }
    const costOverTime = Object.entries(monthCosts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cost]) => ({ month, cost: Math.round(cost * 100) / 100 }));

    // Upcoming tasks (next 30 days)
    const now = new Date();
    const thirtyDaysOut = new Date(Date.now() + 30 * 86400000);
    const upcomingTasks = await prisma.maintenanceTask.findMany({
      where: { AND: [tenant.resourceWhere, { completed: false, dueDate: { gte: now, lte: thirtyDaysOut } }] },
      include: { vehicle: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const totalCost = tasks.reduce((sum, t) => sum + (t.costEstimate || 0), 0);

    return res.json({
      costByVehicle,
      costOverTime,
      upcomingTasks: upcomingTasks.map(t => ({
        id: t.id,
        title: t.title,
        type: t.type,
        vehicleName: t.vehicle?.name || t.vehicleName || 'Unassigned',
        dueDate: t.dueDate.toISOString(),
        priority: t.priority,
        costEstimate: t.costEstimate,
      })),
      totalCost: Math.round(totalCost * 100) / 100,
      totalTasks: tasks.length,
    });
  } catch (error) {
    console.error('Maintenance report error:', error);
    return res.status(500).json({ error: 'Failed to generate maintenance report' });
  }
}
