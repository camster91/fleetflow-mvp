import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/analytics/StatCard';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Button } from '../../components/ui/Button';
import { subDays } from 'date-fns';
import { Truck, Wrench, Package, Users, Download } from 'lucide-react';
import { notify } from '../../services/notifications';

interface DateRange { from: Date; to: Date; label: string; }
interface AnalyticsData {
  stats: {
    fleetUtilization: { current: number; total: number; active: number };
    deliveries: { total: number; delivered: number; inTransit: number; pending: number; delayed: number };
    maintenance: {
      total: number; overdue: number; dueSoon: number; completed: number; totalCost: number;
      upcoming: Array<{ vehicle: string; task: string; dueIn: number }>;
    };
    clients: { total: number };
  };
  charts: {
    activityOverTime: Array<{ name: string; deliveries: number; maintenance: number }>;
    maintenanceByCategory: Array<{ name: string; value: number; cost: number }>;
    vehicleUtilization: Array<{ name: string; deliveries: number }>;
  };
}

// ChartCard pulls in recharts; loading it via next/dynamic keeps recharts
// out of the shared vendors chunk — it downloads only on this page.
const ChartCard = dynamic(() => import('../../components/analytics/ChartCard'), {
  ssr: false,
  loading: () => <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />,
});

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30), to: new Date(), label: 'Last 30 days',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000);
      const r = await fetch(`/api/analytics/dashboard?days=${days}`);
      if (r.ok) setData(await r.json());
      else notify.error('Failed to load analytics');
    } catch { notify.error('Failed to load analytics'); }
    finally { setIsLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const s = data?.stats;
  const charts = data?.charts;

  const fleetUtil = s?.fleetUtilization?.current ?? 0;
  const totalVehicles = s?.fleetUtilization?.total ?? 0;
  const maintCost = s?.maintenance?.totalCost ?? 0;
  const deliveryTotal = s?.deliveries?.total ?? 0;
  const deliveryDone = s?.deliveries?.delivered ?? 0;
  const maintOverdue = s?.maintenance?.overdue ?? 0;
  const maintDueSoon = s?.maintenance?.dueSoon ?? 0;

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analytics' }]}>
      <PageHeader
        title="Analytics & Insights"
        subtitle="Real-time fleet performance metrics"
        actions={
          <div className="flex gap-2 items-center">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button variant="outline" size="sm" iconLeft={<Download className="h-4 w-4" />}
              onClick={() => {
                if (!data) return;
                const csv = [
                  'Metric,Value',
                  `Fleet Utilization,${fleetUtil}%`,
                  `Total Vehicles,${totalVehicles}`,
                  `Total Deliveries,${deliveryTotal}`,
                  `Completed Deliveries,${deliveryDone}`,
                  `Maintenance Cost,$${maintCost}`,
                  `Overdue Maintenance,${maintOverdue}`,
                ].join('\n');
                const a = document.createElement('a');
                a.href = 'data:text/csv,' + encodeURIComponent(csv);
                a.download = 'fleet-analytics.csv';
                a.click();
              }}
            >Export</Button>
          </div>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Fleet Utilization"
          value={`${fleetUtil}%`}
          changeLabel={`${s?.fleetUtilization?.active ?? 0} of ${totalVehicles} active`}
          icon={<Truck className="h-6 w-6" />}
          iconBgColor="bg-blue-50" iconColor="text-blue-600"
          loading={isLoading}
        />
        <StatCard
          title="Total Deliveries"
          value={deliveryTotal}
          changeLabel={`${deliveryDone} completed`}
          icon={<Package className="h-6 w-6" />}
          iconBgColor="bg-emerald-50" iconColor="text-emerald-600"
          loading={isLoading}
        />
        <StatCard
          title="Maintenance Cost"
          value={`$${maintCost.toLocaleString()}`}
          changeLabel={`${s?.maintenance?.total ?? 0} tasks total`}
          icon={<Wrench className="h-6 w-6" />}
          iconBgColor="bg-red-50" iconColor="text-red-600"
          loading={isLoading}
        />
        <StatCard
          title="Maintenance Alerts"
          value={maintOverdue + maintDueSoon}
          changeLabel={`${maintOverdue} overdue, ${maintDueSoon} due soon`}
          icon={<Users className="h-6 w-6" />}
          iconBgColor="bg-amber-50" iconColor="text-amber-600"
          loading={isLoading}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Fleet Activity"
          subtitle="Deliveries and maintenance logged per day"
          type="area"
          data={charts?.activityOverTime ?? []}
          dataKey="deliveries"
          series={[
            { key: 'deliveries', name: 'Deliveries', color: '#3b82f6' },
            { key: 'maintenance', name: 'Maintenance', color: '#f59e0b' },
          ]}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          loading={isLoading}
        />
        <ChartCard
          title="Maintenance by Type"
          subtitle="Task count across categories"
          type="pie"
          data={charts?.maintenanceByCategory ?? []}
          dataKey="value"
          xAxisKey="name"
          colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']}
          loading={isLoading}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Vehicle Delivery Load"
          subtitle="Deliveries assigned per vehicle"
          type="bar"
          data={charts?.vehicleUtilization ?? []}
          dataKey="deliveries"
          xAxisKey="name"
          colors={['#3b82f6']}
          loading={isLoading}
        />
        {/* Delivery status breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Delivery Status Breakdown</h3>
          <p className="text-sm text-slate-500 mb-4">Current pipeline overview</p>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Delivered', count: s?.deliveries?.delivered ?? 0, color: 'bg-emerald-500', pct: deliveryTotal ? Math.round(((s?.deliveries?.delivered ?? 0) / deliveryTotal) * 100) : 0 },
                { label: 'In Transit', count: s?.deliveries?.inTransit ?? 0, color: 'bg-blue-500', pct: deliveryTotal ? Math.round(((s?.deliveries?.inTransit ?? 0) / deliveryTotal) * 100) : 0 },
                { label: 'Pending', count: s?.deliveries?.pending ?? 0, color: 'bg-amber-400', pct: deliveryTotal ? Math.round(((s?.deliveries?.pending ?? 0) / deliveryTotal) * 100) : 0 },
                { label: 'Delayed', count: s?.deliveries?.delayed ?? 0, color: 'bg-red-500', pct: deliveryTotal ? Math.round(((s?.deliveries?.delayed ?? 0) / deliveryTotal) * 100) : 0 },
              ].map(({ label, count, color, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{label}</span>
                    <span className="text-slate-500">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming maintenance */}
      {(s?.maintenance?.upcoming?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Upcoming Maintenance</h3>
          <div className="divide-y divide-slate-50">
            {s?.maintenance.upcoming.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.vehicle}</p>
                  <p className="text-xs text-slate-500">{item.task}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  item.dueIn <= 2 ? 'bg-red-100 text-red-700'
                  : item.dueIn <= 7 ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.dueIn === 0 ? 'Today' : item.dueIn === 1 ? 'Tomorrow' : `In ${item.dueIn}d`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
