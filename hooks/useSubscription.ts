import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { PlanType } from '@/lib/subscription';
import { PricingPlan } from '@/config/pricing';

interface SubscriptionStatus {
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

interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isFeatureEnabled: (feature: string) => boolean;
  canAddVehicle: (currentCount: number) => boolean;
  canAddUser: (currentCount: number) => boolean;
}

export function useSubscription(): UseSubscriptionReturn {
  const { data: session, status: sessionStatus } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (sessionStatus !== 'authenticated' || !session?.user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/subscription/status');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch subscription status');
      }

      const data = await response.json();
      setSubscription(data);

      // Store subscription status in cookie for middleware
      document.cookie = `subscription_status=${JSON.stringify({
        isActive: data.isActive,
        hasSubscription: data.hasSubscription,
        trial: data.trial,
        billing: data.billing,
      })}; path=/; max-age=86400`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [session, sessionStatus]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isFeatureEnabled = useCallback((feature: string): boolean => {
    if (!subscription?.plan?.type) return false;
    
    const featureAccess: Record<string, PlanType[]> = {
      'basic_reports': ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      'email_support': ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      'mobile_app': ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      'maintenance_tracking': ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      'driver_management': ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
      'advanced_analytics': ['PROFESSIONAL', 'ENTERPRISE'],
      'priority_support': ['PROFESSIONAL', 'ENTERPRISE'],
      'api_access': ['PROFESSIONAL', 'ENTERPRISE'],
      'custom_reports': ['PROFESSIONAL', 'ENTERPRISE'],
      'fuel_tracking': ['PROFESSIONAL', 'ENTERPRISE'],
      'route_optimization': ['PROFESSIONAL', 'ENTERPRISE'],
      'maintenance_scheduling': ['PROFESSIONAL', 'ENTERPRISE'],
      'team_collaboration': ['PROFESSIONAL', 'ENTERPRISE'],
      'white_label': ['ENTERPRISE'],
      'dedicated_support': ['ENTERPRISE'],
      'custom_integrations': ['ENTERPRISE'],
      'sla_guarantee': ['ENTERPRISE'],
      'advanced_security': ['ENTERPRISE'],
      'audit_logs': ['ENTERPRISE'],
      'multi_location': ['ENTERPRISE'],
      'custom_contracts': ['ENTERPRISE'],
    };

    const allowedPlans = featureAccess[feature];
    if (!allowedPlans) return false;
    
    return allowedPlans.includes(subscription.plan.type);
  }, [subscription]);

  const canAddVehicle = useCallback((currentCount: number): boolean => {
    if (!subscription?.limits.vehicles) return false;
    const limit = subscription.limits.vehicles;
    if (limit === -1) return true; // Unlimited
    return currentCount < limit;
  }, [subscription]);

  const canAddUser = useCallback((currentCount: number): boolean => {
    if (!subscription?.limits.users) return false;
    const limit = subscription.limits.users;
    if (limit === -1) return true; // Unlimited
    return currentCount < limit;
  }, [subscription]);

  return {
    subscription,
    isLoading,
    error,
    refetch: fetchSubscription,
    isFeatureEnabled,
    canAddVehicle,
    canAddUser,
  };
}

export default useSubscription;
