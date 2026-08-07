import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { createCheckoutSession, createStripeCustomer } from '../../../lib/stripe';
import { assertSameOrigin, requireTenantContext } from '../../../lib/apiAuth';
import { canManageBilling } from '../../../lib/permissions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const context = await requireTenantContext(req, res);
  if (!context) return;
  if (!canManageBilling(context.tenant.role)) return res.status(403).json({ error: 'Forbidden' });
  if (!assertSameOrigin(req, res)) return;

  const { interval = 'monthly' } = req.body;

  const priceId = interval === 'yearly'
    ? process.env.STRIPE_PRICE_YEARLY
    : process.env.STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    return res.status(500).json({ error: 'Stripe price ID not configured' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: context.tenant.ownerId },
      include: { subscription: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let stripeCustomerId = user.subscription?.stripeCustomerId;

    // Create Stripe customer if none exists
    if (!stripeCustomerId) {
      const customer = await createStripeCustomer({
        email: user.email,
        name: user.name || undefined,
        userId: user.id,
      });
      stripeCustomerId = customer.id;

      // Upsert subscription record with the new customer ID
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: { stripeCustomerId: customer.id },
        create: {
          userId: user.id,
          stripeCustomerId: customer.id,
          status: 'TRIAL',
          plan: 'UNLIMITED',
        },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`;
    const checkoutSession = await createCheckoutSession({
      priceId,
      customerId: stripeCustomerId,
      userId: user.id,
      successUrl: `${baseUrl}/dashboard?subscribed=true`,
      cancelUrl: `${baseUrl}/billing`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
