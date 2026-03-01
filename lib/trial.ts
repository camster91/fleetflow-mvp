import { prisma } from './prisma';
import { TRIAL_DAYS } from '@/config/pricing';
import { PlanType, Subscription, SubscriptionStatus } from './subscription';

/**
 * Start a trial for a new user
 */
export async function startTrial(userId: string): Promise<Subscription> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      plan: 'PER_USER',
      status: 'TRIAL',
      trialEndsAt,
    },
  });

  return subscription as Subscription;
}

/**
 * Check if a user is eligible for a trial
 * (user has no existing subscription)
 */
export async function isEligibleForTrial(userId: string): Promise<boolean> {
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  return !existingSubscription;
}

/**
 * Get trial information for a user
 */
export async function getTrialInfo(userId: string): Promise<{
  isInTrial: boolean;
  daysLeft: number;
  trialEndsAt: Date | null;
  isEligible: boolean;
} | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    const eligible = await isEligibleForTrial(userId);
    return {
      isInTrial: false,
      daysLeft: 0,
      trialEndsAt: null,
      isEligible: eligible,
    };
  }

  const isInTrial = subscription.status === 'TRIAL';
  const trialEndsAt = subscription.trialEndsAt;
  
  let daysLeft = 0;
  if (isInTrial && trialEndsAt) {
    const now = new Date();
    const diffTime = trialEndsAt.getTime() - now.getTime();
    daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysLeft = Math.max(0, daysLeft);
  }

  return {
    isInTrial,
    daysLeft,
    trialEndsAt,
    isEligible: false,
  };
}

/**
 * Check if user is in trial period
 */
export function isInTrial(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'TRIAL';
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysLeft(subscription: Subscription | null): number {
  if (!subscription || subscription.status !== 'TRIAL' || !subscription.trialEndsAt) {
    return 0;
  }

  const now = new Date();
  const trialEnds = new Date(subscription.trialEndsAt);
  const diffTime = trialEnds.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, daysLeft);
}

/**
 * Check if trial has expired and update status if needed
 */
export async function checkAndUpdateTrialStatus(subscription: Subscription): Promise<boolean> {
  if (subscription.status !== 'TRIAL' || !subscription.trialEndsAt) {
    return false;
  }

  const now = new Date();
  const trialEnds = new Date(subscription.trialEndsAt);

  if (now > trialEnds) {
    // Trial has expired, update to unpaid status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'UNPAID',
      },
    });
    return true;
  }

  return false;
}

/**
 * Convert trial to active subscription
 */
export async function convertTrialToSubscription(
  subscriptionId: string,
  stripeSubscriptionId: string,
  stripePriceId: string,
  plan: PlanType,
  currentPeriodStart: Date,
  currentPeriodEnd: Date
): Promise<Subscription> {
  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      stripeSubscriptionId,
      stripePriceId,
      plan,
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt: null,
    },
  });

  return subscription as Subscription;
}

/**
 * Get trial status message
 */
export function getTrialStatusMessage(daysLeft: number): string {
  if (daysLeft === 0) {
    return 'Your trial ends today';
  } else if (daysLeft === 1) {
    return 'Your trial ends tomorrow';
  } else if (daysLeft <= 3) {
    return `Your trial ends in ${daysLeft} days`;
  } else {
    return `You have ${daysLeft} days left in your trial`;
  }
}

/**
 * Get trial banner color based on days left
 */
export function getTrialBannerColor(daysLeft: number): {
  bg: string;
  text: string;
  border: string;
  button: string;
} {
  if (daysLeft <= 1) {
    return {
      bg: 'bg-red-50',
      text: 'text-red-900',
      border: 'border-red-200',
      button: 'bg-red-600 hover:bg-red-700 text-white',
    };
  } else if (daysLeft <= 3) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-900',
      border: 'border-orange-200',
      button: 'bg-orange-600 hover:bg-orange-700 text-white',
    };
  } else {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-900',
      border: 'border-blue-200',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
    };
  }
}
