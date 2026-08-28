import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { dbToClient, clientToDb, logActivity } from '../../../lib/fleet'
import { requireTenantContext, assertSameOrigin } from '../../../lib/apiAuth'
import { canManageClients, canViewClients } from '../../../lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { session, tenant } = context
  if (!assertSameOrigin(req, res)) return

  const { id } = req.query as { id: string }
  const userId = session.user.id
  const scopedWhere = { AND: [{ id }, tenant.resourceWhere] }

  if (req.method === 'GET') {
    if (!canViewClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const client = await prisma.client.findFirst({ where: scopedWhere })
    if (!client) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToClient(client))
  }

  if (req.method === 'PUT') {
    if (!canManageClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const { ownerId: _ownerId, ...fields } = clientToDb(req.body, tenant.ownerId)
    const client = await prisma.$transaction(async (tx) => {
      const result = await tx.client.updateMany({ where: scopedWhere, data: fields })
      // Must re-read with owner scope — findUnique after updateMany leaked other tenants' rows
      if (result.count === 0) return null
      const updated = await tx.client.findFirst({ where: scopedWhere })
      if (!updated) return null
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'updated', entityType: 'client', entityId: id, entityName: updated.name,
        description: `Client "${updated.name}" was updated`,
      })
      return updated
    })
    if (!client) return res.status(404).json({ error: 'Not found' })
    return res.json(dbToClient(client))
  }

  if (req.method === 'DELETE') {
    if (!canManageClients(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
    const client = await prisma.client.findFirst({ where: scopedWhere })
    if (!client) return res.status(404).json({ error: 'Not found' })
    await prisma.$transaction(async (tx) => {
      const result = await tx.client.deleteMany({ where: scopedWhere })
      if (result.count === 0) return
      await logActivity(tx, {
        userId, teamId: tenant.teamId, userName: session.user.name, userRole: tenant.role,
        action: 'deleted', entityType: 'client', entityId: id, entityName: client.name,
        description: `Client "${client.name}" was deleted`,
      })
    })
    return res.json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
