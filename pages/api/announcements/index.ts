import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToAnnouncement, announcementToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { parseBody, announcementBodySchema } from '../../../lib/validation'
import { canManageAnnouncements, canViewBusinessData } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const announcements = await prisma.announcement.findMany({ where: tenant.resourceWhere, orderBy: { createdAt: 'desc' }, take: 50 })
    return res.json(announcements.map(dbToAnnouncement))
  }

  if (req.method === 'POST') {
    if (!canManageAnnouncements(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseBody(announcementBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const data = {
      ...announcementToDb(parsed.data, tenant.ownerId, session.user.name),
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const ann = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({ data })
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'created', entityType: 'announcement', entityId: created.id,
        description: `Announcement sent: "${created.message.substring(0, 60)}${created.message.length > 60 ? '...' : ''}"`,
      })
      return created
    })
    return res.status(201).json(dbToAnnouncement(ann))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
