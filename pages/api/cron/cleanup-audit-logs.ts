import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { isAuthorizedCronRequest } from '../../../lib/cronAuth'
import { deleteExpiredIdempotencyKeys } from '../../../lib/idempotency'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorizedCronRequest(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const [loginResult, auditResult, idempotencyKeys] = await Promise.all([
    prisma.loginHistory.deleteMany({
      where: { timestamp: { lt: cutoff } },
    }),
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    }),
    // Idempotency-Key replay records expire after 24 hours.
    deleteExpiredIdempotencyKeys(),
  ])

  return res.status(200).json({
    deleted: {
      loginHistory: loginResult.count,
      auditLog: auditResult.count,
      idempotencyKeys,
    },
    cutoffDate: cutoff.toISOString(),
  })
}