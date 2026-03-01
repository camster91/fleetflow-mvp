import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useSubscription } from '@/hooks/useSubscription';
import { useSession } from 'next-auth/react';
import { 
  CreditCard, 
  Calendar, 
  Check, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  Package,
  Users,
  Zap,
  ArrowRight,
  X
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PRICING_PLANS, getNextPlan, getDowngradePlan, calculateYearlySavings } from '@/config/pricing';
import { formatPrice, getPlanDisplayName } from '@/lib/subscription';

const BillingPage: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const { subscription, isLoading, refetch } = useSubscription();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Redirect to pricing if no subscription
  useEffect(() => {
    if (!isLoading && !subscription?.hasSubscription) {
      router.push('/pricing');
    }
  }, [isLoading, subscription, router]);

  const handleManagePayment = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/billing`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open customer portal');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleCancelSubscription = async (atPeriodEnd: boolean) => {
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atPeriodEnd }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      toast.success(data.message);
      setShowCancelConfirm(false);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (isLoading || !subscription?.hasSubscription) {
    return (
      <DashboardLayout title="Billing" subtitle="Manage your subscription and billing">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  const currentPlan = subscription.plan?.details;
  const nextPlan = subscription.plan?.type ? getNextPlan(subscription.plan.type) : null;
  const isYearly = currentPlan ? billingCycle === 'yearly' : false;

  return (
    <DashboardLayout title="Billing" subtitle="Manage your subscription and billing">
      <div className="space-y-6">
        {/* Current Plan Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Current Plan</h2>
                <p className="text-sm text-slate-500 mt-1">
                  You are currently on the {subscription.plan?.name} plan
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {subscription.isActive ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <Check className="h-4 w-4 mr-1.5" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <AlertCircle className="h-4 w-4 mr-1.5" />
                    Inactive
                  </span>
                )}
                {subscription.billing.cancelAtPeriodEnd && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    Cancelling
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center text-sm text-slate-600">
                  <Package className="h-4 w-4 mr-2" />
                  Plan
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {subscription.plan?.name}
                </p>
                <p className="text-sm text-slate-500">
                  {isYearly 
                    ? `${formatPrice(currentPlan?.yearlyPrice || 0)}/month billed annually`
                    : `${formatPrice(currentPlan?.monthlyPrice || 0)}/month`
                  }
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center text-sm text-slate-600">
                  <Users className="h-4 w-4 mr-2" />
                  Usage
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {subscription.limits.vehicles === -1 
                    ? 'Unlimited' 
                    : `${subscription.limits.vehicles} vehicles`
                  }
                </p>
                <p className="text-sm text-slate-500">
                  {subscription.limits.users === -1 
                    ? 'Unlimited users' 
                    : `Up to ${subscription.limits.users} users`
                  }
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center text-sm text-slate-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  {subscription.trial.isInTrial ? 'Trial Ends' : 'Next Billing'}
                </div>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {subscription.billing.currentPeriodEnd 
                    ? new Date(subscription.billing.currentPeriodEnd).toLocaleDateString()
                    : 'N/A'
                  }
                </p>
                {subscription.trial.isInTrial && (
                  <p className="text-sm text-blue-600">
                    {subscription.trial.daysLeft} days left
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={handleManagePayment}
                disabled={isPortalLoading}
                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {isPortalLoading ? 'Loading...' : 'Manage Payment Method'}
              </button>

              {!subscription.billing.cancelAtPeriodEnd && !subscription.trial.isInTrial && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Cancel Subscription
                </button>
              )}

              {subscription.billing.cancelAtPeriodEnd && (
                <p className="text-sm text-yellow-700">
                  Your subscription will be cancelled at the end of this billing period
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Upgrade/Downgrade Options */}
        {nextPlan && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Upgrade to {nextPlan.name}
                  </h3>
                  <p className="text-slate-600 mt-1">
                    Get {nextPlan.limits.vehicles === -1 ? 'unlimited' : nextPlan.limits.vehicles} vehicles, 
                    priority support, and more advanced features.
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Upgrade Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </div>
          </div>
        )}

        {/* Plan Comparison */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Plan Features</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {currentPlan?.features.map((feature, index) => (
                <div key={index} className="flex items-center">
                  <div className="flex-shrink-0 w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="ml-3 text-slate-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/billing/invoices"
            className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center">
              <div className="p-2 bg-slate-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-slate-600" />
              </div>
              <div className="ml-3">
                <p className="font-medium text-slate-900">Invoices</p>
                <p className="text-sm text-slate-500">View and download past invoices</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Cancel Subscription?</h3>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-600 mb-6">
              You can cancel immediately or at the end of your billing period. 
              Your access will continue until {subscription.billing.currentPeriodEnd 
                ? new Date(subscription.billing.currentPeriodEnd).toLocaleDateString()
                : 'the end of the period'}.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => handleCancelSubscription(true)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel at Period End
              </button>
              <button
                onClick={() => handleCancelSubscription(false)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel Now
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default BillingPage;
