import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../lib/prisma';
import { requireTenantContext } from '../../lib/apiAuth';
import { canViewBusinessData } from '../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res);
  if (!context) return;
  const { tenant } = context;
  if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' });

  const q = ((req.query.q as string) || '').trim();
  if (q.length < 2) return res.json({ vehicles: [], deliveries: [], clients: [], maintenance: [] });

  try {
    const [vehicles, deliveries, clients, maintenance] = await Promise.all([
      prisma.vehicle.findMany({
        where: { AND: [tenant.resourceWhere, { OR: [{ name: { contains: q } }, { driver: { contains: q } }, { location: { contains: q } }] }] },
        select: { id: true, name: true, driver: true, status: true, location: true },
        take: 5,
      }),
      prisma.delivery.findMany({
        where: { AND: [tenant.resourceWhere, { OR: [{ customer: { contains: q } }, { address: { contains: q } }, { driver: { contains: q } }] }] },
        select: { id: true, customer: true, address: true, status: true, driver: true },
        take: 5,
      }),
      prisma.client.findMany({
        where: { AND: [tenant.resourceWhere, { OR: [{ name: { contains: q } }, { address: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] }] },
        select: { id: true, name: true, address: true, type: true },
        take: 5,
      }),
      prisma.maintenanceTask.findMany({
        where: { AND: [tenant.resourceWhere, { OR: [{ vehicleName: { contains: q } }, { type: { contains: q } }] }] },
        select: { id: true, vehicleName: true, type: true, dueDate: true, completed: true },
        take: 5,
      }),
    ]);
    return res.json({ vehicles, deliveries, clients, maintenance });
  } catch {
    return res.status(500).json({ error: 'Search failed' });
  }
}
