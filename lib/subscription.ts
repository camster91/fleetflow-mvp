import { PRICING_PLANS, getPlanByType, PricingPlan } from '@/config/pricing';

// Note: Prisma with SQLite uses String for enums
// PlanType: 'PER_USER' | 'UNLIMITED'
// SubscriptionStatus: 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'UNPAID'

export type PlanType = 'PER_USER' | 'UNLIMITED';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'UNPAID';

// Constants for PlanType (for use as values)
export const PlanType = {
  PER_USER: 'PER_USER' as const,
  UNLIMITED: 'UNLIMITED' as const,
};

// Constants for subscription status
export const SubscriptionStatusConst = {
  TRIAL: 'TRIAL' as SubscriptionStatus,
  ACTIVE: 'ACTIVE' as SubscriptionStatus,
  CANCELLED: 'CANCELLED' as SubscriptionStatus,
  PAST_DUE: 'PAST_DUE' as SubscriptionStatus,
  UNPAID: 'UNPAID' as SubscriptionStatus,
};

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  plan: PlanType;
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionFeatures {
  vehicles: number;
  users: number;
  apiCalls: number;
}

export interface FeatureAccess {
  [feature: string]: PlanType[];
}

// Define which plans have access to which features
export const FEATURE_ACCESS: FeatureAccess = {
  'basic_reports': ['PER_USER', 'UNLIMITED'],
  'email_support': ['PER_USER', 'UNLIMITED'],
  'mobile_app': ['PER_USER', 'UNLIMITED'],
  'maintenance_tracking': ['PER_USER', 'UNLIMITED'],
  'driver_management': ['PER_USER', 'UNLIMITED'],
  'advanced_analytics': ['PER_USER', 'UNLIMITED'],
  'priority_support': ['UNLIMITED'],
  'api_access': ['UNLIMITED'],
  'custom_reports': ['UNLIMITED'],
  'fuel_tracking': ['PER_USER', 'UNLIMITED'],
  'maintenance_scheduling': ['PER_USER', 'UNLIMITED'],
  'team_collaboration': ['PER_USER', 'UNLIMITED'],
  'white_label': ['UNLIMITED'],
  'dedicated_support': ['UNLIMITED'],
  'custom_integrations': ['UNLIMITED'],
  'sla_guarantee': ['UNLIMITED'],
  'advanced_security': ['UNLIMITED'],
  'audit_logs': ['UNLIMITED'],
  'multi_location': ['PER_USER', 'UNLIMITED'],
  'custom_contracts': ['UNLIMITED'],
};

/**
 * Check if a user's plan can access a specific feature
 * Beta: All features are enabled for all users
 */
export function canAccessFeature(userPlan: PlanType, feature: string): boolean {
  // Beta: All features are enabled
  return true;
  
  // Original code (restore after beta):
  // const allowedPlans = FEATURE_ACCESS[feature];
  // if (!allowedPlans) return false;
  // return allowedPlans.includes(userPlan);
}

/**
 * Get the vehicle limit for a plan
 */
export function getVehicleLimit(plan: PlanType): number {
  const planConfig = getPlanByType(plan);
  return planConfig.limits.vehicles;
}

/**
 * Get the user limit for a plan
 */
export function getUserLimit(plan: PlanType): number {
  const planConfig = getPlanByType(plan);
  return planConfig.limits.users;
}

/**
 * Get the API call limit for a plan
 */
export function getApiCallLimit(plan: PlanType): number {
  const planConfig = getPlanByType(plan);
  return planConfig.limits.apiCalls;
}

/**
 * Check if user has an active subscription (including trial)
 */
export function hasActiveSubscription(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  
  return subscription.status === 'ACTIVE' || 
         subscription.status === 'TRIAL' ||
         (subscription.status === 'CANCELLED' && 
          !!subscription.currentPeriodEnd && 
          new Date() < new Date(subscription.currentPeriodEnd));
}

/**
 * Check if user is in trial period
 */
export function isInTrial(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'TRIAL';
}

/**
 * Check if subscription is past due
 */
export function isPastDue(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'PAST_DUE';
}

