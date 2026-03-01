import { PlanType } from '@/lib/subscription';

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
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small fleets',
    monthlyPrice: 29,
    yearlyPrice: 23,
    stripeMonthlyPriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || 'price_starter_monthly',
    stripeYearlyPriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID || 'price_starter_yearly',
    features: [
      'Up to 10 vehicles',
      'Basic reports',
      'Email support',
      'Mobile app access',
      'Basic maintenance tracking',
      'Driver management',
    ],
    limits: { vehicles: 10, users: 3, apiCalls: 1000 },
    planType: 'STARTER',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'For growing fleets',
    monthlyPrice: 79,
    yearlyPrice: 63,
    stripeMonthlyPriceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || 'price_professional_monthly',
    stripeYearlyPriceId: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || 'price_professional_yearly',
    features: [
      'Up to 50 vehicles',
      'Advanced analytics',
      'Priority support',
      'API access',
      'Custom reports',
      'Fuel tracking',
      'Route optimization',
      'Maintenance scheduling',
      'Team collaboration',
    ],
    limits: { vehicles: 50, users: 10, apiCalls: 10000 },
    planType: 'PROFESSIONAL',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 199,
    yearlyPrice: 159,
    stripeMonthlyPriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly',
    stripeYearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly',
    features: [
      'Unlimited vehicles',
      'White-label options',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'Advanced security',
      'Audit logs',
      'Multi-location support',
      'Custom contracts',
    ],
    limits: { vehicles: -1, users: -1, apiCalls: -1 },
    planType: 'ENTERPRISE',
  },
};

export const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7', 10);

export function getPlanByType(planType: PlanType): PricingPlan {
  switch (planType) {
    case 'STARTER':
      return PRICING_PLANS.starter;
    case 'PROFESSIONAL':
      return PRICING_PLANS.professional;
    case 'ENTERPRISE':
      return PRICING_PLANS.enterprise;
    default:
      return PRICING_PLANS.starter;
  }
}

export function getPlanByStripePriceId(priceId: string): PricingPlan | null {
  for (const plan of Object.values(PRICING_PLANS)) {
    if (plan.stripeMonthlyPriceId === priceId || plan.stripeYearlyPriceId === priceId) {
      return plan;
    }
  }
  return null;
}

export function getPlanTypeFromStripePriceId(priceId: string): PlanType {
  const plan = getPlanByStripePriceId(priceId);
  return plan?.planType || 'STARTER';
}

export function isYearlyPrice(priceId: string): boolean {
  for (const plan of Object.values(PRICING_PLANS)) {
    if (plan.stripeYearlyPriceId === priceId) {
      return true;
    }
  }
  return false;
}

export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
  const yearlyCost = yearlyPrice * 12;
  const monthlyCost = monthlyPrice * 12;
  return monthlyCost - yearlyCost;
}

export function getAllFeatures(): string[] {
  const allFeatures = new Set<string>();
  Object.values(PRICING_PLANS).forEach(plan => {
    plan.features.forEach(feature => allFeatures.add(feature));
  });
  return Array.from(allFeatures);
}

export function comparePlans(plan1: PricingPlan, plan2: PricingPlan): {
  onlyInPlan1: string[];
  onlyInPlan2: string[];
  inBoth: string[];
} {
  const set1 = new Set(plan1.features);
  const set2 = new Set(plan2.features);
  
  return {
    onlyInPlan1: plan1.features.filter(f => !set2.has(f)),
    onlyInPlan2: plan2.features.filter(f => !set1.has(f)),
    inBoth: plan1.features.filter(f => set2.has(f)),
  };
}

/**
 * Get the next higher plan
 */
export function getNextPlan(currentPlan: PlanType): PricingPlan | null {
  const order = [PlanType.STARTER, PlanType.PROFESSIONAL, PlanType.ENTERPRISE];
  const currentIndex = order.indexOf(currentPlan);
  if (currentIndex < order.length - 1) {
    return getPlanByType(order[currentIndex + 1]);
  }
  return null;
}

/**
 * Get the next lower plan
 */
export function getDowngradePlan(currentPlan: PlanType): PricingPlan | null {
  const order = [PlanType.STARTER, PlanType.PROFESSIONAL, PlanType.ENTERPRISE];
  const currentIndex = order.indexOf(currentPlan);
  if (currentIndex > 0) {
    return getPlanByType(order[currentIndex - 1]);
  }
  return null;
}

/**
 * Calculate yearly savings compared to monthly
 */
export function calculateYearlySavings(plan: PricingPlan): number {
  const monthlyCost = plan.monthlyPrice * 12;
  const yearlyCost = plan.yearlyPrice * 12;
  return monthlyCost - yearlyCost;
}
