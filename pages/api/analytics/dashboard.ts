import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const days = parseInt(req.query.days as string) || 30;
    const fromDate = subDays(new Date(), days);

    // Get user's team info
    const userTeams = await prisma.teamMember.findMany({
      where: {
        userId: session.user.id,
        status: 'ACCEPTED',
      },
      select: {
        teamId: true,
      },
    });

    const teamIds = userTeams.map(t => t.teamId);

    // Mock analytics data - in a real app, this would come from your database
    // These would be actual queries to vehicles, deliveries, maintenance tables
    
    const stats = {
      fleetUtilization: {
        current: 78,
        change: 5.2,
        trend: [65, 68, 72, 70, 75, 78, 78],
      },
      monthlyCost: {
        current: 12500,
        change: -3.5,
        breakdown: {
          fuel: 5200,
          maintenance: 4300,
          insurance: 1800,
          other: 1200,
        },
      },
      vehiclesNeedingMaintenance: {
        count: 3,
        urgent: 1,
        upcoming: [
          { vehicle: 'Truck #101', task: 'Oil Change', dueIn: 2 },
          { vehicle: 'Van #205', task: 'Tire Rotation', dueIn: 5 },
          { vehicle: 'Truck #102', task: 'Inspection', dueIn: 7 },
        ],
      },
      activeDeliveries: {
        count: 12,
        completed: 45,
        delayed: 2,
      },
      costPerMile: {
        current: 2.34,
        change: -0.15,
        trend: Array.from({ length: days }, (_, i) => ({
          date: subDays(new Date(), days - i - 1).toISOString().split('T')[0],
          value: 2.5 + Math.random() * 0.5 - 0.25,
        })),
      },
      driverPerformance: {
        averageScore: 8.7,
        topDrivers: [
          { name: 'John Smith', score: 9.5, trips: 45 },
          { name: 'Sarah Johnson', score: 9.2, trips: 38 },
          { name: 'Mike Davis', score: 8.9, trips: 42 },
        ],
      },
    };

    // Generate chart data
    const fuelCosts = Array.from({ length: 7 }, (_, i) => ({
      date: subDays(new Date(), 6 - i).toLocaleDateString('en-US', { weekday: 'short' }),
      fuel: 700 + Math.random() * 200,
      maintenance: 400 + Math.random() * 150,
    }));

    const maintenanceByCategory = [
      { name: 'Preventive', value: 45, cost: 3200 },
      { name: 'Repairs', value: 25, cost: 1800 },
      { name: 'Tires', value: 15, cost: 1100 },
      { name: 'Other', value: 15, cost: 1000 },
    ];

    const vehicleUtilization = Array.from({ length: 7 }, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      ...Object.fromEntries(
        ['Truck 101', 'Truck 102', 'Van 201', 'Van 202'].map(v => [
          v,
          60 + Math.random() * 40,
        ])
      ),
    }));

    return res.status(200).json({
      stats,
      charts: {
        fuelCosts,
        maintenanceByCategory,
        vehicleUtilization,
      },
    });
  } catch (error) {
    console.error('Failed to fetch dashboard analytics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