/**
 * Check if subscription is cancelled
 */
export function isCancelled(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'CANCELLED' || subscription.cancelAtPeriodEnd;
}

/**
 * Calculate days left in trial
 */
export function getTrialDaysLeft(subscription: Subscription | null): number {
  if (!subscription || subscription.status !== 'TRIAL' || !subscription.trialEndsAt) {
    return 0;
  }
  
  const now = new Date();
  const trialEnds = new Date(subscription.trialEndsAt);
  const diffTime = trialEnds.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Check if trial has expired
 */
export function hasTrialExpired(subscription: Subscription | null): boolean {
  if (!subscription || subscription.status !== 'TRIAL' || !subscription.trialEndsAt) {
    return false;
  }
  
  return new Date() > new Date(subscription.trialEndsAt);
}

/**
 * Get subscription status display text
 */
export function getSubscriptionStatusText(subscription: Subscription | null): string {
  if (!subscription) return 'No Subscription';
  
  switch (subscription.status) {
    case 'TRIAL':
      return 'Trial';
    case 'ACTIVE':
      return subscription.cancelAtPeriodEnd ? 'Active (Cancels at period end)' : 'Active';
    case 'CANCELLED':
      return 'Cancelled';
    case 'PAST_DUE':
      return 'Past Due';
    case 'UNPAID':
      return 'Unpaid';
    default:
      return 'Unknown';
  }
}

/**
 * Get subscription status badge color
 */
export function getSubscriptionStatusColor(subscription: Subscription | null): string {
  if (!subscription) return 'gray';
  
  switch (subscription.status) {
    case 'TRIAL':
      return 'blue';
    case 'ACTIVE':
      return subscription.cancelAtPeriodEnd ? 'yellow' : 'green';
    case 'CANCELLED':
      return 'gray';
    case 'PAST_DUE':
    case 'UNPAID':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get features available for a plan
 */
export function getFeaturesForPlan(plan: PlanType): string[] {
  const features: string[] = [];
  
  for (const [feature, plans] of Object.entries(FEATURE_ACCESS)) {
    if (plans.includes(plan)) {
      features.push(feature);
    }
  }
  
  return features;
}

/**
 * Check if user can add more vehicles
 */
export function canAddVehicle(
  subscription: Subscription | null,
  currentVehicleCount: number
): boolean {
  if (!subscription) return false;
  
  const limit = getVehicleLimit(subscription.plan);
  if (limit === -1) return true; // Unlimited
  
  return currentVehicleCount < limit;
}

/**
 * Check if user can add more users
 */
export function canAddUser(
  subscription: Subscription | null,
  currentUserCount: number
): boolean {
  if (!subscription) return false;
  
  const limit = getUserLimit(subscription.plan);
  if (limit === -1) return true; // Unlimited
  
  return currentUserCount < limit;
}

/**
 * Get plan name display
 */
export function getPlanDisplayName(plan: PlanType): string {
  const planConfig = getPlanByType(plan);
  return planConfig.name;
}

/**
 * Get next plan for upgrade (from PER_USER to UNLIMITED)
 */
export function getNextPlan(currentPlan: PlanType): PricingPlan | null {
  switch (currentPlan) {
    case 'PER_USER':
      return PRICING_PLANS.unlimited;
    case 'UNLIMITED':
      return null; // Already at highest tier
    default:
      return null;
  }
}

/**
 * Get downgrade plan (from UNLIMITED to PER_USER)
 */
export function getDowngradePlan(currentPlan: PlanType): PricingPlan | null {
  switch (currentPlan) {
    case 'UNLIMITED':
      return PRICING_PLANS.perUser;
    case 'PER_USER':
      return null; // Already at lowest tier
    default:
      return null;
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * Check if subscription needs attention (past_due, unpaid, or trial expiring)
 */
export function subscriptionNeedsAttention(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  
  if (subscription.status === 'PAST_DUE' || 
      subscription.status === 'UNPAID') {
    return true;
  }
  
  if (subscription.status === 'TRIAL') {
    const daysLeft = getTrialDaysLeft(subscription);
    return daysLeft <= 3;
  }
  
  return false;
}
