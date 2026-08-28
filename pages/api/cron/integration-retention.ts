import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { isAuthorizedCronRequest } from '../../../lib/cronAuth'
import { integrationRetentionCutoffs } from '../../../lib/integrations/retention'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  const now = new Date(), cutoffs = integrationRetentionCutoffs(now)
  const deleted = await prisma.$transaction(async (tx) => {
    const rateLimits = await tx.integrationRateLimit.deleteMany({ where: { bucketStart: { lt: cutoffs.rateLimits } } })
    const oauthStates = await tx.integrationOAuthState.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: cutoffs.oauthStates } }] } })
    const syncJobs = await tx.integrationSyncJob.deleteMany({ where: { status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] }, completedAt: { lt: cutoffs.syncJobs } } })
    const stagedRecords = await tx.integrationRecord.deleteMany({ where: { lastSeenAt: { lt: cutoffs.stagedRecords } } })
    return { rateLimits: rateLimits.count, oauthStates: oauthStates.count, syncJobs: syncJobs.count, stagedRecords: stagedRecords.count }
  })
  return res.status(200).json({ deleted, cutoffs })
}