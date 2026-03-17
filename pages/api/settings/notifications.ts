import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

/** GET /api/settings/notifications — returns notification prefs
 *  PUT /api/settings/notifications — saves notification prefs */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const prefs = user.notificationPreferences ? JSON.parse(user.notificationPreferences) : {};
    const notificationSettings = prefs.notificationSettings ?? {};
    return res.json({ notificationSettings });
  }

  if (req.method === 'PUT') {
    const { notificationSettings } = req.body;
    if (!notificationSettings || typeof notificationSettings !== 'object') {
      return res.status(400).json({ error: 'notificationSettings object required' });
    }
    const current = await prisma.user.findUnique({
      where: { id: userId }, select: { notificationPreferences: true },
    });
    const existing = current?.notificationPreferences ? JSON.parse(current.notificationPreferences) : {};
    const merged = { ...existing, notificationSettings };
    await prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: JSON.stringify(merged) },
    });
    return res.json({ success: true, notificationSettings });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
