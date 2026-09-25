import { toast } from "react-hot-toast";
import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { CreditCard, Zap, Check, AlertTriangle, Loader2, ReceiptText } from 'lucide-react';
import { confirmAction } from '../../services/notifications';

interface SubscriptionData {
  plan: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface BillingPricing {
  monthly: { amount: number; currency: string }
  yearly: { amount: number; currency: string }
}

const PAID_STATUSES = new Set(['ACTIVE', 'PAST_DUE', 'UNPAID']);

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string; cancelAtPeriodEnd?: boolean }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    TRIAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Trial' },
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: cancelAtPeriodEnd ? 'Cancels at period end' : 'Active' },
    CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Cancelled' },
    PAST_DUE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Past Due' },
    UNPAID: { bg: 'bg-red-100', text: 'text-red-700', label: 'Unpaid' },
  };
  const c = config[status] || config.TRIAL;
  return (
    <span className={`inline-flex items-center gap-1.5 ${c.bg} ${c.text} px-3 py-1 rounded-full text-sm font-medium`}>
      <Zap className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}

export default function BillingPage() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingAvailable, setBillingAvailable] = useState(false);
  const [billingCheckFailed, setBillingCheckFailed] = useState(false);
  const [pricing, setPricing] = useState<BillingPricing | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/subscription/status').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/stripe/availability').then(r => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([status, availability]) => {
        setSub(status.subscription || null)
        setBillingAvailable(Boolean(availability.available))
        setPricing(availability.pricing || null)
      })
      .catch(() => {
        setSub(null)
        setBillingAvailable(false)
        setBillingCheckFailed(true)
        setPricing(null)
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (interval: 'monthly' | 'yearly') => {
    setActionLoading(true);
    try {
      const r = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to create checkout session');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    const ok = await confirmAction(
      'You will retain access until the end of the current billing period.',
      'Cancel subscription'
    );
    if (!ok) return;
    setActionLoading(true);
    try {
      const r = await fetch('/api/subscription/cancel', { method: 'POST' });
      const data = await r.json();
      if (r.ok) {
        setSub(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      } else {
        toast.error(data.error || 'Failed to cancel subscription');
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const trialDaysLeft = sub?.status === 'TRIAL' && sub.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const trialExpired = sub?.status === 'TRIAL' && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();

  const isActive = sub?.status === 'ACTIVE';
  // Workspaces with an existing paid subscription are not on the free beta, so
  // never tell them billing is free when Stripe is temporarily unavailable.
  const hasPaidSubscription = Boolean(sub && PAID_STATUSES.has(sub.status));
  const showPricing = !isActive && billingAvailable;
  const formatPrice = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value / 100)
  const savings = pricing && pricing.monthly.amount > 0
    ? Math.max(0, Math.round((1 - pricing.yearly.amount / (pricing.monthly.amount * 12)) * 100))
    : 0

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Billing' }]}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Billing' }]}>
      <PageHeader title="Billing & Subscription" subtitle="Manage your Fleetvera subscription" />
      <div className="max-w-2xl mx-auto space-y-6">

        {billingCheckFailed && (
          <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Billing status could not be verified</p><p>Please try again later.</p></div>
          </div>
        )}

        {!billingAvailable && !billingCheckFailed && hasPaidSubscription && (
          <div role="status" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div><p className="font-semibold">Online billing is temporarily unavailable</p><p>Your existing subscription is unaffected. Please try again later or contact support@ashbi.ca.</p></div>
          </div>
        )}

        {!billingAvailable && !billingCheckFailed && !hasPaidSubscription && (
          <div role="status" className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <Check className="h-5 w-5 shrink-0 text-blue-700" />
            <div><p className="font-semibold">Fleetvera is free during the beta</p><p>No payment details are needed. We will give beta workspaces advance notice before paid plans start.</p></div>
          </div>
        )}

        {/* Current subscription info */}
        {sub && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Current Plan</h2>
              <StatusBadge status={sub.status} cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p><span className="font-medium text-slate-800">Plan:</span> Fleetvera Pro</p>
              {sub.status === 'TRIAL' && (
                <p>
                  <span className="font-medium text-slate-800">Trial:</span>{' '}
                  {trialExpired
                    ? <span className="text-red-600 font-medium">Expired</span>
                    : <span>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining</span>
                  }
                </p>
              )}
              {sub.currentPeriodEnd && (
                <p><span className="font-medium text-slate-800">{sub.cancelAtPeriodEnd ? 'Access through:' : 'Renews:'}</span> {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>
              )}
              {sub.cancelAtPeriodEnd && (
                <p className="text-amber-600">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Your subscription is scheduled to cancel{sub.currentPeriodEnd ? ` on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}` : ''}.
                </p>
              )}
            </div>
            {isActive && !sub.cancelAtPeriodEnd && (
              <button
                onClick={handleCancel}
                disabled={actionLoading || !billingAvailable}
                className="mt-4 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
            <a href="/billing/invoices" className="mt-4 ml-3 inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-800 hover:underline">
              <ReceiptText className="h-4 w-4" /> View invoices
            </a>
          </div>
        )}

        {/* Pricing cards */}
        {showPricing && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-5">
              <CreditCard className="h-8 w-8 text-blue-900" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Fleetvera Pro</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-left mb-8">
              {[
                'Unlimited vehicles', 'Unlimited deliveries',
                'Real-time analytics', 'Team collaboration',
                'Maintenance scheduling', 'Client management',
                'CSV exports', 'API access',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 rounded-xl p-5">
                <p className="text-2xl font-bold text-slate-900">{pricing ? formatPrice(pricing.monthly.amount, pricing.monthly.currency) : 'Unavailable'}<span className="text-base text-slate-500 font-normal">/mo</span></p>
                <p className="text-slate-500 text-xs mb-3">Billed monthly</p>
                <button
                  onClick={() => handleSubscribe('monthly')}
                  disabled={actionLoading || !billingAvailable}
                  className="w-full px-4 py-2.5 bg-blue-900 text-white rounded-xl font-medium hover:bg-blue-800 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Loading...' : 'Subscribe Monthly'}
                </button>
              </div>
              <div className="bg-blue-50 rounded-xl p-5 ring-2 ring-blue-200">
                <p className="text-2xl font-bold text-slate-900">{pricing ? formatPrice(pricing.yearly.amount, pricing.yearly.currency) : 'Unavailable'}<span className="text-base text-slate-500 font-normal">/yr</span></p>
                <p className="text-blue-600 text-xs font-medium mb-3">{savings > 0 ? `Save ${savings}%` : 'Billed yearly'}</p>
                <button
                  onClick={() => handleSubscribe('yearly')}
                  disabled={actionLoading || !billingAvailable}
                  className="w-full px-4 py-2.5 bg-blue-900 text-white rounded-xl font-medium hover:bg-blue-800 transition disabled:opacity-50"
                >
                  {actionLoading ? 'Loading...' : 'Subscribe Yearly'}
                </button>
              </div>
            </div>
            <a href="mailto:support@ashbi.ca" className="text-sm text-slate-500 hover:text-slate-700 transition">
              Questions? Contact Sales
            </a>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
