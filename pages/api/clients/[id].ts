import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query as { id: string }
  const userId = (session.user as any).id

  if (req.method === 'GET') {
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToClient(client))
  }

  if (req.method === 'PUT') {
    const { ownerId: _o, ...fields } = clientToDb(req.body, userId) as any
    const client = await prisma.client.update({ where: { id }, data: fields })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'updated', entityType: 'client', entityId: id, entityName: client.name,
      description: `Client "${client.name}" was updated`,
    })
    return res.json(dbToClient(client))
  }

  if (req.method === 'DELETE') {
    const client = await prisma.client.findUnique({ where: { id } })
    if (!client) return res.status(404).json({ error: 'Not found' })
    await prisma.client.delete({ where: { id } })
    await logActivity(prisma, {
      userId, userName: session.user.name, userRole: (session.user as any).role,
      action: 'deleted', entityType: 'client', entityId: id, entityName: client.name,
      description: `Client "${client.name}" was deleted`,
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
