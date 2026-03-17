import { useState, useEffect, useCallback } from 'react';
import {
  Building, Plus, Search, Star, Phone, Mail, MapPin,
  Edit, ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import ClientFormModal from '../../components/ClientFormModal';
import * as api from '../../services/apiService';
import type { Client } from '../../services/apiService';
import { notify } from '../../services/notifications';
import toast from 'react-hot-toast';

function StarRating({ value }: { value?: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${
          i <= (value ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
        }`} />
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type?: string }) {
  const map: Record<string, string> = {
    restaurant: 'bg-orange-100 text-orange-700',
    hotel: 'bg-blue-100 text-blue-700',
    office: 'bg-slate-100 text-slate-700',
    retail: 'bg-emerald-100 text-emerald-700',
    warehouse: 'bg-yellow-100 text-yellow-700',
    cafe: 'bg-amber-100 text-amber-700',
    institution: 'bg-purple-100 text-purple-700',
    other: 'bg-gray-100 text-gray-700',
  };
  const label = type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[type ?? 'other'] ?? map.other}`}>{label}</span>;
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.businessName?.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchType;
  });

  const stats = [
    { title: 'Total Clients', value: clients.length, icon: <Building className="h-6 w-6 text-blue-600" />, iconBgColor: 'bg-blue-50' },
    { title: 'Restaurant/Hotel', value: clients.filter((c) => c.type === 'restaurant' || c.type === 'hotel').length, icon: <Building className="h-6 w-6 text-purple-600" />, iconBgColor: 'bg-purple-50' },
    { title: 'High Rating', value: clients.filter((c) => (c.rating ?? 0) >= 4).length, icon: <Star className="h-6 w-6 text-amber-500" />, iconBgColor: 'bg-amber-50' },
  ];

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Clients' }]}>
      <PageHeader
        title="Clients"
        subtitle="Manage your client accounts and delivery locations"
        actions={
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => { setEditingClient(null); setIsFormOpen(true); }}
          >
            Add Client
          </Button>
        }
      />

      <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, address, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            <option value="restaurant">Restaurant</option>
            <option value="hotel">Hotel</option>
            <option value="office">Office</option>
            <option value="retail">Retail</option>
            <option value="warehouse">Warehouse</option>
            <option value="cafe">Cafe</option>
            <option value="institution">Institution</option>
            <option value="other">Other</option>
          </select>
        </div>
      </Card>

      {isLoading ? (
        <SkeletonTable rows={5} columns={4} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            type={searchQuery ? 'search' : 'data'}
            title={searchQuery ? 'No clients found' : 'No clients yet'}
            description={searchQuery ? 'Try adjusting your search or filter' : 'Add your first client to get started'}
            actionLabel={!searchQuery ? 'Add Client' : undefined}
            onAction={!searchQuery ? () => setIsFormOpen(true) : undefined}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card key={client.id} hover className="flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex items-center gap-1">
                  <TypeBadge type={client.type} />
                  <button
                    onClick={() => { setEditingClient(client); setIsFormOpen(true); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg ml-1"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="View details"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 mb-0.5">{client.name}</h3>
              {client.businessName && client.businessName !== client.name && (
                <p className="text-xs text-slate-400 mb-2">{client.businessName}</p>
              )}

              <div className="space-y-1.5 mb-3 flex-1">
                {client.address && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{client.address}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <StarRating value={client.rating} />
                {client.deliveryFrequency && (
                  <span className="text-xs text-slate-400 capitalize">{client.deliveryFrequency}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setEditingClient(null); setIsFormOpen(true); }}
        className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
      >
        <Plus className="h-6 w-6" />
      </button>

      <ClientFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingClient(null); }}
        client={editingClient}
        onSubmit={async (client) => {
          notify.success(editingClient ? `${client.name} updated` : `${client.name} added`);
          setIsFormOpen(false);
          setEditingClient(null);
          await loadData();
        }}
      />
    </DashboardLayout>
  );
}
