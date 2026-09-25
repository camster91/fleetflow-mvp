import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'
import { parseBody, clientBodySchema } from '../../../lib/validation'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageClients, canViewClients } from '../../../lib/permissions'
import { beginIdempotentRequest } from '../../../lib/idempotency'
import { CLIENT_LIST_SPEC, parseListQuery, scopedWhere } from '../../../lib/listQuery'
import type { Prisma } from '@prisma/client'

/** Whole-workspace counts for the list page stat cards. */
async function clientSummary(scope: object) {
  const [total, restaurantHotel, highRating] = await Promise.all([
    prisma.client.count({ where: scope }),
    prisma.client.count({ where: scopedWhere(scope, [{ type: { in: ['restaurant', 'hotel'] } }]) }),
    prisma.client.count({ where: scopedWhere(scope, [{ rating: { gte: 4 } }]) }),
  ])
  return { total, restaurantHotel, highRating }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  const userId = session.user.id
  if (!assertSameOrigin(req, res)) return

  if (req.method === 'GET') {
    if (!canViewClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const parsed = parseListQuery(req.query, CLIENT_LIST_SPEC)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })
    const { page, limit, skip, conditions, orderBy } = parsed.value

    const where = scopedWhere(tenant.resourceWhere, conditions)
    const [clients, total, summary] = await Promise.all([
      prisma.client.findMany({ where, orderBy: orderBy as Prisma.ClientOrderByWithRelationInput[], skip, take: limit }),
      prisma.client.count({ where }),
      parsed.value.summary ? clientSummary(tenant.resourceWhere) : undefined,
    ])
    return res.json({ data: clients.map(dbToClient), total, page, limit, hasMore: skip + limit < total, ...(summary ? { summary } : {}) })
  }

  if (req.method === 'POST') {
    if (!canManageClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const idempotency = await beginIdempotentRequest(req, res, { tenant, userId, route: 'POST /api/clients' })
    if (!idempotency.proceed) return
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
      await idempotency.store(tx, 201, dbToClient(created))
      return created
    }).catch(idempotency.replayOnConflict)
    if (!client) return
    return res.status(201).json(dbToClient(client))
  }

  res.status(405).json({ error: 'Method not allowed' })
}
