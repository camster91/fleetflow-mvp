import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'
import { parseBody, clientBodySchema } from '../../../lib/validation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where: { ownerId: userId }, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.client.count({ where: { ownerId: userId } }),
    ])
    return res.json({ data: clients.map(dbToClient), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    const parsed = parseBody(clientBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const data = clientToDb({ ...req.body, ...parsed.data }, userId)
    const client = await prisma.client.create({ data })
    await logActivity(prisma, {
      userId,
      userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'client',
      entityId: client.id, entityName: client.name,
      description: `Client "${client.name}" was added`,
    })
    return res.status(201).json(dbToClient(client))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
