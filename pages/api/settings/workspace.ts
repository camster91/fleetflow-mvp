import { NextApiRequest, NextApiResponse } from 'next'
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
import { canManageSettings } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { canonicalTimeZone, normalizeTimeZone } from '../../../lib/dateOnly'

/**
 * Workspace settings for the selected tenant.
 * GET: any member reads the workspace time zone.
 * PATCH { timeZone }: owner/admin sets the IANA zone used for server-side
 * "today" (Team.timeZone for a team, User.timeZone for a personal workspace).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PATCH'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.method === 'PATCH' && !assertSameOrigin(req, res)) return

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!(await rateLimitMiddleware(req, res, 'api', `settings:${session.user.id}`))) return
  const canEdit = canManageSettings(tenant.role)

  if (req.method === 'GET') {
    const row = tenant.teamId
      ? await prisma.team.findUnique({ where: { id: tenant.teamId }, select: { name: true, timeZone: true } })
      : await prisma.user.findUnique({ where: { id: tenant.ownerId }, select: { name: true, timeZone: true } })
    if (!row) return res.status(404).json({ error: 'Workspace not found' })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({
      scope: tenant.teamId ? 'team' : 'personal',
      name: row.name ?? null,
      timeZone: normalizeTimeZone(row.timeZone),
      canEdit,
    })
  }

  if (!canEdit) {
    return res.status(403).json({ error: 'Only workspace owners and admins can change workspace settings' })
  }
  const timeZone = canonicalTimeZone(req.body?.timeZone)
  if (!timeZone) {
    return res.status(400).json({ error: 'timeZone must be a valid IANA time zone, e.g. America/Toronto' })
  }

  try {
    if (tenant.teamId) {
      await prisma.team.update({ where: { id: tenant.teamId }, data: { timeZone } })
    } else {
      await prisma.user.update({ where: { id: tenant.ownerId }, data: { timeZone } })
    }
  } catch {
    console.error('Workspace time zone update failed')
    return res.status(500).json({ error: 'Failed to update workspace settings' })
  }
  return res.status(200).json({ timeZone })
}
