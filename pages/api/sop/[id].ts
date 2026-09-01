import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, logActivity } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { sopCategoryBodySchema } from '../../../lib/sopValidation'
import { canManageSOP } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return
  if (!canManageSOP(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  const userId = session.user.id
  const { id } = req.query as { id: string }
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'PUT') {
    const parsed = sopCategoryBodySchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid SOP category' })
    const existing = await prisma.sOPCategory.findFirst({ where: scopedWhere })
    if (!existing) return res.status(404).json({ error: 'Not found' })
    const { name, description, count } = parsed.data
    const cat = await prisma.$transaction(async (tx) => {
      const result = await tx.sOPCategory.updateMany({
        where: scopedWhere,
        data: { name, description: description ?? null, documentCount: count ?? undefined },
      })
      if (result.count === 0) return null
      const updated = await tx.sOPCategory.findFirst({ where: scopedWhere })
      if (!updated) return null
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'updated', entityType: 'sop', entityId: updated.id, entityName: updated.name,
        description: `SOP category "${updated.name}" was updated`,
      })
      return updated
    })
    if (!cat) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToSOPCategory(cat))
  }

  if (req.method === 'DELETE') {
    const cat = await prisma.sOPCategory.findFirst({ where: scopedWhere })
    if (!cat) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      const result = await tx.sOPCategory.deleteMany({ where: scopedWhere })
      if (result.count === 0) return
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'sop', entityId: id, entityName: cat.name,
        description: `SOP category "${cat.name}" was deleted`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
