import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'GET':
      try {
        // Return mock reports list
        const reports = [
          {
            id: '1',
            name: 'Fleet Summary Report',
            type: 'fleet',
            schedule: 'weekly',
            lastRun: new Date(Date.now() - 86400000 * 2).toISOString(),
            format: 'pdf',
          },
          {
            id: '2',
            name: 'Monthly Maintenance Report',
            type: 'maintenance',
            schedule: 'monthly',
            lastRun: new Date(Date.now() - 86400000 * 15).toISOString(),
            format: 'excel',
          },
        ];

        return res.status(200).json({ reports });
      } catch (error) {
        console.error('Failed to fetch reports:', error);
        return res.status(500).json({ error: 'Failed to fetch reports' });
      }

    case 'POST':
      try {
        const { name, type, schedule, format } = req.body;

        // Create new report
        const newReport = {
          id: Date.now().toString(),
          name,
          type,
          schedule,
          format,
          createdAt: new Date().toISOString(),
        };

        return res.status(201).json({ report: newReport });
      } catch (error) {
        console.error('Failed to create report:', error);
        return res.status(500).json({ error: 'Failed to create report' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
