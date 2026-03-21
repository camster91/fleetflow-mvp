import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = req.headers['x-cron-secret']
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const [loginResult, auditResult] = await Promise.all([
    prisma.loginHistory.deleteMany({
      where: { timestamp: { lt: cutoff } },
    }),
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    }),
  ])

  return res.status(200).json({
    deleted: {
      loginHistory: loginResult.count,
      auditLog: auditResult.count,
    },
    cutoffDate: cutoff.toISOString(),
  })
}
