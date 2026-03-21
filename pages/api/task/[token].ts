import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';

const SHARE_TOKEN_EXPIRY_DAYS = 7;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rate limit by IP
  const ip = getClientIP(req);
  const allowed = await rateLimitMiddleware(req, res, 'api', ip);
  if (!allowed) return;

  const token = req.query.token as string;

  const link = await prisma.taskShareLink.findUnique({
    where: { token },
    include: { task: true },
  });

  if (!link) return res.status(404).json({ error: 'Link not found' });

  // Check token expiration (7 days from creation)
  const expiresAt = new Date(link.createdAt.getTime() + SHARE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() > expiresAt) {
    return res.status(410).json({ error: 'Share link has expired' });
  }

  if (req.method === 'GET') {
    const t = link.task;
    return res.json({
      task: {
        id: t.id,
        vehicle: (t as any).vehicleName || 'Vehicle',
        type: t.type,
        dueDate: t.dueDate,
        priority: t.priority,
        notes: t.notes,
        estimatedDuration: t.estimatedDuration,
        serviceProvider: t.serviceProvider,
        completed: t.completed,
        completedDate: t.completedDate,
      },
    });
  }

  if (req.method === 'PUT') {
    // Only allow notes and completion status via share token — not cost or other sensitive fields
    const { completionNotes, markComplete } = req.body;
    const data: Record<string, any> = {};
    if (completionNotes !== undefined) data.notes = completionNotes;
    if (markComplete) { data.completed = true; data.completedDate = new Date(); }
    await prisma.maintenanceTask.update({ where: { id: link.taskId }, data });
    await prisma.taskShareLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
