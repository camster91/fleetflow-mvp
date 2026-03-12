import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { StatCard } from '../../components/analytics/StatCard';
import { ChartCard } from '../../components/analytics/ChartCard';
import { DateRangePicker } from '../../components/ui/DateRangePicker';
import { Button } from '../../components/ui/Button';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import {
  Truck,
  Fuel,
  Wrench,
  Users,
  TrendingUp,
  Download,
  Calendar,
} from 'lucide-react';
import { notify } from '../../services/notifications';

interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
    label: 'Last 30 days',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const response = await fetch(`/api/analytics/dashboard?days=${days}`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      notify.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data for demonstration
  const mockStats = {
    fleetUtilization: { current: 78, change: 5.2 },
    fuelCosts: { current: 12450, change: -3.5 },
    maintenanceCosts: { current: 8900, change: 12.3 },
    driverScore: { current: 8.7, change: 0.3 },
  };

  const fuelCostData = [
    { name: 'Mon', fuel: 420, maintenance: 240 },
    { name: 'Tue', fuel: 380, maintenance: 180 },
    { name: 'Wed', fuel: 450, maintenance: 320 },
    { name: 'Thu', fuel: 410, maintenance: 200 },
    { name: 'Fri', fuel: 480, maintenance: 280 },
    { name: 'Sat', fuel: 320, maintenance: 150 },
    { name: 'Sun', fuel: 290, maintenance: 120 },
  ];

  const maintenanceCategoryData = [
    { name: 'Preventive', value: 4500 },
    { name: 'Repairs', value: 2800 },
    { name: 'Tires', value: 1200 },
    { name: 'Other', value: 400 },
  ];

  const utilizationHeatmapData = [
    { name: 'Truck 101', value: 85 },
    { name: 'Truck 102', value: 72 },
    { name: 'Van 201', value: 91 },
    { name: 'Van 202', value: 68 },
    { name: 'Truck 103', value: 78 },
  ];

  const driverScoreData = [
    { name: '0-4', value: 2 },
    { name: '4-6', value: 8 },
    { name: '6-8', value: 24 },
    { name: '8-9', value: 18 },
    { name: '9-10', value: 6 },
  ];

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Analytics' },
      ]}
    >
      <PageHeader
        title="Analytics & Insights"
        subtitle="Deep dive into your fleet performance metrics"
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
            />
            <Button
              variant="outline"
              iconLeft={<Download className="h-4 w-4" />}
            >
              Export Report
            </Button>
          </div>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Fleet Utilization"
          value={`${mockStats.fleetUtilization.current}%`}
          change={mockStats.fleetUtilization.change}
          icon={<Truck className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          loading={isLoading}
        />
        <StatCard
          title="Fuel Costs"
          value={`$${mockStats.fuelCosts.current.toLocaleString()}`}
          change={mockStats.fuelCosts.change}
          prefix="$"
          icon={<Fuel className="h-6 w-6" />}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          loading={isLoading}
        />
        <StatCard
          title="Maintenance Costs"
          value={`$${mockStats.maintenanceCosts.current.toLocaleString()}`}
          change={mockStats.maintenanceCosts.change}
          prefix="$"
          icon={<Wrench className="h-6 w-6" />}
          iconBgColor="bg-red-50"
          iconColor="text-red-600"
          loading={isLoading}
        />
        <StatCard
          title="Driver Score"
          value={mockStats.driverScore.current}
          change={mockStats.driverScore.change}
          icon={<Users className="h-6 w-6" />}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={isLoading}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Fuel & Maintenance Costs"
          subtitle="Daily spending breakdown"
          type="area"
          data={fuelCostData}
          dataKey="fuel"
          series={[
            { key: 'fuel', name: 'Fuel', color: '#f59e0b' },
            { key: 'maintenance', name: 'Maintenance', color: '#ef4444' },
          ]}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          loading={isLoading}
        />
        <ChartCard
          title="Maintenance by Category"
          subtitle="Cost distribution across categories"
          type="pie"
          data={maintenanceCategoryData}
          dataKey="value"
          xAxisKey="name"
          colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
          loading={isLoading}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Vehicle Utilization"
          subtitle="Utilization rate by vehicle"
          type="bar"
          data={utilizationHeatmapData}
          dataKey="value"
          xAxisKey="name"
          colors={['#3b82f6']}
          loading={isLoading}
        />
        <ChartCard
          title="Driver Score Distribution"
          subtitle="Performance ratings across your team"
          type="bar"
          data={driverScoreData}
          dataKey="value"
          xAxisKey="name"
          colors={['#10b981']}
          loading={isLoading}
        />
      </div>

      {/* Cost Per Mile Trend */}
      <ChartCard
        title="Cost Per Mile Trend"
        subtitle="Track efficiency over time"
        type="line"
        data={Array.from({ length: 30 }, (_, i) => ({
          date: `Day ${i + 1}`,
          cost: 2.2 + Math.random() * 0.4,
        }))}
        dataKey="cost"
        xAxisKey="date"
        loading={isLoading}
      />
    </DashboardLayout>
  );
}
