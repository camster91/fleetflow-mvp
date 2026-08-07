import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToAnnouncement, announcementToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageAnnouncements, canViewBusinessData } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const announcements = await prisma.announcement.findMany({ where: tenant.resourceWhere, orderBy: { createdAt: 'desc' }, take: 50 })
    return res.json(announcements.map(dbToAnnouncement))
  }

  if (req.method === 'POST') {
    if (!canManageAnnouncements(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const data = {
      ...announcementToDb(req.body, tenant.ownerId, session.user.name),
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const ann = await prisma.announcement.create({ data })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'created', entityType: 'announcement', entityId: ann.id,
      description: `Announcement sent: "${ann.message.substring(0, 60)}${ann.message.length > 60 ? '...' : ''}"`,
    })
    return res.status(201).json(dbToAnnouncement(ann))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
