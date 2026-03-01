import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { stripe, createCheckoutSession, createStripeCustomer } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getPlanTypeFromStripePriceId, getPlanByType, TRIAL_DAYS } from '@/config/pricing';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: priceId, successUrl, cancelUrl' 
      });
    }

    // Validate the price ID exists in our pricing config
    const planType = getPlanTypeFromStripePriceId(priceId);
    if (!planType) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }
    const plan = getPlanByType(planType);

    // Get user and existing subscription
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get or create Stripe customer
    let customerId = user.subscription?.stripeCustomerId;
    
    if (!customerId) {
      // Create a new Stripe customer
      const customer = await createStripeCustomer({
        email: user.email,
        name: user.name || undefined,
        userId: user.id,
      });
      customerId = customer.id;

      // Update or create subscription record with customer ID
      if (user.subscription) {
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { stripeCustomerId: customerId },
        });
      } else {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            stripeCustomerId: customerId,
            plan: planType,
          },
        });
      }
    }

    // Determine if we should offer trial
    // Only offer trial for new subscriptions that haven't had a trial before
    const shouldOfferTrial = !user.subscription || 
      (!user.subscription.stripeSubscriptionId && 
       user.subscription.status === 'TRIAL');

    // Create checkout session
    const checkoutSession = await createCheckoutSession({
      priceId,
      customerId,
      userId: user.id,
      successUrl,
      cancelUrl,
      trialDays: shouldOfferTrial ? TRIAL_DAYS : 0,
    });

    return res.status(200).json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
