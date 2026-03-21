import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { cancelSubscription } from '../../../lib/stripe';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!subscription?.stripeSubscriptionId) {
    return res.status(400).json({ error: 'No active subscription to cancel' });
  }

  try {
    await cancelSubscription(subscription.stripeSubscriptionId, true);

    await prisma.subscription.update({
      where: { userId: session.user.id },
      data: { cancelAtPeriodEnd: true },
    });

    return res.status(200).json({ message: 'Subscription will cancel at period end' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}
