import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  getTrialDaysLeft, 
  hasActiveSubscription,
  canAccessFeature,
  getVehicleLimit,
  getUserLimit,
  getPlanDisplayName,
  subscriptionNeedsAttention,
} from '@/lib/subscription';
import { getPlanByType, PricingPlan } from '@/config/pricing';
import { PlanType } from '../../../types';

interface SubscriptionStatusResponse {
  hasSubscription: boolean;
  isActive: boolean;
  plan: {
    type: PlanType;
    name: string;
    details: PricingPlan;
  } | null;
  status: string;
  trial: {
    isInTrial: boolean;
    daysLeft: number;
  };
  billing: {
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    needsAttention: boolean;
  };
  limits: {
    vehicles: number;
    users: number;
  };
  features: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    // If no subscription exists, return default response
    if (!subscription) {
      const defaultPlan = getPlanByType(PlanType.STARTER);
      const response: SubscriptionStatusResponse = {
        hasSubscription: false,
        isActive: false,
        plan: null,
        status: 'NO_SUBSCRIPTION',
        trial: {
          isInTrial: false,
          daysLeft: 0,
        },
        billing: {
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          needsAttention: false,
        },
        limits: {
          vehicles: defaultPlan.limits.vehicles,
          users: defaultPlan.limits.users,
        },
        features: defaultPlan.features,
      };
      return res.status(200).json(response);
    }

    // Build response
    const planDetails = getPlanByType(subscription.plan as PlanType);
    const trialDaysLeft = getTrialDaysLeft(subscription);
    const isActive = hasActiveSubscription(subscription);
    const needsAttention = subscriptionNeedsAttention(subscription);

    const response: SubscriptionStatusResponse = {
      hasSubscription: true,
      isActive,
      plan: {
        type: subscription.plan as PlanType,
        name: getPlanDisplayName(subscription.plan as PlanType),
        details: planDetails,
      },
      status: subscription.status,
      trial: {
        isInTrial: subscription.status === 'TRIAL',
        daysLeft: trialDaysLeft,
      },
      billing: {
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        needsAttention,
      },
      limits: {
        vehicles: getVehicleLimit(subscription.plan as PlanType),
        users: getUserLimit(subscription.plan as PlanType),
      },
      features: planDetails.features,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Subscription status error:', error);
    return res.status(500).json({ 
      error: 'Failed to get subscription status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
