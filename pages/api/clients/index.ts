import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } })
    return res.json(clients.map(dbToClient))
  }

  if (req.method === 'POST') {
    const data = clientToDb(req.body, (session.user as any).id)
    const client = await prisma.client.create({ data })
    await logActivity(prisma, {
      userId: (session.user as any).id,
      userName: session.user.name, userRole: (session.user as any).role,
      action: 'created', entityType: 'client',
      entityId: client.id, entityName: client.name,
      description: `Client "${client.name}" was added`,
    })
    return res.status(201).json(dbToClient(client))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
