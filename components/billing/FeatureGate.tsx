import React from 'react';

interface FeatureGateProps {
  feature?: string;
  userPlan?: string;
  children: React.ReactNode;
  fallback?: 'hidden' | 'locked' | 'upgrade';
}

// Single-tenant deployment: all features are always accessible.
export const FeatureGate: React.FC<FeatureGateProps> = ({ children }) => <>{children}</>;

export const FeatureBadge: React.FC<{ requiredPlan?: string; currentPlan?: string }> = () => null;

export default FeatureGate;
