import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { CreditCard, Zap, Star, Check } from 'lucide-react';

export default function BillingPage() {
  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Billing' }]}>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your FleetFlow subscription"
      />
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-50 mb-5">
            <CreditCard className="h-8 w-8 text-blue-900" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">FleetFlow Pro</h2>
          <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
            <Zap className="h-3.5 w-3.5" />
            Currently on trial
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-left mb-8">
            {[
              'Unlimited vehicles', 'Unlimited deliveries',
              'Real-time analytics', 'Team collaboration',
              'Maintenance scheduling', 'Client management',
              'CSV exports', 'Priority support',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <div className="bg-slate-50 rounded-xl p-6 mb-6">
            <p className="text-3xl font-bold text-slate-900 mb-1">$49<span className="text-lg text-slate-500 font-normal">/month</span></p>
            <p className="text-slate-500 text-sm">or $490/year (save 17%)</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button disabled className="px-6 py-3 bg-blue-900 text-white rounded-xl font-medium opacity-60 cursor-not-allowed">
              Subscribe — Coming Soon
            </button>
            <a href="mailto:support@ashbi.ca" className="px-6 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition">
              Contact Sales
            </a>
          </div>
          <p className="text-xs text-slate-400 mt-4">Payments will be enabled in a future update. Your account remains active during the trial.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
