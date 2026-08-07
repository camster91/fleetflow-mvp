import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageSOP } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!canManageSOP(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  const userId = session.user.id
  const { id } = req.query as { id: string }
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'PUT') {
    const existing = await prisma.sOPCategory.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { name, description, count } = req.body
    const cat = await prisma.sOPCategory.update({
      where: { id },
      data: { name, description: description ?? null, documentCount: count ?? undefined },
    })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'updated', entityType: 'sop', entityId: cat.id, entityName: cat.name,
      description: `SOP category "${cat.name}" was updated`,
    })
    return res.json(dbToSOPCategory(cat))
  }

  if (req.method === 'DELETE') {
    const cat = await prisma.sOPCategory.findFirst({ where: scopedWhere })
    if (!cat) return res.status(404).json({ error: 'Not found' })
    await prisma.sOPCategory.delete({ where: { id } })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'deleted', entityType: 'sop', entityId: id, entityName: cat?.name,
      description: `SOP category "${cat?.name}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
