import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, sopCategoryToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [cats, total] = await Promise.all([
      prisma.sOPCategory.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.sOPCategory.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: cats.map(dbToSOPCategory), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    const data = sopCategoryToDb(req.body, userId)
    const cat = await prisma.sOPCategory.create({ data })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'sop', entityId: cat.id, entityName: cat.name,
      description: `SOP category "${cat.name}" was created`,
    })
    return res.status(201).json(dbToSOPCategory(cat))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
