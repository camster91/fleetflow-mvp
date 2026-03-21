import { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getUserFromRequest(req);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = session.user.id;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 86400000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

  try {
    const deliveries = await prisma.delivery.findMany({
      where: {
        ownerId: userId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Status breakdown (pie chart)
    const statusCounts: Record<string, number> = {};
    for (const d of deliveries) {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
    }
    const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // On-time rate
    const completed = deliveries.filter(d => d.status === 'delivered');
    const onTime = completed.filter(d => {
      if (!d.scheduledTime || !d.completedTime) return true; // no schedule = on time
      return new Date(d.completedTime) <= new Date(d.scheduledTime);
    });
    const onTimeRate = completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0;

    // Top drivers by delivery count
    const driverCounts: Record<string, number> = {};
    for (const d of deliveries) {
      if (d.driver) {
        driverCounts[d.driver] = (driverCounts[d.driver] || 0) + 1;
      }
    }
    const topDrivers = Object.entries(driverCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([driver, deliveries]) => ({ driver, deliveries }));

    // Average delivery time (in hours) for completed deliveries
    let avgDeliveryTime = 0;
    const withTimes = completed.filter(d => d.createdAt && d.completedTime);
    if (withTimes.length > 0) {
      const totalHours = withTimes.reduce((sum, d) => {
        const hours = (new Date(d.completedTime!).getTime() - d.createdAt.getTime()) / 3600000;
        return sum + hours;
      }, 0);
      avgDeliveryTime = Math.round((totalHours / withTimes.length) * 10) / 10;
    }

    return res.json({
      statusBreakdown,
      onTimeRate,
      topDrivers,
      avgDeliveryTime,
      totalDeliveries: deliveries.length,
    });
  } catch (error) {
    console.error('Delivery report error:', error);
    return res.status(500).json({ error: 'Failed to generate delivery report' });
  }
}
