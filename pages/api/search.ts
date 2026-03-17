import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { prisma } from '../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });

  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) return res.json({ vehicles: [], deliveries: [], clients: [], maintenance: [] });

  try {
    const [vehicles, deliveries, clients, maintenance] = await Promise.all([
      prisma.vehicle.findMany({
        where: { OR: [{ name: { contains: q } }, { driver: { contains: q } }, { location: { contains: q } }] },
        select: { id: true, name: true, driver: true, status: true, location: true },
        take: 5,
      }),
      prisma.delivery.findMany({
        where: { OR: [{ customer: { contains: q } }, { address: { contains: q } }, { driver: { contains: q } }] },
        select: { id: true, customer: true, address: true, status: true, driver: true },
        take: 5,
      }),
      prisma.client.findMany({
        where: { OR: [{ name: { contains: q } }, { address: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] },
        select: { id: true, name: true, address: true, type: true },
        take: 5,
      }),
      prisma.maintenanceTask.findMany({
        where: { OR: [{ vehicleName: { contains: q } }, { type: { contains: q } }] },
        select: { id: true, vehicleName: true, type: true, dueDate: true, completed: true },
        take: 5,
      }),
    ]);
    return res.json({ vehicles, deliveries, clients, maintenance });
  } catch {
    return res.status(500).json({ error: 'Search failed' });
  }
}
