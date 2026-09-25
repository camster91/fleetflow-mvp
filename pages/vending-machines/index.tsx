import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Plus, Search, Edit, Trash2, MapPin, Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { useConfirmDialog } from '../../components/ui/ConfirmDialog';
import * as api from '../../services/apiService';
import type { VendingMachine } from '../../services/apiService';
import { notify } from '../../services/notifications';
import toast from 'react-hot-toast';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';
import { canManageVendingMachines } from '../../lib/permissions';

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return <Badge variant="success">Active</Badge>;
  if (status === 'maintenance') return <Badge variant="warning">Maintenance</Badge>;
  return <Badge variant="danger">Out of Service</Badge>;
}

export default function VendingMachinesPage() {
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<VendingMachine | null>(null);
  const { openConfirm } = useConfirmDialog();
  const { role } = useWorkspaceRole();
  const canManage = role !== null && canManageVendingMachines(role);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getVendingMachines();
      setMachines(data);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to load machines'); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = machines.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.name.toLowerCase().includes(q) || m.location.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || m.status === statusFilter)
    );
  });

  const handleDelete = (m: VendingMachine) => {
    void openConfirm({
      title: 'Delete Machine', variant: 'danger',
      message: `Delete "${m.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteVendingMachine(m.id);
          notify.success(`"${m.name}" deleted`);
          await loadData();
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to delete machine'); throw err; }
      },
    });
  };

  const handleStatusToggle = async (m: VendingMachine) => {
    const next = m.status === 'active' ? 'maintenance' : 'active';
    try {
      await api.updateVendingMachine(m.id, { ...m, status: next });
      notify.success(`${m.name} set to ${next}`);
      await loadData();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to update machine'); }
  };

  const stats = [
    { title: 'Total', value: machines.length, icon: <ShoppingCart className="h-6 w-6 text-blue-600" />, iconBgColor: 'bg-blue-50' },
    { title: 'Active', value: machines.filter((m) => m.status === 'active').length, icon: <CheckCircle className="h-6 w-6 text-emerald-600" />, iconBgColor: 'bg-emerald-50' },
    { title: 'Maintenance', value: machines.filter((m) => m.status === 'maintenance').length, icon: <Wrench className="h-6 w-6 text-amber-600" />, iconBgColor: 'bg-amber-50' },
    { title: 'Out of Service', value: machines.filter((m) => m.status === 'out-of-service').length, icon: <AlertCircle className="h-6 w-6 text-red-600" />, iconBgColor: 'bg-red-50' },
  ];

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Vending Machines' }]}>
      <PageHeader
        title="Vending Machines"
        subtitle="Monitor and manage all vending machine locations"
        actions={canManage ? (
          <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={() => { setEditingMachine(null); setIsFormOpen(true); }}>
            Add Machine
          </Button>
        ) : undefined}
      />

      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search machines or locations..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="out-of-service">Out of Service</option>
          </select>
        </div>
      </Card>

      {isLoading ? <SkeletonTable rows={5} columns={4} /> : filtered.length === 0 ? (
        <Card>
          <EmptyState type={searchQuery ? 'search' : 'data'}
            title={searchQuery ? 'No results found' : 'No vending machines yet'}
            description={searchQuery ? 'Try adjusting your search' : 'Add your first vending machine to start tracking'}
            actionLabel={!searchQuery && canManage ? 'Add Machine' : undefined}
            onAction={!searchQuery && canManage ? () => setIsFormOpen(true) : undefined} />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} hover className="flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl"><ShoppingCart className="h-6 w-6 text-blue-600" /></div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={m.status} />
                  {canManage && <button onClick={() => { setEditingMachine(m); setIsFormOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label={`Edit ${m.name}`}>
                    <Edit className="h-4 w-4" />
                  </button>}
                  {canManage && <button onClick={() => handleDelete(m)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" aria-label={`Delete ${m.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>}
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{m.name}</h3>
              <div className="flex items-center text-sm text-slate-500 mb-2">
                <MapPin className="h-4 w-4 mr-1" />{m.location}
              </div>
              {m.machineType && <p className="text-xs text-slate-400 mb-3">Type: {m.machineType}</p>}
              {m.notes && <p className="text-sm text-slate-600 mb-3 line-clamp-2">{m.notes}</p>}
              {canManage && <div className="mt-auto pt-3 border-t border-slate-100 flex gap-2">
                <button onClick={() => handleStatusToggle(m)}
                  className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
                    m.status === 'active'
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}>
                  {m.status === 'active' ? 'Set Maintenance' : 'Set Active'}
                </button>
              </div>}
            </Card>
          ))}
        </div>
      )}

      {canManage && <button onClick={() => { setEditingMachine(null); setIsFormOpen(true); }}
        className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg" aria-label="Add machine">
        <Plus className="h-6 w-6" />
      </button>}

      {/* VendingMachine form modal - inline simple form since no dedicated modal exists */}
      {canManage && isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingMachine ? 'Edit Machine' : 'Add Machine'}</h2>
              <button onClick={() => { setIsFormOpen(false); setEditingMachine(null); }} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
            </div>
            <VendingMachineForm
              machine={editingMachine}
              onSave={async (data) => {
                try {
                  if (editingMachine) {
                    await api.updateVendingMachine(editingMachine.id, data);
                    notify.success(`"${data.name}" updated`);
                  } else {
                    await api.addVendingMachine(data);
                    notify.success(`"${data.name}" added`);
                  }
                  setIsFormOpen(false); setEditingMachine(null);
                  await loadData();
                } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to save machine'); }
              }}
              onCancel={() => { setIsFormOpen(false); setEditingMachine(null); }}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

type VendingMachineFormData = Omit<VendingMachine, 'id'>;

function VendingMachineForm({ machine, onSave, onCancel }: {
  machine: VendingMachine | null;
  onSave: (data: VendingMachineFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<VendingMachineFormData>({
    name: machine?.name ?? '',
    location: machine?.location ?? '',
    type: machine?.type ?? 'other',
    status: machine?.status ?? 'active',
    serialNumber: machine?.serialNumber ?? '',
    notes: machine?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Machine name" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
          <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Street address or site name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VendingMachine['type'] })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            {['snacks','beverages','combo','coffee','fresh-food','other'].map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('-',' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VendingMachine['status'] })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="out-of-service">Out of Service</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
          <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Optional" />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
