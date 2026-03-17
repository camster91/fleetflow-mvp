import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'
import type { ActivityItem } from '../../../lib/fleet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user) return res.status(401).json({ error: 'Unauthorized' })

  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const entityType = req.query.type as string | undefined

  const logs = await prisma.auditLog.findMany({
    where: entityType ? { entityType } : undefined,
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
    metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
  }))

  res.json(activities)
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
