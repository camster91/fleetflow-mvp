import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';
import { requireTenantContext } from '../../../../lib/apiAuth';
import { canManageMaintenance } from '../../../../lib/permissions';

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

const SHARE_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res);
  if (!context) return;
  const { tenant } = context;
  if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const taskId = req.query.id as string;
  const task = await prisma.maintenanceTask.findFirst({ where: { AND: [{ id: taskId }, tenant.resourceWhere] } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const now = new Date();
  let link = await prisma.taskShareLink.findFirst({
    where: { taskId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
  });
  if (!link) {
    link = await prisma.taskShareLink.create({
      data: {
        token: makeToken(), taskId, ownerId: tenant.ownerId,
        expiresAt: new Date(now.getTime() + SHARE_TOKEN_LIFETIME_MS),
      },
    });
  }

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'https://fleet.ashbi.ca';
  return res.json({ token: link.token, url: `${base}/task/${link.token}` });
}
