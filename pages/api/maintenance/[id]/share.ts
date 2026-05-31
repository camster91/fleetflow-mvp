import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import crypto from 'crypto';

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const taskId = req.query.id as string;
  const task = await prisma.maintenanceTask.findFirst({ where: { id: taskId, ownerId: userId } });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Reuse existing link or create new
  let link = await prisma.taskShareLink.findFirst({ where: { taskId } });
  if (!link) {
    link = await prisma.taskShareLink.create({
      data: { token: makeToken(), taskId, ownerId: userId },
    });
  }

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'https://fleet.ashbi.ca';
  return res.json({ token: link.token, url: `${base}/task/${link.token}` });
}
