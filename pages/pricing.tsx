import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Check, 
  Users,
  Infinity,
  Loader2,
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { PRICING_PLANS, calculatePrice, getRecommendedPlan } from '@/config/pricing';
import { useSubscription } from '@/hooks/useSubscription';

const PricingPage: React.FC = () => {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { subscription, isLoading: subLoading } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [userCount, setUserCount] = useState(5);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (planId: 'perUser' | 'unlimited') => {
    if (sessionStatus !== 'authenticated') {
      router.push('/auth/login?callbackUrl=/pricing');
      return;
    }

    const plan = PRICING_PLANS[planId];
    const priceId = billingCycle === 'yearly' ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;

    setIsLoading(planId);
    try {
      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const handleStartTrial = async () => {
    if (sessionStatus !== 'authenticated') {
      router.push('/auth/login?callbackUrl=/pricing');
      return;
    }

    setIsLoading('trial');
    try {
      const response = await fetch('/api/subscription/trial-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start trial');
      }

      toast.success('Your 7-day trial has started!');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const perUserPlan = PRICING_PLANS.perUser;
  const unlimitedPlan = PRICING_PLANS.unlimited;
  const recommendedPlan = getRecommendedPlan(userCount);

  const perUserTotal = calculatePrice('perUser', userCount, billingCycle);
  const unlimitedTotal = calculatePrice('unlimited', userCount, billingCycle);

  return (
    <MarketingLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              Choose the plan that works best for your team. No hidden fees.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-white' : 'text-blue-200'}`}>
                Monthly
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-900"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-white' : 'text-blue-200'}`}>
                Yearly
              </span>
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Save 20%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-6xl mx-auto px-4 py-16">
          {/* User Count Slider (for calculator) */}
          <div className="max-w-md mx-auto mb-12 bg-white rounded-xl shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              How many team members?
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={userCount}
              onChange={(e) => setUserCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between mt-2">
              <span className="text-sm text-slate-500">1 user</span>
              <span className="text-lg font-bold text-blue-600">{userCount} users</span>
              <span className="text-sm text-slate-500">20 users</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Per User Plan */}
            <div className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${recommendedPlan === 'perUser' ? 'ring-2 ring-blue-500' : ''}`}>
              {recommendedPlan === 'perUser' && (
                <div className="absolute top-0 left-0 right-0 bg-blue-500 text-white text-center text-sm py-1 font-medium">
                  Recommended for {userCount} users
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Per User</h3>
                    <p className="text-sm text-slate-500">Pay per team member</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-slate-900">
                      ${billingCycle === 'yearly' ? perUserPlan.yearlyPrice : perUserPlan.monthlyPrice}
                    </span>
                    <span className="ml-2 text-slate-500">/user/month</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    {userCount} users = <span className="font-semibold">${perUserTotal}/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-emerald-600 mt-1">
                      Save ${(perUserPlan.monthlyPrice - perUserPlan.yearlyPrice) * 12 * userCount}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {perUserPlan.features.slice(0, 6).map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mr-3" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe('perUser')}
                  disabled={isLoading === 'perUser'}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading === 'perUser' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>Get Started <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </button>
              </div>
            </div>

            {/* Unlimited Plan */}
            <div className={`relative bg-white rounded-2xl shadow-lg overflow-hidden ${recommendedPlan === 'unlimited' ? 'ring-2 ring-emerald-500' : ''}`}>
              {recommendedPlan === 'unlimited' && (
                <div className="absolute top-0 left-0 right-0 bg-emerald-500 text-white text-center text-sm py-1 font-medium">
                  Recommended for {userCount} users
                </div>
              )}
              <div className="p-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <Infinity className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Unlimited</h3>
                    <p className="text-sm text-slate-500">Flat rate for whole team</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-slate-900">
                      ${billingCycle === 'yearly' ? unlimitedPlan.yearlyPrice : unlimitedPlan.monthlyPrice}
                    </span>
                    <span className="ml-2 text-slate-500">/month</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Unlimited users = <span className="font-semibold">${unlimitedTotal}/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-emerald-600 mt-1">
                      Save ${(unlimitedPlan.monthlyPrice - unlimitedPlan.yearlyPrice) * 12}/year
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {unlimitedPlan.features.slice(0, 6).map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mr-3" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe('unlimited')}
                  disabled={isLoading === 'unlimited'}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading === 'unlimited' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>Get Started <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Break-even explanation */}
          <div className="max-w-2xl mx-auto mt-12 bg-blue-50 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Which plan should I choose?</h4>
                <p className="text-blue-700 mt-1">
                  If you have <strong>4 or fewer team members</strong>, the Per User plan is more cost-effective 
                  (4 × $50 = $200). With <strong>5 or more users</strong>, the Unlimited plan at $200/month 
                  gives you the best value.
                </p>
              </div>
            </div>
          </div>

          {/* Free Trial CTA */}
          <div className="text-center mt-16">
            <p className="text-slate-600 mb-4">Not sure yet? Try FleetFlow free for 7 days.</p>
            <button
              onClick={handleStartTrial}
              disabled={isLoading === 'trial'}
              className="inline-flex items-center px-6 py-3 border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors disabled:opacity-50"
            >
              {isLoading === 'trial' ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              Start Free Trial
            </button>
            <p className="text-sm text-slate-500 mt-3">No credit card required</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto px-4 py-16 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Can I switch plans later?</h3>
              <p className="text-slate-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What happens if I add more users to the Per User plan?</h3>
              <p className="text-slate-600">You'll be charged prorated for additional users. If you reach 5+ users, consider switching to Unlimited for better value.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Is there a limit on vehicles?</h3>
              <p className="text-slate-600">No, both plans include unlimited vehicles. The only difference is how user seats are priced.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Do you offer refunds?</h3>
              <p className="text-slate-600">Yes, we offer a 30-day money-back guarantee if you're not satisfied with FleetFlow.</p>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
