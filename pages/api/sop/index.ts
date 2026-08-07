import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, sopCategoryToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canManageSOP, canViewBusinessData } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id

  if (req.method === 'GET') {
    if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [cats, total] = await Promise.all([
      prisma.sOPCategory.findMany({ where: tenant.resourceWhere, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.sOPCategory.count({ where: tenant.resourceWhere }),
    ])
    return res.json({ data: cats.map(dbToSOPCategory), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageSOP(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const data = { ...sopCategoryToDb(req.body, tenant.ownerId), ownerId: tenant.ownerId, teamId: tenant.teamId }
    const cat = await prisma.sOPCategory.create({ data })
    await logActivity(prisma, {
      userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
      action: 'created', entityType: 'sop', entityId: cat.id, entityName: cat.name,
      description: `SOP category "${cat.name}" was created`,
    })
    return res.status(201).json(dbToSOPCategory(cat))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
