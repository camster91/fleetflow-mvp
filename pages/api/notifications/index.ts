import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { NotificationType } from '../../../types';
import type { Prisma } from '@prisma/client';
import { assertSameOrigin } from '../../../lib/apiAuth';
import { z } from 'zod';

const notificationIdSchema = z.string().trim().min(1).max(64);
const notificationSelectionSchema = z.object({
  notificationId: notificationIdSchema.optional(),
  notificationIds: z.array(notificationIdSchema).max(100).optional(),
}).strict();
const notificationTypeSchema = z.enum([
  'delivery_assigned',
  'delivery_completed',
  'maintenance_due',
  'maintenance_completed',
  'vehicle_alert',
  'announcement',
  'system',
  'invite',
]);

function selectedIds(body: unknown, queryId?: unknown): { ids: string[] } | { error: string } {
  const parsed = notificationSelectionSchema.safeParse(body || {});
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Invalid notification selection' };

  const query = queryId === undefined ? undefined : notificationIdSchema.safeParse(queryId);
  if (query && !query.success) return { error: 'Invalid notification ID' };

  const ids = [...new Set([
    ...(query?.success ? [query.data] : []),
    ...(parsed.data.notificationId ? [parsed.data.notificationId] : []),
    ...(parsed.data.notificationIds || []),
  ])];
  if (ids.length === 0) return { error: 'Notification ID required' };
  if (ids.length > 100) return { error: 'Too many notification IDs' };
  return { ids };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.user.id;
  if (!assertSameOrigin(req, res)) return;

  switch (req.method) {
    case 'GET':
      try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
        const parsedType = req.query.type === undefined ? undefined : notificationTypeSchema.safeParse(req.query.type);
        if (parsedType && !parsedType.success) return res.status(400).json({ error: 'Invalid notification type' });
        const type = parsedType?.data as NotificationType | undefined;
        const unreadOnly = req.query.unreadOnly === 'true';
        const parsedCursor = req.query.cursor === undefined ? undefined : notificationIdSchema.safeParse(req.query.cursor);
        if (parsedCursor && !parsedCursor.success) return res.status(400).json({ error: 'Invalid notification cursor' });
        const cursor = parsedCursor?.data;

        const skip = (page - 1) * limit;

        const where: Prisma.NotificationWhereInput = { userId };
        if (cursor) {
          const ownCursor = await prisma.notification.findFirst({
            where: { id: cursor, userId },
            select: { id: true },
          });
          if (!ownCursor) return res.status(400).json({ error: 'Invalid notification cursor' });
        }
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
        const selection = selectedIds(req.body);
        if ('error' in selection) {
          return res.status(400).json({ error: selection.error });
        }

        await prisma.notification.updateMany({
          where: {
            id: { in: selection.ids },
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
        const selection = selectedIds(req.body, req.query.id);
        if ('error' in selection) {
          return res.status(400).json({ error: selection.error });
        }

        await prisma.notification.deleteMany({
          where: {
            id: { in: selection.ids },
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
