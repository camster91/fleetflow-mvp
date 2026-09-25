import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { telemetryRetentionCutoff } from '@/lib/ai/telemetry'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!isAuthorizedCronRequest(req)) return res.status(401).json({ error: 'Unauthorized' })
  const now = new Date()
  let deleted = 0,
    workspaces = 0,
    cursor: string | undefined
  do {
    const configs = await prisma.aiWorkspaceConfig.findMany({
      select: { scopeKey: true, retentionDays: true },
      orderBy: { scopeKey: 'asc' },
      take: 500,
      ...(cursor ? { cursor: { scopeKey: cursor }, skip: 1 } : {}),
    })
    if (!configs.length) break
    for (const config of configs) {
      const result = await prisma.aiTelemetryBucket.deleteMany({
        where: { scopeKey: config.scopeKey, bucketStart: { lt: telemetryRetentionCutoff(now, config.retentionDays) } },
      })
      deleted += result.count
      workspaces++
    }
    cursor = configs.at(-1)!.scopeKey
    if (configs.length < 500) break
  } while (true)
  return res.status(200).json({ deleted, workspaces })
}
