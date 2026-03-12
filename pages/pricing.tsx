import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { 
  Check, 
  Users,
  Infinity,
  Loader2,
  ArrowRight,
  Sparkles,
  Gift,
  ArrowLeft,
  Home
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { PRICING_PLANS } from '@/config/pricing';
import { useSubscription } from '@/hooks/useSubscription';

const PricingPage: React.FC = () => {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { subscription, isLoading: subLoading } = useSubscription();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleStartFreeBeta = async () => {
    if (sessionStatus !== 'authenticated') {
      router.push('/auth/login?callbackUrl=/pricing');
      return;
    }

    // If user already has subscription, redirect to dashboard
    if (!subLoading && subscription?.hasSubscription) {
      router.push('/dashboard');
      return;
    }

    setIsLoading('beta');
    try {
      const response = await fetch('/api/subscription/trial-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        // If user already has subscription, redirect to dashboard
        if (data.error?.includes('already has a subscription')) {
          router.push('/dashboard');
          return;
        }
        throw new Error(data.error || 'Failed to start beta access');
      }

      toast.success('Welcome to the FleetFlow Beta! 🎉');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  // Authenticated users are already subscribers — send them straight to dashboard
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [sessionStatus, router]);

  const perUserPlan = PRICING_PLANS.perUser;
  const unlimitedPlan = PRICING_PLANS.unlimited;

  return (
    <MarketingLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 py-20 px-4 relative">
          {/* Back to Dashboard button for authenticated users */}
          {sessionStatus === 'authenticated' && (
            <div className="absolute top-4 right-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </button>
            </div>
          )}
          <div className="max-w-4xl mx-auto text-center">
            {/* Beta Badge */}
            <div className="inline-flex items-center space-x-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-medium text-amber-200">Beta Access — Free for Limited Time</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Free During Beta
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Get full access to all FleetFlow features while we're in beta. 
              No credit card required.
            </p>
            
            <button
              onClick={handleStartFreeBeta}
              disabled={isLoading === 'beta'}
              className="inline-flex items-center px-8 py-4 bg-white text-blue-900 font-bold text-lg rounded-xl hover:bg-blue-50 transition-colors shadow-xl disabled:opacity-50"
            >
              {isLoading === 'beta' ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Gift className="h-5 w-5 mr-2" />
              )}
              Start Free Beta Access
            </button>
            <p className="text-sm text-blue-200 mt-3">No credit card required • Full feature access</p>
          </div>
        </div>

        {/* Beta Info Section */}
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mb-12">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-amber-100 rounded-xl flex-shrink-0">
                <Sparkles className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-amber-900 mb-2">What's Included in Beta?</h3>
                <p className="text-amber-800 mb-4">
                  During our beta period, you'll have unlimited access to all features 
                  including those planned for our premium tiers. This helps us gather 
                  feedback and improve the product.
                </p>
                <ul className="space-y-2">
                  {[
                    'Unlimited vehicles and users',
                    'All analytics and reporting features',
                    'API access',
                    'Priority support',
                    'White-label options',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center text-amber-800">
                      <Check className="h-4 w-4 text-amber-600 mr-2" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Future Pricing Preview */}
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Planned Pricing After Beta</h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Per User Plan */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
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
                    <span className="text-4xl font-bold text-slate-900">$50</span>
                    <span className="ml-2 text-slate-500">/user/month</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">or $40/user/month billed yearly</p>
                </div>

                <ul className="space-y-3">
                  {perUserPlan.features.slice(0, 6).map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mr-3" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Unlimited Plan */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
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
                    <span className="text-4xl font-bold text-slate-900">$200</span>
                    <span className="ml-2 text-slate-500">/month</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">or $160/month billed yearly</p>
                </div>

                <ul className="space-y-3">
                  {unlimitedPlan.features.slice(0, 6).map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mr-3" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Beta CTA */}
          <div className="text-center mt-16">
            <p className="text-slate-600 mb-4">Ready to try FleetFlow?</p>
            <button
              onClick={handleStartFreeBeta}
              disabled={isLoading === 'beta'}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading === 'beta' ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-5 w-5 mr-2" />
              )}
              Get Free Beta Access
            </button>
            <p className="text-sm text-slate-500 mt-3">Join hundreds of fleet managers testing FleetFlow</p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto px-4 py-16 border-t border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">How long is the beta free?</h3>
              <p className="text-slate-600">Beta access is free for 1 year from when you sign up. We'll notify you before the beta ends with special pricing for early adopters.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What happens after the beta?</h3>
              <p className="text-slate-600">You'll have the option to continue with one of our paid plans. Beta users will receive a special discount as a thank you for helping us improve.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Can I add my whole team during beta?</h3>
              <p className="text-slate-600">Yes! Add unlimited team members during the beta period at no cost.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Is my data safe?</h3>
              <p className="text-slate-600">Absolutely. We use enterprise-grade security and your data is never shared or sold. You can export your data at any time.</p>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default PricingPage;
