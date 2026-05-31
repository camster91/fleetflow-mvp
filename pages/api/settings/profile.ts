import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const userId = (session.user as any).id;

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true, company: true, notificationPreferences: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const prefs = user.notificationPreferences ? JSON.parse(user.notificationPreferences) : {};
    return res.json({ user: { ...user, prefs } });
  }

  if (req.method === 'PUT') {
    const { name, phone, bio, company, notificationSettings, preferences } = req.body;
    const current = await prisma.user.findUnique({
      where: { id: userId }, select: { notificationPreferences: true },
    });
    const existing = current?.notificationPreferences ? JSON.parse(current.notificationPreferences) : {};
    const merged = {
      ...existing,
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(notificationSettings && { notificationSettings }),
      ...(preferences && { preferences }),
    };
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(company !== undefined && { company }),
        notificationPreferences: JSON.stringify(merged),
      },
      select: { id: true, name: true, email: true, image: true, company: true, notificationPreferences: true },
    });
    const prefs = updated.notificationPreferences ? JSON.parse(updated.notificationPreferences) : {};
    return res.json({ user: { ...updated, prefs } });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
