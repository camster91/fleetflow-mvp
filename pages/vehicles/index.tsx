import { useState } from 'react';
import {
  Truck, Plus, Search, Edit, Trash2,
  MapPin, Battery, Download, Grid, List,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import * as api from '../../services/apiService';
import type { Vehicle } from '../../services/apiService';
import { notify } from '../../services/notifications';
import VehicleFormModal from '../../components/VehicleFormModal';
import VehicleDetailModal from '../../components/VehicleDetailModal';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useFilteredData } from '../../hooks/useFilteredData';

export default function VehiclesPage() {
  const { data: vehicles, loading: isLoading, refetch: loadVehicles } = useDataFetch<Vehicle[]>(
    api.getVehicles, [], []
  );
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'danger' as const,
  });

  const {
    filtered: filteredVehicles,
    searchQuery,
    setSearchQuery,
    setFilter,
    filters,
  } = useFilteredData<Vehicle>({
    data: vehicles,
    searchFields: ['name', 'driver', 'location'],
    filterFn: (v, f) => !f.status || f.status === 'all' || v.status === f.status,
  });
  const statusFilter = filters.status || 'all';

  const stats = [
    { title: 'Total Vehicles', value: vehicles.length, icon: <Truck className="h-6 w-6 text-blue-600" />, iconBgColor: 'bg-blue-50' },
    { title: 'Active', value: vehicles.filter((v) => v.status === 'active').length, icon: <div className="h-2 w-2 rounded-full bg-emerald-500" />, iconBgColor: 'bg-emerald-50' },
    { title: 'Maintenance Due', value: vehicles.filter((v) => v.maintenanceDue).length, icon: <div className="h-2 w-2 rounded-full bg-amber-500" />, iconBgColor: 'bg-amber-50' },
    { title: 'Avg Mileage', value: vehicles.length > 0 ? Math.round(vehicles.reduce((s, v) => s + v.mileage, 0) / vehicles.length).toLocaleString() : '0', icon: <span className="text-sm font-bold text-slate-600">mi</span>, iconBgColor: 'bg-slate-100' },
  ];

  const handleAdd = () => { setEditingVehicle(null); setIsFormOpen(true); };
  const handleEdit = (v: Vehicle) => { setEditingVehicle(v); setIsFormOpen(true); };
  const handleView = (v: Vehicle) => { setSelectedVehicle(v); setIsDetailOpen(true); };

  const handleDelete = (vehicle: Vehicle) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Vehicle',
      message: `Delete "${vehicle.name}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteVehicle(vehicle.id);
          notify.success(`Vehicle "${vehicle.name}" deleted`);
          await loadVehicles();
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete vehicle'); }
      },
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="success">Active</Badge>;
    if (status === 'delayed') return <Badge variant="warning">Delayed</Badge>;
    return <Badge variant="default">Inactive</Badge>;
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Vehicles' }]}>
      <PageHeader
        title="Vehicles"
        subtitle="Manage your fleet vehicles, drivers, and status"
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" iconLeft={<Download className="h-4 w-4" />} onClick={() => {
              import('../../lib/csvExport').then(({ downloadCSV }) => {
                downloadCSV('vehicles', filteredVehicles.map(v => ({ Name: v.name, Driver: v.driver || '', Status: v.status, Location: v.location || '', Mileage: v.mileage || 0 })));
              });
            }}>Export CSV</Button>
            <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={handleAdd}>Add Vehicle</Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x sm:hidden">
          {stats.map((stat) => (
            <div key={stat.title} className="snap-start shrink-0 w-40 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className={`inline-flex p-2 rounded-lg ${stat.iconBgColor} mb-2`}>{stat.icon}</div>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.title}</p>
            </div>
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search vehicles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent" />
            </div>
            <select value={statusFilter} onChange={(e) => setFilter('status', e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg ${viewMode === 'table' ? 'bg-blue-100 text-blue-900' : 'text-slate-400 hover:text-slate-600'}`}><List className="h-5 w-5" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-900' : 'text-slate-400 hover:text-slate-600'}`}><Grid className="h-5 w-5" /></button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? <SkeletonTable rows={5} columns={6} /> : filteredVehicles.length === 0 ? (
        <Card><EmptyState type={searchQuery ? 'search' : 'data'} title={searchQuery ? 'No results found' : 'No vehicles yet'}
          description={searchQuery ? 'Try adjusting your search' : 'Add your first vehicle to start tracking your fleet'}
          actionLabel={!searchQuery ? 'Add Vehicle' : undefined} onAction={!searchQuery ? handleAdd : undefined} /></Card>
      ) : viewMode === 'table' ? (
        <Card padding="none">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600' : vehicle.status === 'delayed' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 truncate">{vehicle.name}</p>
                      {getStatusBadge(vehicle.status)}
                    </div>
                    <p className="text-xs text-slate-500">{vehicle.driver}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 text-sm text-slate-500">
                  <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{vehicle.location}</span></div>
                  <div className="flex items-center gap-1"><Battery className="h-3.5 w-3.5" />{vehicle.mileage.toLocaleString()} mi</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleView(vehicle)} className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium min-h-[40px] text-slate-700 hover:bg-slate-50" style={{ touchAction: 'manipulation' }}>View</button>
                  <button onClick={() => handleEdit(vehicle)} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium min-h-[40px]" style={{ touchAction: 'manipulation' }}>Edit</button>
                  <button onClick={() => handleDelete(vehicle)} className="p-2 border border-red-200 text-red-600 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-red-50" style={{ touchAction: 'manipulation' }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Vehicle', 'Status', 'Driver', 'Location', 'Mileage', 'Actions'].map((h) => (
                    <th key={h} className={`px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-50 rounded-lg mr-3"><Truck className="h-5 w-5 text-blue-600" /></div>
                        <div><p className="font-medium text-slate-900">{vehicle.name}</p><p className="text-sm text-slate-500">ETA: {vehicle.eta}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">{getStatusBadge(vehicle.status)}{vehicle.maintenanceDue && <Badge variant="warning" dot>Maintenance</Badge>}</div>
                    </td>
                    <td className="px-6 py-4"><p className="text-sm text-slate-900">{vehicle.driver}</p></td>
                    <td className="px-6 py-4"><div className="flex items-center text-sm text-slate-500"><MapPin className="h-4 w-4 mr-1" />{vehicle.location}</div></td>
                    <td className="px-6 py-4"><div className="flex items-center text-sm text-slate-900"><Battery className="h-4 w-4 mr-1 text-slate-400" />{vehicle.mileage.toLocaleString()} mi</div></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(vehicle)}>View</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(vehicle)} aria-label="Edit vehicle"><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(vehicle)} aria-label="Delete vehicle"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">Showing {filteredVehicles.length} of {vehicles.length} vehicles</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} hover className="cursor-pointer" onClick={() => handleView(vehicle)}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-xl ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600' : vehicle.status === 'delayed' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}><Truck className="h-6 w-6" /></div>
                  <div><h3 className="font-semibold text-slate-900">{vehicle.name}</h3><p className="text-sm text-slate-500">{vehicle.driver}</p></div>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center text-sm text-slate-500"><MapPin className="h-4 w-4 mr-2" />{vehicle.location}</div>
                <div className="flex items-center text-sm text-slate-500"><Battery className="h-4 w-4 mr-2" />{vehicle.mileage.toLocaleString()} miles</div>
              </div>
              {vehicle.maintenanceDue && <div className="mt-4 p-3 bg-amber-50 rounded-lg"><p className="text-sm text-amber-800 font-medium">Maintenance Due</p></div>}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-500">ETA: {vehicle.eta}</span>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(vehicle); }} aria-label="Edit"><Edit className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button onClick={handleAdd} className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform" aria-label="Add vehicle" style={{ touchAction: 'manipulation' }}>
        <Plus className="h-6 w-6" />
      </button>

      <VehicleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        vehicle={editingVehicle}
        onSubmit={async (vehicle) => {
          notify.success(editingVehicle ? `Vehicle "${vehicle.name}" updated` : `Vehicle "${vehicle.name}" added`);
          await loadVehicles();
        }}
      />
      <VehicleDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} vehicle={selectedVehicle} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}
        title={confirmModal.title} message={confirmModal.message} variant={confirmModal.variant}
      />
    </DashboardLayout>
  );
}
