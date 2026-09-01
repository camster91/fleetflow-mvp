import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';
import { assertSameOrigin, requireTenantContext } from '../../../../lib/apiAuth';
import { canManageMaintenance } from '../../../../lib/permissions';

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function configuredAppOrigin(): string | null {
  const configured = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (!configured) {
    return process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000';
  }
  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

const SHARE_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertSameOrigin(req, res)) return;

  const context = await requireTenantContext(req, res);
  if (!context) return;
  const { tenant } = context;
  if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' });

  const appOrigin = configuredAppOrigin();
  if (!appOrigin) {
    return res.status(503).json({ error: 'Application URL is not configured safely' });
  }

  const taskId = req.query.id as string;
  const task = await prisma.maintenanceTask.findFirst({ where: { AND: [{ id: taskId }, tenant.resourceWhere] } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const link = await prisma.$transaction(async transaction => {
    // Serialize issuance for this task. Hash collisions only serialize unrelated
    // tasks; they cannot weaken the one-active-link invariant.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${taskId}))`;

    const now = new Date();
    const existing = await transaction.taskShareLink.findFirst({
      where: { taskId, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
    });
    if (existing) return existing;

    return transaction.taskShareLink.create({
      data: {
        token: makeToken(), taskId, ownerId: tenant.ownerId,
        expiresAt: new Date(now.getTime() + SHARE_TOKEN_LIFETIME_MS),
      },
    });
  });

  return res.json({ token: link.token, url: `${appOrigin}/task/${link.token}` });
}
