import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { startTrial, isEligibleForTrial } from '@/lib/trial';
// Note: With SQLite, enums are stored as strings

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = session.user.id;

    // Check if user already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (existingSubscription) {
      return res.status(400).json({ 
        error: 'User already has a subscription',
        status: existingSubscription.status,
      });
    }

    // Check eligibility for trial
    const eligible = await isEligibleForTrial(userId);
    if (!eligible) {
      return res.status(400).json({ 
        error: 'User is not eligible for a trial',
      });
    }

    // Start trial
    const subscription = await startTrial(userId);

    return res.status(201).json({
      success: true,
      message: 'Trial started successfully',
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
      },
    });
  } catch (error) {
    console.error('Trial start error:', error);
    return res.status(500).json({ 
      error: 'Failed to start trial',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
