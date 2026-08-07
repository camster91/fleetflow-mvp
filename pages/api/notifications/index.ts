import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { NotificationType } from '../../../types';
import type { Prisma } from '@prisma/client';

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
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const type = req.query.type as NotificationType | undefined;
        const unreadOnly = req.query.unreadOnly === 'true';
        const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

        const skip = (page - 1) * limit;

        const where: Prisma.NotificationWhereInput = { userId };
        if (type) where.type = type;
        if (unreadOnly) where.read = false;

        const [rows, total] = await Promise.all([
          prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip }),
            take: limit + 1,
          }),
          prisma.notification.count({ where }),
        ]);

        const hasMore = rows.length > limit;
        const notifications = rows.slice(0, limit);
        return res.status(200).json({
          notifications,
          total,
          pages: Math.ceil(total / limit),
          currentPage: page,
          hasMore,
          nextCursor: hasMore ? notifications.at(-1)?.id : undefined,
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
        const queryId = typeof req.query.id === 'string' ? req.query.id : undefined;
        const bodyIds: string[] = Array.isArray(req.body?.notificationIds)
          ? req.body.notificationIds.filter((id: unknown): id is string => typeof id === 'string')
          : [];
        const ids = [...new Set<string>(queryId ? [queryId, ...bodyIds] : bodyIds)].slice(0, 100);
        if (ids.length === 0) {
          return res.status(400).json({ error: 'Notification ID required' });
        }

        await prisma.notification.deleteMany({
          where: {
            id: { in: ids },
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
