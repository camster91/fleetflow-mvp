import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import type { ActivityItem } from '../../../lib/fleet'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewBusinessData } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { parseActivityFilters, parseAuditMetadata } from '../../../lib/readQuery'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewBusinessData(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!await rateLimitMiddleware(req, res, 'api', `activity:${session.user.id}`)) return

  const parsed = parseActivityFilters(req.query.limit, req.query.type)
  if (!parsed.ok) return res.status(400).json({ error: parsed.error })
  const { limit, entityType } = parsed.value

  try {
    const logs = await prisma.auditLog.findMany({
      where: { AND: [tenant.auditWhere, ...(entityType ? [{ entityType }] : [])] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const activities: ActivityItem[] = logs.map((log) => ({
      id: log.id,
      type: (log.entityType as ActivityItem['type']) || 'user',
      action: (log.action as ActivityItem['action']) || 'updated',
      title: toTitle(log.action, log.entityType),
      description: log.description,
      user: log.userName || 'Unknown',
      userRole: log.userRole || 'user',
      timestamp: log.createdAt.toISOString(),
      metadata: parseAuditMetadata(log.metadata),
    }))

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json(activities)
  } catch {
    return res.status(500).json({ error: 'Activity feed unavailable' })
  }
}

function toTitle(action: string, entityType: string): string {
  const entity = entityType.charAt(0).toUpperCase() + entityType.slice(1)
  const verb: Record<string, string> = {
    created: 'Added',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    assigned: 'Assigned',
    status_changed: 'Status Changed',
  }
  return `${entity} ${verb[action] || action}`
}
