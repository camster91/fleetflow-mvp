import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { useSession } from '../lib/session';
import { downloadCSV } from '../lib/csvExport';
import { subDays, format } from 'date-fns';
import { Download, Wrench, Package, Truck } from 'lucide-react';
import { notify } from '../services/notifications';

interface DateRange { from: Date; to: Date; label: string; }

type Tab = 'maintenance' | 'deliveries' | 'fleet';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Chart panels live in components/reports/ReportPanels and are loaded
// client-side only via next/dynamic, so recharts stays out of the shared
// vendors chunk and downloads only when a report is actually viewed.
const PanelSkeleton = () => <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />;

const MaintenanceReport = dynamic(
  () => import('../components/reports/ReportPanels').then((m) => m.MaintenanceReport),
  { ssr: false, loading: PanelSkeleton }
);
const DeliveriesReport = dynamic(
  () => import('../components/reports/ReportPanels').then((m) => m.DeliveriesReport),
  { ssr: false, loading: PanelSkeleton }
);
const FleetReport = dynamic(
  () => import('../components/reports/ReportPanels').then((m) => m.FleetReport),
  { ssr: false, loading: PanelSkeleton }
);

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('maintenance');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30), to: new Date(), label: 'Last 30 days',
  });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
      const r = await fetch(`/api/reports/${activeTab}?${params}`);
      if (r.ok) {
        setData(await r.json());
      } else {
        notify.error('Failed to load report data');
        setData(null);
      }
    } catch {
      notify.error('Failed to load report data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportCSV = async () => {
    const params = new URLSearchParams({
      type: activeTab,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    });
    try {
      const r = await fetch(`/api/reports/export?${params}`);
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}-report-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify.success('CSV exported successfully');
    } catch {
      notify.error('Failed to export CSV');
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'maintenance', label: 'Maintenance', icon: Wrench },
    { key: 'deliveries', label: 'Deliveries', icon: Package },
    { key: 'fleet', label: 'Fleet Utilization', icon: Truck },
  ];

  if (status === 'loading') {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}>
      <PageHeader
        title="Reports"
        subtitle="Analyze fleet performance, maintenance costs, and delivery metrics"
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <Button
              variant="outline"
              iconLeft={<Download className="h-4 w-4" />}
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
          <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : data ? (
        <>
          {activeTab === 'maintenance' && <MaintenanceReport data={data} />}
          {activeTab === 'deliveries' && <DeliveriesReport data={data} />}
          {activeTab === 'fleet' && <FleetReport data={data} />}
        </>
      ) : (
        <Card className="p-12 text-center">
          <p className="text-slate-500">No data available for the selected period.</p>
        </Card>
      )}
    </DashboardLayout>
  );
}
