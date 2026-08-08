import type { NextApiRequest, NextApiResponse } from 'next'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

function authorized(req: NextApiRequest) {
  const configured = process.env.CRON_SECRET || ''
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (configured.length < 32) return false
  const a = Buffer.from(configured), b = Buffer.from(supplied)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' })
  const now = new Date()
  try {
    const deleted = await prisma.$transaction(async tx => {
      const result = await tx.maintenanceRiskFeedback.deleteMany({ where: { expiresAt: { lte: now } } })
      if (result.count) await tx.auditLog.create({ data: { userId: 'system', teamId: null, userName: 'System', userRole: 'SYSTEM', action: 'pilot_feedback_retention_cleanup', entityType: 'maintenance_risk', description: 'Deleted expired maintenance attention pilot feedback', metadata: JSON.stringify({ deleted: result.count }) } })
      return result.count
    })
    return res.status(200).json({ deleted })
  } catch {
    console.error('Maintenance risk feedback retention cleanup failed')
    return res.status(500).json({ error: 'Retention cleanup failed' })
  }
}
