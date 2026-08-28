import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { cancelSubscription } from '../../../lib/stripe'
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth'
import { canManageBilling } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'

function cancellationError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return

  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canManageBilling(context.tenant.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!await rateLimitMiddleware(
    req,
    res,
    'api',
    `billing-cancel:${context.tenant.ownerId}`,
  )) return

  try {
    const result = await prisma.$transaction(async tx => {
      const ownerId = context.tenant.ownerId
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))) AS billing_lock`
      const subscription = await tx.subscription.findUnique({
        where: { userId: ownerId },
      })

      if (!subscription?.stripeSubscriptionId) {
        throw cancellationError('No active subscription to cancel', 400)
      }
      if (subscription.cancelAtPeriodEnd) {
        return { alreadyScheduled: true }
      }

      await cancelSubscription(subscription.stripeSubscriptionId, true)
      await tx.subscription.update({
        where: { userId: ownerId },
        data: { cancelAtPeriodEnd: true },
      })
      await tx.auditLog.create({
        data: {
          userId: context.session.user.id,
          teamId: context.tenant.teamId,
          userName: context.session.user.name || null,
          userRole: context.tenant.role,
          action: 'updated',
          entityType: 'subscription',
          entityId: subscription.id,
          description: 'Subscription cancellation scheduled for period end',
          metadata: JSON.stringify({ cancelAtPeriodEnd: true }),
        },
      })
      return { alreadyScheduled: false }
    }, { maxWait: 5_000, timeout: 30_000 })

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({
      message: 'Subscription will cancel at period end',
      ...result,
    })
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode)
    if (status === 400) {
      return res.status(400).json({ error: (error as Error).message })
    }
    console.error('Stripe subscription cancellation failed')
    return res.status(500).json({ error: 'Failed to cancel subscription' })
  }
}
