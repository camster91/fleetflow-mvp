import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Check, 
  X, 
  Zap,
  Building2,
  Rocket,
  Crown,
  Loader2,
  ArrowRight,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { PRICING_PLANS, calculateYearlySavings, TRIAL_DAYS } from '@/config/pricing';
import { PlanType } from '../types';
import { useSubscription } from '@/hooks/useSubscription';

const PricingPage: React.FC = () => {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { subscription, isLoading: subLoading } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string, planName: string) => {
    if (sessionStatus !== 'authenticated') {
      router.push('/auth/login?callbackUrl=/pricing');
      return;
    }

    setIsLoading(planName);
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

      // Redirect to Stripe Checkout
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

      toast.success(`Your ${TRIAL_DAYS}-day trial has started!`);
      router.push('/');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const isCurrentPlan = (planType: PlanType) => {
    return subscription?.plan?.type === planType;
  };

  const plans = [
    { ...PRICING_PLANS.starter, icon: Rocket, popular: false },
    { ...PRICING_PLANS.professional, icon: Zap, popular: true },
    { ...PRICING_PLANS.enterprise, icon: Building2, popular: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="p-2 bg-blue-900 rounded-lg">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">FleetFlow</span>
            </Link>
            <div className="flex items-center space-x-4">
              {session ? (
                <Link
                  href="/"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-slate-600">
            Start with a {TRIAL_DAYS}-day free trial. No credit card required.
          </p>
        </div>

        {/* Trial Banner for New Users */}
        {session && !subLoading && !subscription?.hasSubscription && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                <Rocket className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold">Start Your {TRIAL_DAYS}-Day Free Trial</h2>
              <p className="mt-2 text-blue-100">
                Get full access to all Starter features. No credit card required.
              </p>
              <button
                onClick={handleStartTrial}
                disabled={isLoading === 'trial'}
                className="mt-6 px-8 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading === 'trial' ? (
                  <span className="flex items-center">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Starting...
                  </span>
                ) : (
                  'Start Free Trial'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-12">
          <div className="bg-white p-1 rounded-lg border border-slate-200 inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
              <span className="ml-1.5 text-xs text-green-600">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const priceId = billingCycle === 'monthly' ? plan.stripeMonthlyPriceId : plan.stripeYearlyPriceId;
            const current = isCurrentPlan(plan.planType);

            return (
              <div
                key={plan.id}
                className={`
                  relative rounded-2xl border bg-white p-8
                  ${plan.popular 
                    ? 'border-blue-200 shadow-xl shadow-blue-900/5 ring-1 ring-blue-500' 
                    : 'border-slate-200 shadow-sm'
                  }
                  ${current ? 'ring-2 ring-green-500' : ''}
                `}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                      Most Popular
                    </span>
                  </div>
                )}
                {current && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-2 rounded-lg ${plan.popular ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <Icon className={`h-6 w-6 ${plan.popular ? 'text-blue-600' : 'text-slate-600'}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                </div>

                <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-slate-900">${price}</span>
                    <span className="text-slate-500 ml-2">/month</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <p className="text-sm text-green-600 mt-1">
                      Save ${calculateYearlySavings(plan.monthlyPrice, plan.yearlyPrice)}/year
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleSubscribe(priceId, plan.name)}
                  disabled={isLoading !== null || current}
                  className={`
                    w-full py-3 px-4 rounded-xl font-medium transition-colors
                    ${current
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50'
                    }
                  `}
                >
                  {isLoading === plan.name ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Loading...
                    </span>
                  ) : current ? (
                    'Current Plan'
                  ) : (
                    `Choose ${plan.name}`
                  )}
                </button>

                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium text-slate-900">Features included:</p>
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 flex-shrink-0 mr-3" />
                      <span className="text-sm text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-slate-900">{plan.limits.vehicles === -1 ? 'Unlimited' : plan.limits.vehicles} vehicles</span>
                    {' • '}
                    <span className="font-medium text-slate-900">{plan.limits.users === -1 ? 'Unlimited' : plan.limits.users} users</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 bg-slate-900 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-2xl font-bold">Need a custom solution?</h2>
          <p className="mt-2 text-slate-400">
            Contact us for enterprise pricing and custom integrations
          </p>
          <a
            href="mailto:sales@fleetflow.app"
            className="mt-6 inline-flex items-center px-6 py-3 bg-white text-slate-900 rounded-xl font-medium hover:bg-slate-100 transition-colors"
          >
            Contact Sales
            <ArrowRight className="h-5 w-5 ml-2" />
          </a>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Can I change my plan later?</h3>
              <p className="mt-2 text-slate-600">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">What happens after my trial ends?</h3>
              <p className="mt-2 text-slate-600">
                After your {TRIAL_DAYS}-day trial, you&apos;ll need to choose a plan to continue using FleetFlow. 
                We&apos;ll remind you before the trial ends.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Is there a refund policy?</h3>
              <p className="mt-2 text-slate-600">
                We offer a 30-day money-back guarantee. If you&apos;re not satisfied, contact us for a full refund.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} FleetFlow. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900">Privacy</a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900">Terms</a>
              <div className="flex items-center text-sm text-slate-500">
                <Shield className="h-4 w-4 mr-1.5" />
                PCI Compliant
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
