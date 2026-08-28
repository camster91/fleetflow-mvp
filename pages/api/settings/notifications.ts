import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import {
  notificationUpdateSchema,
  parseStoredPreferences,
} from '../../../lib/settingsValidation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method === 'PUT' && !assertSameOrigin(req, res)) return

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = session.user.id
  if (!await rateLimitMiddleware(req, res, 'api', `settings:${userId}`)) return

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPreferences: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const prefs = parseStoredPreferences(user.notificationPreferences)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({
      notificationSettings: prefs.notificationSettings || {},
    })
  }

  const parsed = notificationUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid notification settings' })
  }

  try {
    const notificationSettings = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))) AS settings_lock`
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      })
      if (!current) throw Object.assign(new Error('User not found'), { statusCode: 404 })

      const existing = parseStoredPreferences(current.notificationPreferences)
      const mergedSettings = {
        ...(existing.notificationSettings || {}),
        ...parsed.data.notificationSettings,
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          notificationPreferences: JSON.stringify({
            ...existing,
            notificationSettings: mergedSettings,
          }),
        },
      })
      return mergedSettings
    })

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({ success: true, notificationSettings })
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode)
    if (status === 404) return res.status(404).json({ error: 'User not found' })
    return res.status(503).json({ error: 'Notification settings are temporarily unavailable' })
  }
}
