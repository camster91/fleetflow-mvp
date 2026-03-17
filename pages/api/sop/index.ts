import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, sopCategoryToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const cats = await prisma.sOPCategory.findMany({ orderBy: { name: 'asc' } })
    return res.json(cats.map(dbToSOPCategory))
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
