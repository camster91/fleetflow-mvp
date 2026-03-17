import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToSOPCategory, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id
  const { id } = req.query as { id: string }

  if (req.method === 'PUT') {
    const { name, description, count } = req.body
    const cat = await prisma.sOPCategory.update({
      where: { id },
      data: { name, description: description ?? null, documentCount: count ?? undefined },
    })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'updated', entityType: 'sop', entityId: cat.id, entityName: cat.name,
      description: `SOP category "${cat.name}" was updated`,
    })
    return res.json(dbToSOPCategory(cat))
  }

  if (req.method === 'DELETE') {
    const cat = await prisma.sOPCategory.findUnique({ where: { id } })
    await prisma.sOPCategory.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'sop', entityId: id, entityName: cat?.name,
      description: `SOP category "${cat?.name}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
