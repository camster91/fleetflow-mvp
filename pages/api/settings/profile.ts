import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;

  switch (req.method) {
    case 'GET':
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            company: true,
            notificationPreferences: true,
          },
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({ user });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
        return res.status(500).json({ error: 'Failed to fetch profile' });
      }

    case 'PUT':
      try {
        const { name, phone, timezone, language, bio } = req.body;

        // Get current preferences
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { notificationPreferences: true }
        });
        
        const currentPrefs = currentUser?.notificationPreferences 
          ? JSON.parse(currentUser.notificationPreferences) 
          : {};

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            name,
            notificationPreferences: JSON.stringify({
              ...currentPrefs,
              phone,
              timezone,
              language,
              bio,
            }),
          },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            company: true,
            notificationPreferences: true,
          },
        });

        return res.status(200).json({ user: updatedUser });
      } catch (error) {
        console.error('Failed to update profile:', error);
        return res.status(500).json({ error: 'Failed to update profile' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
