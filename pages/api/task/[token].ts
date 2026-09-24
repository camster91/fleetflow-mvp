import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { rateLimitMiddleware, getClientIP } from '../../../lib/rateLimit';
import { hashToken } from '../../../lib/tokens';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ip = getClientIP(req);
  const allowed = await rateLimitMiddleware(req, res, 'api', ip);
  if (!allowed) return;

  const token = req.query.token;
  if (typeof token !== 'string' || !token) return res.status(404).json({ error: 'Link not found' });
  // Links are stored as sha256(token); the plaintext only lives in the URL.
  const link = await prisma.taskShareLink.findUnique({
    where: { token: hashToken(token) },
    include: { task: true },
  });
  if (!link) return res.status(404).json({ error: 'Link not found' });

  const now = new Date();
  if (link.revokedAt || now >= link.expiresAt) {
    return res.status(410).json({ error: 'Share link is no longer available' });
  }

  if (req.method === 'GET') {
    const task = link.task;
    return res.json({
      task: {
        id: task.id,
        vehicle: task.vehicleName || 'Vehicle',
        type: task.type,
        dueDate: task.dueDate,
        priority: task.priority,
        notes: task.notes,
        estimatedDuration: task.estimatedDuration,
        serviceProvider: task.serviceProvider,
        completed: task.completed,
        completedDate: task.completedDate,
        actualCost: task.actualCost,
        costEstimate: task.costEstimate,
      },
    });
  }

  if (req.method === 'PUT') {
    const { actualCost, completionNotes, markComplete } = req.body ?? {};
    const parsedCost = actualCost === undefined || actualCost === '' ? undefined : Number(actualCost);
    if (parsedCost !== undefined && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      return res.status(400).json({ error: 'Actual cost must be a non-negative number' });
    }
    if (completionNotes !== undefined && typeof completionNotes !== 'string') {
      return res.status(400).json({ error: 'Completion notes must be text' });
    }
    if (completionNotes === undefined && parsedCost === undefined && markComplete !== true) {
      return res.status(400).json({ error: 'No report fields supplied' });
    }

    const accepted = await prisma.$transaction(async transaction => {
      const claimed = await transaction.taskShareLink.updateMany({
        where: { id: link.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;

      await transaction.maintenanceTask.update({
        where: { id: link.taskId },
        data: {
          ...(completionNotes !== undefined ? { notes: completionNotes.trim() } : {}),
          ...(parsedCost !== undefined ? { actualCost: parsedCost } : {}),
          ...(markComplete === true ? { completed: true, completedDate: now } : {}),
        },
      });
      return true;
    });
    if (!accepted) return res.status(410).json({ error: 'Share link has already been used' });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
