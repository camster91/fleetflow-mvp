import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { requireTenantContext } from '../../../lib/apiAuth'
import { canViewBilling } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `billing-read:${context.session.user.id}`))) return

  const subscription = await prisma.subscription.findUnique({
    where: { userId: context.tenant.ownerId },
  })

  res.setHeader('Cache-Control', 'private, no-store')
  if (!subscription) {
    return res.status(200).json({ subscription: null })
  }

  return res.status(200).json({
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  })
}
