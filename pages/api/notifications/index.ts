import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { NotificationType } from '../../../types';

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
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const type = req.query.type as NotificationType | undefined;
        const unreadOnly = req.query.unreadOnly === 'true';

        const skip = (page - 1) * limit;

        const where: any = { userId };
        if (type) where.type = type;
        if (unreadOnly) where.read = false;

        const [notifications, total] = await Promise.all([
          prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.notification.count({ where }),
        ]);

        return res.status(200).json({
          notifications,
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
        });
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications' });
      }

    case 'POST':
      try {
        const { notificationId, notificationIds } = req.body;
        const ids = notificationIds || (notificationId ? [notificationId] : []);

        if (ids.length === 0) {
          return res.status(400).json({ error: 'No notification IDs provided' });
        }

        await prisma.notification.updateMany({
          where: {
            id: { in: ids },
            userId,
          },
          data: {
            read: true,
            readAt: new Date(),
          },
        });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
        return res.status(500).json({ error: 'Failed to mark notifications as read' });
      }

    case 'PUT':
      try {
        await prisma.notification.updateMany({
          where: {
            userId,
            read: false,
          },
          data: {
            read: true,
            readAt: new Date(),
          },
        });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
        return res.status(500).json({ error: 'Failed to mark all notifications as read' });
      }

    case 'DELETE':
      try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Notification ID required' });
        }

        await prisma.notification.deleteMany({
          where: {
            id,
            userId,
          },
        });

        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Failed to delete notification:', error);
        return res.status(500).json({ error: 'Failed to delete notification' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
