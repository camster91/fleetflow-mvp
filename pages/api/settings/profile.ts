import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { assertSameOrigin } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import {
  parseStoredPreferences,
  profileUpdateSchema,
  type StoredPreferences,
} from '../../../lib/settingsValidation'

type ProfileRow = {
  id: string
  name: string | null
  email: string
  image: string | null
  company: string | null
  notificationPreferences: string | null
}

function profileResponse(user: ProfileRow) {
  const prefs = parseStoredPreferences(user.notificationPreferences)
  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    company: user.company,
    prefs,
  }
  return { user: safeUser, prefs }
}

function mergePreferences(
  existing: StoredPreferences,
  update: {
    phone?: string
    bio?: string
    notificationSettings?: StoredPreferences['notificationSettings']
    preferences?: StoredPreferences['preferences']
  },
): StoredPreferences {
  return {
    ...existing,
    ...(update.phone !== undefined && { phone: update.phone }),
    ...(update.bio !== undefined && { bio: update.bio }),
    ...(update.notificationSettings !== undefined && {
      notificationSettings: {
        ...(existing.notificationSettings || {}),
        ...update.notificationSettings,
      },
    }),
    ...(update.preferences !== undefined && {
      preferences: {
        ...(existing.preferences || {}),
        ...update.preferences,
      },
    }),
  }
}

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
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        company: true,
        notificationPreferences: true,
      },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json(profileResponse(user))
  }

  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile settings' })

  try {
    const updated = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))) AS settings_lock`
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { notificationPreferences: true },
      })
      if (!current) throw Object.assign(new Error('User not found'), { statusCode: 404 })

      const existing = parseStoredPreferences(current.notificationPreferences)
      const preferences = mergePreferences(existing, parsed.data)
      return tx.user.update({
        where: { id: userId },
        data: {
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.company !== undefined && { company: parsed.data.company }),
          notificationPreferences: JSON.stringify(preferences),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          company: true,
          notificationPreferences: true,
        },
      })
    })

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json(profileResponse(updated))
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode)
    if (status === 404) return res.status(404).json({ error: 'User not found' })
    return res.status(503).json({ error: 'Profile settings are temporarily unavailable' })
  }
}
