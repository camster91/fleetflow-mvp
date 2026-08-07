import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageAnnouncements } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!canManageAnnouncements(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  const userId = session.user.id
  const { id } = req.query as { id: string }

  if (req.method === 'DELETE') {
    const ann = await prisma.announcement.findFirst({ where: { AND: [{ id }, tenant.resourceWhere] } })
    if (!ann) return res.status(404).json({ error: 'Not found' })
    await prisma.announcement.delete({ where: { id } })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'deleted', entityType: 'announcement', entityId: id,
      description: `Announcement deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
