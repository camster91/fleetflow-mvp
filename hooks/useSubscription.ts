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
    // Beta: All features are enabled for all users
    return true;
    
    // Original code (restore after beta):
    /*
    if (!subscription?.plan?.type) return false;
    
    const featureAccess: Record<string, PlanType[]> = {
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
      'route_optimization': ['PER_USER', 'UNLIMITED'],
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

    const allowedPlans = featureAccess[feature];
    if (!allowedPlans) return false;
    
    return allowedPlans.includes(subscription.plan.type);
    */
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
