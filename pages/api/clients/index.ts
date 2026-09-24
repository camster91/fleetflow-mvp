import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'
import { parseBody, clientBodySchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageClients, canViewClients } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50))
    const skip = (page - 1) * limit

    const [clients, total] = await Promise.all([
      prisma.client.findMany({ where: tenant.resourceWhere, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip, take: limit }),
      prisma.client.count({ where: tenant.resourceWhere }),
    ])
    return res.json({ data: clients.map(dbToClient), total, page, limit, hasMore: skip + limit < total })
  }

  if (req.method === 'POST') {
    if (!canManageClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseBody(clientBodySchema, req.body)
    if ('error' in parsed) return res.status(400).json({ error: parsed.error })
    const data = {
      ...clientToDb({ ...req.body, ...parsed.data }, tenant.ownerId),
      ownerId: tenant.ownerId,
      teamId: tenant.teamId,
    }
    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({ data })
      await logActivity(tx, {
        userId,
        teamId: tenant.teamId,
        userName: session.user.name, userRole: tenant.role,
        action: 'created', entityType: 'client',
        entityId: created.id, entityName: created.name,
        description: `Client "${created.name}" was added`,
      })
      return created
    })
    return res.status(201).json(dbToClient(client))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
