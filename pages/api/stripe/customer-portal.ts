import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createCustomerPortalSession } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { returnUrl } = req.body;

    if (!returnUrl) {
      return res.status(400).json({ error: 'Missing required field: returnUrl' });
    }

    // Get user subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ 
        error: 'No Stripe customer found. Please subscribe first.' 
      });
    }

    // Create customer portal session
    const portalSession = await createCustomerPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl,
    });

    return res.status(200).json({
      url: portalSession.url,
    });
  } catch (error) {
    console.error('Customer portal error:', error);
    return res.status(500).json({ 
      error: 'Failed to create customer portal session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
