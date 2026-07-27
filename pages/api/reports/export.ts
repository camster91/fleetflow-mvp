import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return [keys.map(escape).join(','), ...rows.map(r => keys.map(k => escape(r[k])).join(','))].join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getUserFromRequest(req);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = session.user.id;
  const type = req.query.type as string;
  const startRaw = req.query.startDate as string | undefined;
  const endRaw = req.query.endDate as string | undefined;
  const startDate = startRaw ? new Date(startRaw) : new Date(Date.now() - 30 * 86400000);
  const endDate = endRaw ? new Date(endRaw) : new Date();

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date range' });
  }
  if (endDate < startDate) {
    return res.status(400).json({ error: 'endDate must be on or after startDate' });
  }
  // Cap export window to limit memory / DoS via unbounded date ranges
  const maxRangeMs = 366 * 86400000;
  if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
    return res.status(400).json({ error: 'Date range too large (max 366 days)' });
  }

  if (!['maintenance', 'deliveries', 'fleet'].includes(type)) {
    return res.status(400).json({ error: 'Invalid report type. Use: maintenance, deliveries, or fleet' });
  }

  const EXPORT_ROW_LIMIT = 5000;

  try {
    let rows: Record<string, any>[] = [];

    if (type === 'maintenance') {
      const tasks = await prisma.maintenanceTask.findMany({
        where: { ownerId: userId, createdAt: { gte: startDate, lte: endDate } },
        include: { vehicle: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: EXPORT_ROW_LIMIT,
      });
      rows = tasks.map(t => ({
        Title: t.title,
        Type: t.type,
        Vehicle: t.vehicle?.name || t.vehicleName || '',
        'Due Date': t.dueDate.toISOString().slice(0, 10),
        Priority: t.priority,
        Completed: t.completed ? 'Yes' : 'No',
        'Completed Date': t.completedDate?.toISOString().slice(0, 10) || '',
        'Cost Estimate': t.costEstimate ?? '',
        'Service Provider': t.serviceProvider || '',
      }));
    } else if (type === 'deliveries') {
      const deliveries = await prisma.delivery.findMany({
        where: { ownerId: userId, createdAt: { gte: startDate, lte: endDate } },
        orderBy: { createdAt: 'asc' },
        take: EXPORT_ROW_LIMIT,
      });
      rows = deliveries.map(d => ({
        Customer: d.customer,
        Address: d.address,
        Status: d.status,
        Driver: d.driver || '',
        Items: d.items,
        'Scheduled Time': d.scheduledTime?.toISOString() || '',
        'Completed Time': d.completedTime?.toISOString() || '',
        'Created At': d.createdAt.toISOString().slice(0, 10),
      }));
    } else if (type === 'fleet') {
      const vehicles = await prisma.vehicle.findMany({
        where: { ownerId: userId },
        orderBy: { name: 'asc' },
        take: EXPORT_ROW_LIMIT,
      });
      rows = vehicles.map(v => ({
        Name: v.name,
        Status: v.status,
        Driver: v.driver || '',
        'Vehicle Type': v.vehicleType || '',
        'License Plate': v.licensePlate || '',
        Mileage: v.mileage ?? '',
        'Maintenance Due': v.maintenanceDue ? 'Yes' : 'No',
        'Last Service': v.lastService?.toISOString().slice(0, 10) || '',
        'Next Service': v.nextService?.toISOString().slice(0, 10) || '',
      }));
    }

    const csv = toCsv(rows);
    const filename = `${type}-report-${startDate.toISOString().slice(0, 10)}-to-${endDate.toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export report' });
  }
}
