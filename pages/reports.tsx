import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { StatCard } from '../components/analytics/StatCard';
import { useSession } from '../lib/session';
import { downloadCSV } from '../lib/csvExport';
import { subDays, format } from 'date-fns';
import { Download, Wrench, Package, Truck, AlertTriangle, Clock, DollarSign, Users, TrendingUp } from 'lucide-react';
import { notify } from '../services/notifications';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface DateRange { from: Date; to: Date; label: string; }

type Tab = 'maintenance' | 'deliveries' | 'fleet';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

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

function MaintenanceReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Maintenance Cost" value={`$${data.totalCost.toLocaleString()}`} icon={DollarSign} />
        <StatCard title="Total Tasks" value={data.totalTasks} icon={Wrench} />
        <StatCard title="Upcoming Tasks (30d)" value={data.upcomingTasks.length} icon={Clock} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Cost by Vehicle</h3>
          {data.costByVehicle.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.costByVehicle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="vehicle" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']} />
                <Bar dataKey="cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Cost Over Time</h3>
          {data.costOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.costOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']} />
                <Line type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>

      {/* Upcoming Tasks Table */}
      {data.upcomingTasks.length > 0 && (
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Upcoming Maintenance Tasks</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Task</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Vehicle</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Due Date</th>
                  <th className="text-left py-2 px-3 font-medium text-slate-600">Priority</th>
                  <th className="text-right py-2 px-3 font-medium text-slate-600">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingTasks.map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 text-slate-900">{t.title}</td>
                    <td className="py-2 px-3 text-slate-600">{t.vehicleName}</td>
                    <td className="py-2 px-3 text-slate-600 capitalize">{t.type}</td>
                    <td className="py-2 px-3 text-slate-600">{format(new Date(t.dueDate), 'MMM d, yyyy')}</td>
                    <td className="py-2 px-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="py-2 px-3 text-right text-slate-900">
                      {t.costEstimate != null ? `$${t.costEstimate.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function DeliveriesReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Deliveries" value={data.totalDeliveries} icon={Package} />
        <StatCard title="On-Time Rate" value={`${data.onTimeRate}%`} icon={TrendingUp} />
        <StatCard title="Avg. Delivery Time" value={`${data.avgDeliveryTime}h`} icon={Clock} />
        <StatCard title="Active Drivers" value={data.topDrivers.length} icon={Users} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Delivery Status Breakdown</h3>
          {data.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ status, count }: any) => `${status} (${count})`}
                >
                  {data.statusBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Top Drivers by Deliveries</h3>
          {data.topDrivers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topDrivers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="driver" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip />
                <Bar dataKey="deliveries" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>
    </div>
  );
}

function FleetReport({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Vehicles" value={data.totalVehicles} icon={Truck} />
        <StatCard title="Needing Maintenance" value={data.vehiclesNeedingMaintenance.length} icon={AlertTriangle} />
        <StatCard
          title="Fleet Health"
          value={`${data.totalVehicles > 0 ? Math.round(((data.totalVehicles - data.vehiclesNeedingMaintenance.length) / data.totalVehicles) * 100) : 0}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Vehicle Status Breakdown</h3>
          {data.statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ status, count }: any) => `${status} (${count})`}
                >
                  {data.statusBreakdown.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>

        {/* Maintenance needed list */}
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Vehicles Needing Maintenance</h3>
          {data.vehiclesNeedingMaintenance.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {data.vehiclesNeedingMaintenance.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{v.name}</p>
                    <p className="text-sm text-slate-500">
                      {v.vehicleType || 'Vehicle'} {v.mileage != null ? `- ${v.mileage.toLocaleString()} mi` : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    {v.driver && <p>{v.driver}</p>}
                    {v.lastService && <p>Last: {format(new Date(v.lastService), 'MMM d, yyyy')}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400">
              All vehicles are in good condition
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority}
    </span>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
      No data available
    </div>
  );
}
