import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.query.token as string;

  const link = await prisma.taskShareLink.findUnique({
    where: { token },
    include: { task: true },
  });

  if (!link) return res.status(404).json({ error: 'Link not found' });

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
        costEstimate: t.costEstimate,
        estimatedDuration: t.estimatedDuration,
        serviceProvider: t.serviceProvider,
        completed: t.completed,
        completedDate: t.completedDate,
      },
    });
  }

  if (req.method === 'PUT') {
    const { actualCost, completionNotes, markComplete } = req.body;
    const data: Record<string, any> = {};
    if (actualCost !== undefined && actualCost !== '') data.costEstimate = parseFloat(actualCost);
    if (completionNotes !== undefined) data.notes = completionNotes;
    if (markComplete) { data.completed = true; data.completedDate = new Date(); }
    await prisma.maintenanceTask.update({ where: { id: link.taskId }, data });
    await prisma.taskShareLink.update({ where: { id: link.id }, data: { usedAt: new Date() } });
    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
