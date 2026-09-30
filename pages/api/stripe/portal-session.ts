import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { createCustomerPortalSession, getBillingAvailability } from '../../../lib/stripe'
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth'
import { canManageBilling } from '../../../lib/permissions'
import { rateLimitMiddleware } from '../../../lib/rateLimit'

/**
 * POST: open the Stripe customer portal so an owner/admin can replace a failed card or manage payment
 * details. Checkout cannot do this for an existing subscription, so without it a failed payment could
 * only be fixed outside the app.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return

  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canManageBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `billing-portal:${context.tenant.ownerId}`))) return

  const { available, canonicalUrl } = getBillingAvailability()
  if (!available || !canonicalUrl) return res.status(503).json({ error: 'Billing is temporarily unavailable' })

  const subscription = await prisma.subscription.findUnique({
    where: { userId: context.tenant.ownerId },
    select: { stripeCustomerId: true },
  })
  if (!subscription?.stripeCustomerId) {
    return res.status(409).json({ error: 'This workspace has no billing account yet' })
  }

  try {
    const session = await createCustomerPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${canonicalUrl}/billing`,
    })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).json({ url: session.url })
  } catch {
    console.error('Stripe customer portal session creation failed')
    return res.status(503).json({ error: 'Billing is temporarily unavailable' })
  }
}
