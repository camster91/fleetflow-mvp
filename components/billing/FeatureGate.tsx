import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { PlanType } from '@/lib/subscription';
import { canAccessFeature, getNextPlan, getPlanDisplayName } from '@/lib/subscription';
import Link from 'next/link';

interface FeatureGateProps {
  feature: string;
  userPlan: PlanType;
  children: React.ReactNode;
  fallback?: 'hidden' | 'locked' | 'upgrade';
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  userPlan,
  children,
  fallback = 'upgrade',
}) => {
  const hasAccess = canAccessFeature(userPlan, feature);
  
  if (hasAccess) {
    return <>{children}</>;
  }

  // Determine which plan has this feature
  const nextPlan = getNextPlan(userPlan);
  const requiredPlan = nextPlan ? nextPlan.planType : 'ENTERPRISE' as PlanType;

  if (fallback === 'hidden') {
    return null;
  }

  if (fallback === 'locked') {
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none filter blur-[1px]">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-slate-200">
            <Lock className="h-6 w-6 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-600 mt-2">Pro Feature</p>
          </div>
        </div>
      </div>
    );
  }

  // fallback === 'upgrade'
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
      <div className="flex items-start space-x-4">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Sparkles className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">
            Upgrade to {getPlanDisplayName(requiredPlan)}
          </h3>
          <p className="text-slate-600 mt-1">
            This feature is available on the {getPlanDisplayName(requiredPlan)} plan. 
            Upgrade now to unlock this and more features.
          </p>
          <div className="mt-4 flex items-center space-x-3">
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Upgrade Now
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Plans →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FeatureBadgeProps {
  requiredPlan: PlanType;
  currentPlan: PlanType;
}

export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  requiredPlan,
  currentPlan,
}) => {
  const isAccessible = canAccessFeature(currentPlan, requiredPlan.toLowerCase());
  
  if (isAccessible) return null;
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
      {getPlanDisplayName(requiredPlan)}
    </span>
  );
};

export default FeatureGate;
