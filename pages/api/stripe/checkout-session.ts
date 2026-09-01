import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { prisma } from '../../../lib/prisma'
import {
  createCheckoutSession,
  createStripeCustomer,
  expireCheckoutSession,
  findOpenCheckoutSessions,
  getBillingAvailability,
  getCanonicalAppUrl,
  getConfiguredPrice,
} from '../../../lib/stripe'
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth'
import { canManageBilling } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'

function billingError(message: string, statusCode: number) {
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
    `billing-checkout:${context.tenant.ownerId}`,
  )) return

  const { interval = 'monthly' } = req.body || {}
  if (interval !== 'monthly' && interval !== 'yearly') {
    return res.status(400).json({ error: 'Choose monthly or yearly billing' })
  }
  if (!getBillingAvailability().available) {
    return res.status(503).json({ error: 'Billing is temporarily unavailable' })
  }

  const priceId = getConfiguredPrice(interval)
  const baseUrl = getCanonicalAppUrl()
  if (!priceId || !baseUrl) {
    return res.status(503).json({ error: 'Billing is temporarily unavailable' })
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const ownerId = context.tenant.ownerId
      await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))) AS billing_lock`

      const user = await tx.user.findUnique({
        where: { id: ownerId },
        include: { subscription: true },
      })
      if (!user) throw billingError('User not found', 404)
      if (
        user.subscription?.stripeSubscriptionId
        && user.subscription.status !== 'CANCELLED'
      ) {
        throw billingError('A subscription already exists for this workspace', 409)
      }

      let customerId = user.subscription?.stripeCustomerId
      if (!customerId) {
        const customer = await createStripeCustomer({
          email: user.email,
          name: user.name || undefined,
          userId: user.id,
          idempotencyKey: `fleetvera-customer-${user.id}`,
        })
        customerId = customer.id
        await tx.subscription.upsert({
          where: { userId: user.id },
          update: { stripeCustomerId: customer.id },
          create: {
            userId: user.id,
            stripeCustomerId: customer.id,
            status: 'TRIAL',
            plan: 'UNLIMITED',
          },
        })
      }

      const openSessions = await findOpenCheckoutSessions(customerId, user.id)
      const reusable = openSessions.find(
        session => session.metadata?.priceId === priceId && session.url,
      )
      if (reusable?.url) return { url: reusable.url, reused: true }

      for (const session of openSessions) {
        await expireCheckoutSession(session.id)
      }

      const checkoutSession = await createCheckoutSession({
        priceId,
        customerId,
        userId: user.id,
        successUrl: `${baseUrl}/dashboard?subscribed=true`,
        cancelUrl: `${baseUrl}/billing`,
        idempotencyKey: `fleetvera-checkout-${user.id}-${randomUUID()}`,
      })
      if (!checkoutSession.url) {
        throw billingError('Stripe checkout URL is unavailable', 503)
      }
      return { url: checkoutSession.url, reused: false }
    }, { maxWait: 5_000, timeout: 30_000 })

    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json(result)
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode)
    if (status === 404 || status === 409) {
      return res.status(status).json({ error: (error as Error).message })
    }
    console.error('Stripe checkout session creation failed')
    return res.status(status === 503 ? 503 : 500).json({
      error: status === 503
        ? 'Billing is temporarily unavailable'
        : 'Failed to create checkout session',
    })
  }
}
