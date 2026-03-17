import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToAnnouncement, announcementToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return res.json(announcements.map(dbToAnnouncement))
  }

  if (req.method === 'POST') {
    const data = announcementToDb(req.body, userId, session.user.name)
    const ann = await prisma.announcement.create({ data })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'announcement', entityId: ann.id,
      description: `Announcement sent: "${ann.message.substring(0, 60)}${ann.message.length > 60 ? '...' : ''}"`,
    })
    return res.status(201).json(dbToAnnouncement(ann))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
