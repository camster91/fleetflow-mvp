import { PlanType } from '@/types';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  stripeMonthlyPriceId: string;
  stripeYearlyPriceId: string;
  features: string[];
  limits: {
    vehicles: number;
    users: number;
    apiCalls: number;
  };
  planType: PlanType;
  isPerUser?: boolean;
}

export const TRIAL_DAYS = 365; // Free for beta testing (1 year)

export const PRICING_PLANS: Record<string, PricingPlan> = {
  perUser: {
    id: 'perUser',
    name: 'Per User',
    description: 'Pay per team member',
    monthlyPrice: 50,
    yearlyPrice: 40, // 20% discount for yearly
    stripeMonthlyPriceId: process.env.STRIPE_PERUSER_MONTHLY_PRICE_ID || 'price_peruser_monthly',
    stripeYearlyPriceId: process.env.STRIPE_PERUSER_YEARLY_PRICE_ID || 'price_peruser_yearly',
    features: [
      'Unlimited vehicles',
      'All features included',
      'Priority support',
      'API access',
      'Advanced analytics',
      'Custom reports',
      'Team collaboration',
      'Maintenance scheduling',
      'Delivery tracking',
    ],
    limits: { vehicles: -1, users: -1, apiCalls: 10000 },
    planType: 'PER_USER' as PlanType,
    isPerUser: true,
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Flat rate for entire team',
    monthlyPrice: 200,
    yearlyPrice: 160, // 20% discount for yearly
    stripeMonthlyPriceId: process.env.STRIPE_UNLIMITED_MONTHLY_PRICE_ID || 'price_unlimited_monthly',
    stripeYearlyPriceId: process.env.STRIPE_UNLIMITED_YEARLY_PRICE_ID || 'price_unlimited_yearly',
    features: [
      'Unlimited vehicles',
      'Unlimited users',
      'All features included',
      'Priority support',
      'API access',
      'Advanced analytics',
      'Custom reports',
      'White-label options',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limits: { vehicles: -1, users: -1, apiCalls: -1 },
    planType: 'UNLIMITED' as PlanType,
    isPerUser: false,
  },
};

export function getPlanByType(planType: PlanType): PricingPlan {
  switch (planType) {
    case 'PER_USER':
      return PRICING_PLANS.perUser;
    case 'UNLIMITED':
      return PRICING_PLANS.unlimited;
    default:
      return PRICING_PLANS.perUser;
  }
}

export function getPlanById(id: string): PricingPlan | undefined {
  return PRICING_PLANS[id];
}

export function getAllPlans(): PricingPlan[] {
  return Object.values(PRICING_PLANS);
}

export function getPlanDisplayName(planType: PlanType): string {
  switch (planType) {
    case 'PER_USER':
      return 'Per User';
    case 'UNLIMITED':
      return 'Unlimited';
    default:
      return 'Per User';
  }
}

export function getVehicleLimit(plan: PlanType): number {
  return -1; // Unlimited for both plans
}

export function getUserLimit(plan: PlanType): number {
  return -1; // Unlimited for both plans
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyCost = yearlyPrice * 12;
  const monthlyCost = monthlyPrice * 12;
  return monthlyCost - yearlyCost;
}

export function getPlanComparison(): {
  feature: string;
  perUser: string;
  unlimited: string;
}[] {
  return [
    { feature: 'Price', perUser: '$50/user/month', unlimited: '$200/month flat' },
    { feature: 'Vehicles', perUser: 'Unlimited', unlimited: 'Unlimited' },
    { feature: 'Users', perUser: 'Pay per user', unlimited: 'Unlimited' },
    { feature: 'Support', perUser: 'Priority', unlimited: 'Priority + Dedicated' },
    { feature: 'API Access', perUser: '✓', unlimited: '✓' },
    { feature: 'Analytics', perUser: 'Advanced', unlimited: 'Advanced + Custom' },
    { feature: 'White-label', perUser: '—', unlimited: '✓' },
    { feature: 'SLA', perUser: '—', unlimited: '✓' },
  ];
}

export function getRecommendedPlan(userCount: number): 'perUser' | 'unlimited' {
  // Break-even at 4 users: 4 × $50 = $200
  return userCount <= 4 ? 'perUser' : 'unlimited';
}

export function calculatePrice(planId: 'perUser' | 'unlimited', userCount: number, billingCycle: 'monthly' | 'yearly'): number {
  const plan = PRICING_PLANS[planId];
  const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  
  if (planId === 'perUser') {
    return price * userCount;
  }
  
  return price;
}

/**
 * Map Stripe price ID to plan type
 */
export function getPlanTypeFromStripePriceId(priceId: string): PlanType {
  const perUserPriceIds = [
    PRICING_PLANS.perUser.stripeMonthlyPriceId,
    PRICING_PLANS.perUser.stripeYearlyPriceId,
  ];
  
  const unlimitedPriceIds = [
    PRICING_PLANS.unlimited.stripeMonthlyPriceId,
    PRICING_PLANS.unlimited.stripeYearlyPriceId,
  ];
  
  if (perUserPriceIds.includes(priceId)) {
    return 'PER_USER';
  }
  
  if (unlimitedPriceIds.includes(priceId)) {
    return 'UNLIMITED';
  }
  
  // Default to PER_USER if unknown
  console.warn(`Unknown price ID: ${priceId}, defaulting to PER_USER`);
  return 'PER_USER';
}
