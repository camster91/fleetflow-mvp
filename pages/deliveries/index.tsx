import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  MapPin,
  Truck,
  Clock,
  CheckCircle,
  Filter,
  Download,
  Navigation,
  MoreHorizontal,
  Calendar,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import * as dataService from '../../services/dataServiceWithSync';
import { notify } from '../../services/notifications';
import DeliveryFormModal from '../../components/DeliveryFormModal';

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<dataService.Delivery[]>([]);
  const [vehicles, setVehicles] = useState<dataService.Vehicle[]>([]);
  const [clients, setClients] = useState<dataService.Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setDeliveries(dataService.getDeliveries());
    setVehicles(dataService.getVehicles());
    setClients(dataService.getClients());
    setIsLoading(false);
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = 
      delivery.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.driver.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = [
    {
      title: 'Total Deliveries',
      value: deliveries.length,
      icon: <Package className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'In Transit',
      value: deliveries.filter(d => d.status === 'in-transit').length,
      icon: <Truck className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'Pending',
      value: deliveries.filter(d => d.status === 'pending').length,
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      iconBgColor: 'bg-amber-50',
    },
    {
      title: 'Delivered Today',
      value: deliveries.filter(d => d.status === 'delivered').length,
      icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
      iconBgColor: 'bg-emerald-50',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="success">Delivered</Badge>;
      case 'in-transit':
        return <Badge variant="primary">In Transit</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-500';
      case 'in-transit':
        return 'bg-blue-500';
      case 'pending':
        return 'bg-amber-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Deliveries' },
      ]}
    >
      <PageHeader
        title="Delivery Management"
        subtitle="Track and manage all your deliveries in real-time"
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-4 w-4" />}
              onClick={() => setIsFormOpen(true)}
            >
              New Delivery
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* View Toggle & Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === 'map' 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Map View
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search deliveries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {['all', 'pending', 'in-transit', 'delivered'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`
                px-4 py-1.5 rounded-full text-sm font-medium transition-all
                ${statusFilter === status
                  ? 'bg-blue-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }
              `}
            >
              {status === 'all' ? 'All Deliveries' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
              {status !== 'all' && (
                <span className="ml-2 text-xs">
                  ({deliveries.filter(d => d.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : filteredDeliveries.length === 0 ? (
        <Card>
          <EmptyState
            type={searchQuery ? 'search' : 'data'}
            title={searchQuery ? 'No results found' : 'No deliveries yet'}
            description={searchQuery 
              ? 'Try adjusting your search or filters'
              : 'Create your first delivery to start tracking'
            }
            actionLabel={!searchQuery ? 'Create Delivery' : undefined}
            onAction={!searchQuery ? () => setIsFormOpen(true) : undefined}
          />
        </Card>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {filteredDeliveries.map((delivery) => (
            <Card key={delivery.id} hover className="transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Delivery Info */}
                <div className="flex items-start space-x-4">
                  <div className={`
                    p-3 rounded-xl
                    ${delivery.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                      delivery.status === 'in-transit' ? 'bg-blue-50 text-blue-600' :
                      'bg-amber-50 text-amber-600'}
                  `}>
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-slate-900">{delivery.customer}</h3>
                      {getStatusBadge(delivery.status)}
                    </div>
                    <div className="flex items-center text-sm text-slate-500 mt-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      {delivery.address}
                    </div>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                      <span className="flex items-center">
                        <Truck className="h-4 w-4 mr-1" />
                        {delivery.driver}
                      </span>
                      <span className="flex items-center">
                        <Package className="h-4 w-4 mr-1" />
                        {delivery.items} items
                      </span>
                      {delivery.estimatedArrival && (
                        <span className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          ETA: {delivery.estimatedArrival}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Progress */}
                <div className="flex-1 max-w-md">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-medium text-slate-900">{delivery.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(delivery.status)}`}
                      style={{ width: `${delivery.progress}%` }}
                    />
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<Navigation className="h-4 w-4" />}
                    onClick={() => {
                      const encodedAddress = encodeURIComponent(delivery.address);
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
                    }}
                  >
                    Navigate
                  </Button>
                  {delivery.status !== 'delivered' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        dataService.updateDelivery(delivery.id, { 
                          status: 'delivered', 
                          progress: 100,
                          completedTime: new Date().toISOString()
                        });
                        loadData();
                        notify.success(`Delivery for ${delivery.customer} marked as delivered`);
                      }}
                    >
                      Mark Delivered
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="h-96 flex items-center justify-center">
          <EmptyState
            type="default"
            title="Map View Coming Soon"
            description="Interactive map view with real-time tracking will be available in the next update."
            icon={<Navigation className="h-12 w-12" />}
          />
        </Card>
      )}

      {/* Delivery Form Modal */}
      <DeliveryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(delivery) => {
          dataService.addDelivery(delivery);
          loadData();
          notify.success(`Delivery for "${delivery.customer}" created successfully`);
        }}
        clients={clients}
        vehicles={vehicles}
      />
    </DashboardLayout>
  );
}
