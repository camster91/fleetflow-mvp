import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import {
  Truck,
  Package,
  AlertTriangle,
  FileVideo,
  Plus,
  ChevronRight,
  Calendar,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card, StatCard } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import * as dataService from '../services/dataServiceWithSync';
import { notify } from '../services/notifications';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import { SetupChecklist } from '../components/onboarding/SetupChecklist';
import { isOnboardingComplete } from '../lib/onboarding';

// Import modals
import AnnouncementModal from '../components/AnnouncementModal';
import VehicleDetailModal from '../components/VehicleDetailModal';
import VehicleFormModal from '../components/VehicleFormModal';
import DeliveryFormModal from '../components/DeliveryFormModal';
import MaintenanceTaskFormModal from '../components/MaintenanceTaskFormModal';
import ClientFormModal from '../components/ClientFormModal';
import ConfirmModal from '../components/ConfirmModal';
import ActivityFeed from '../components/ActivityFeed';
import QuickActions from '../components/QuickActions';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const user = session?.user;
  const authLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [vehicles, setVehicles] = useState<dataService.Vehicle[]>([]);
  const [deliveries, setDeliveries] = useState<dataService.Delivery[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<dataService.MaintenanceTask[]>([]);
  const [sopCategories, setSopCategories] = useState<dataService.SOPCategory[]>([]);
  const [clients, setClients] = useState<dataService.Client[]>([]);

  // Modal states
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isVehicleDetailOpen, setIsVehicleDetailOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<dataService.Vehicle | null>(null);
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<dataService.Vehicle | null>(null);
  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = useState(false);
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as const,
  });

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChecklist, setShowChecklist] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // Check onboarding status
  useEffect(() => {
    const checkOnboarding = () => {
      const completed = isOnboardingComplete();
      setIsNewUser(!completed);
      setShowOnboarding(!completed);
      setShowChecklist(!completed);
    };
    checkOnboarding();
  }, []);

  // Load data
  useEffect(() => {
    const loadData = () => {
      try {
        setVehicles(dataService.getVehicles());
        setDeliveries(dataService.getDeliveries());
        setMaintenanceTasks(dataService.getMaintenanceTasks());
        setSopCategories(dataService.getSOPCategories());
        setClients(dataService.getClients());
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        notify.error('Failed to load data. Please refresh the page.');
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const stats = [
    {
      title: 'Total Vehicles',
      value: vehicles.length,
      change: '+0',
      changeType: 'neutral' as const,
      icon: <Truck className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Active Deliveries',
      value: deliveries.filter(d => d.status === 'in-transit').length,
      change: '+0',
      changeType: 'positive' as const,
      icon: <Package className="h-6 w-6 text-emerald-600" />,
      iconBgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Maintenance Due',
      value: maintenanceTasks.filter(t => !t.completed && new Date(t.dueDate) <= new Date()).length,
      change: '+0',
      changeType: 'warning' as const,
      icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      iconBgColor: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      title: 'Pending SOPs',
      value: sopCategories.reduce((sum, cat) => sum + cat.count, 0),
      change: '+0',
      changeType: 'neutral' as const,
      icon: <FileVideo className="h-6 w-6 text-purple-600" />,
      iconBgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  // Handlers
  const refreshData = () => {
    setVehicles(dataService.getVehicles());
    setDeliveries(dataService.getDeliveries());
    setMaintenanceTasks(dataService.getMaintenanceTasks());
    setSopCategories(dataService.getSOPCategories());
    setClients(dataService.getClients());
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setIsVehicleFormOpen(true);
  };

  const handleEditVehicle = (vehicle: dataService.Vehicle) => {
    setEditingVehicle(vehicle);
    setIsVehicleFormOpen(true);
  };

  const handleDeleteVehicle = (vehicle: dataService.Vehicle) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Vehicle',
      message: `Are you sure you want to delete "${vehicle.name}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        dataService.deleteVehicle(vehicle.id);
        refreshData();
        notify.success(`Vehicle "${vehicle.name}" deleted successfully`);
      },
    });
  };

  const handleViewVehicle = (vehicle: dataService.Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsVehicleDetailOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} hasHeader={false} lines={2} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <SkeletonCard hasHeader lines={4} />
              <SkeletonCard hasHeader lines={3} />
            </div>
            <div className="space-y-6">
              <SkeletonCard hasHeader lines={3} />
              <SkeletonCard hasHeader lines={2} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Welcome back, ${user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'}!`}
      subtitle="Here's what's happening with your fleet today."
      actions={
        <Button
          variant="primary"
          iconLeft={<Plus className="h-4 w-4" />}
          onClick={handleAddVehicle}
        >
          Add Vehicle
        </Button>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={stat.title} className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Status Card */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Vehicle Status</h3>
                <p className="text-sm text-slate-500 mt-1">Monitor your fleet in real-time</p>
              </div>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>

            {vehicles.length === 0 ? (
              <EmptyState
                type="data"
                title="No vehicles yet"
                description="Add your first vehicle to start tracking your fleet."
                actionLabel="Add Vehicle"
                onAction={handleAddVehicle}
              />
            ) : (
              <div className="space-y-3">
                {vehicles.slice(0, 5).map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => handleViewVehicle(vehicle)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`
                        p-2.5 rounded-lg
                        ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                          vehicle.status === 'delayed' ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-100 text-slate-600'}
                      `}>
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{vehicle.name}</h4>
                        <div className="flex items-center space-x-3 mt-1 text-sm text-slate-500">
                          <span>{vehicle.driver}</span>
                          <span>•</span>
                          <span>{vehicle.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {vehicle.maintenanceDue && (
                        <Badge variant="warning" dot>
                          Maintenance
                        </Badge>
                      )}
                      <Badge variant={vehicle.status === 'active' ? 'success' : vehicle.status === 'delayed' ? 'warning' : 'default'}>
                        {vehicle.status}
                      </Badge>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Deliveries Card */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recent Deliveries</h3>
                <p className="text-sm text-slate-500 mt-1">Track delivery progress</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeliveryFormOpen(true)}
              >
                Add Delivery
              </Button>
            </div>

            {deliveries.length === 0 ? (
              <EmptyState
                type="data"
                title="No deliveries yet"
                description="Create your first delivery to start tracking."
                actionLabel="Add Delivery"
                onAction={() => setIsDeliveryFormOpen(true)}
              />
            ) : (
              <div className="space-y-3">
                {deliveries.slice(0, 4).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`
                          p-2 rounded-lg
                          ${delivery.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' :
                            delivery.status === 'in-transit' ? 'bg-blue-50 text-blue-600' :
                            'bg-amber-50 text-amber-600'}
                        `}>
                          <Package className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900">{delivery.customer}</h4>
                          <p className="text-sm text-slate-500">{delivery.address}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
                            <span className="flex items-center space-x-1">
                              <Truck className="h-4 w-4" />
                              <span>{delivery.driver}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Package className="h-4 w-4" />
                              <span>{delivery.items} items</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={
                        delivery.status === 'delivered' ? 'success' :
                        delivery.status === 'in-transit' ? 'primary' :
                        'warning'
                      }>
                        {delivery.status}
                      </Badge>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-medium text-slate-900">{delivery.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`
                            h-full rounded-full transition-all
                            ${delivery.status === 'delivered' ? 'bg-emerald-500' :
                              delivery.status === 'in-transit' ? 'bg-blue-500' :
                              'bg-amber-500'}
                          `}
                          style={{ width: `${delivery.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Setup Checklist */}
          {showChecklist && (
            <SetupChecklist
              onDismiss={() => setShowChecklist(false)}
            />
          )}

          {/* Maintenance Schedule */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Maintenance</h3>
                <p className="text-sm text-slate-500 mt-1">Upcoming tasks</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMaintenanceFormOpen(true)}
              >
                Add Task
              </Button>
            </div>

            {maintenanceTasks.length === 0 ? (
              <EmptyState
                type="data"
                title="No maintenance tasks"
                description="Schedule maintenance to keep your fleet running smoothly."
                actionLabel="Schedule Task"
                onAction={() => setIsMaintenanceFormOpen(true)}
              />
            ) : (
              <div className="space-y-3">
                {maintenanceTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-amber-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-slate-900">{task.vehicle}</h4>
                        <p className="text-sm text-slate-500">{task.type}</p>
                      </div>
                      <Badge variant={
                        task.priority === 'high' ? 'danger' :
                        task.priority === 'medium' ? 'warning' :
                        'default'
                      }>
                        {task.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1 mt-2 text-sm text-slate-500">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {task.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <MessageSquare className="h-6 w-6 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-slate-700">Announce</span>
              </button>
              <button
                onClick={() => setIsDeliveryFormOpen(true)}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <Package className="h-6 w-6 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-slate-700">Delivery</span>
              </button>
              <button
                onClick={() => setIsMaintenanceFormOpen(true)}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <AlertTriangle className="h-6 w-6 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-slate-700">Maintenance</span>
              </button>
              <button
                onClick={() => notify.info('Reports feature coming soon!')}
                className="flex flex-col items-center justify-center p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
              >
                <BarChart3 className="h-6 w-6 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-slate-700">Reports</span>
              </button>
            </div>
          </Card>

          {/* Activity Feed */}
          <ActivityFeed limit={5} />
        </div>
      </div>

      {/* Modals */}
      <AnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        onSend={(message, priority, recipients) => {
          dataService.addAnnouncement({
            message,
            priority,
            recipients,
          });
          setIsAnnouncementModalOpen(false);
          notify.success('Announcement sent successfully');
        }}
      />
      <VehicleDetailModal
        isOpen={isVehicleDetailOpen}
        onClose={() => setIsVehicleDetailOpen(false)}
        vehicle={selectedVehicle}
        onEdit={() => {
          if (selectedVehicle) {
            setEditingVehicle(selectedVehicle);
            setIsVehicleFormOpen(true);
            setIsVehicleDetailOpen(false);
          }
        }}
        onDelete={() => {
          if (selectedVehicle) {
            handleDeleteVehicle(selectedVehicle);
            setIsVehicleDetailOpen(false);
          }
        }}
      />
      <VehicleFormModal
        isOpen={isVehicleFormOpen}
        onClose={() => setIsVehicleFormOpen(false)}
        onSubmit={(vehicle) => {
          if (editingVehicle) {
            dataService.updateVehicle(vehicle.id, vehicle);
            notify.success(`Vehicle "${vehicle.name}" updated successfully`);
          } else {
            dataService.addVehicle(vehicle);
            notify.success(`Vehicle "${vehicle.name}" added successfully`);
          }
          refreshData();
        }}
        vehicle={editingVehicle}
      />
      <DeliveryFormModal
        isOpen={isDeliveryFormOpen}
        onClose={() => setIsDeliveryFormOpen(false)}
        onSubmit={(delivery) => {
          dataService.addDelivery(delivery);
          refreshData();
          notify.success(`Delivery for "${delivery.customer}" created successfully`);
        }}
        clients={clients}
        vehicles={vehicles}
      />
      <MaintenanceTaskFormModal
        isOpen={isMaintenanceFormOpen}
        onClose={() => setIsMaintenanceFormOpen(false)}
        onSubmit={(task) => {
          dataService.addMaintenanceTask(task);
          refreshData();
          notify.success('Maintenance task scheduled successfully');
        }}
        vehicles={vehicles}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowChecklist(true)}
      />

      <QuickActions
        onAddVehicle={handleAddVehicle}
        onAddDelivery={() => setIsDeliveryFormOpen(true)}
        onAddClient={() => setIsClientFormOpen(true)}
        onAddMaintenance={() => setIsMaintenanceFormOpen(true)}
      />
    </DashboardLayout>
  );
}
