import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cancelSubscription } from '@/lib/stripe';
import { SubscriptionStatus } from '@/lib/subscription';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { atPeriodEnd = true } = req.body;

    // Get user subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (!subscription.stripeSubscriptionId) {
      return res.status(400).json({ 
        error: 'No active Stripe subscription found',
      });
    }

    // Cancel in Stripe
    await cancelSubscription(subscription.stripeSubscriptionId, atPeriodEnd);

    // Update local subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: atPeriodEnd,
        ...(atPeriodEnd ? {} : { status: 'CANCELLED' }),
      },
    });

    return res.status(200).json({
      success: true,
      message: atPeriodEnd 
        ? 'Subscription will be cancelled at the end of the billing period' 
        : 'Subscription cancelled immediately',
    });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
