import { useState } from 'react';
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
import { InlineAlert } from '../../components/ui/Alert';
import { FadeIn } from '../../components/ui/FadeIn';
import ClientFormModal from '../../components/ClientFormModal';
import * as api from '../../services/apiService';
import type { Client } from '../../services/apiService';
import { notify } from '../../services/notifications';
import toast from 'react-hot-toast';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { Pagination, SortSelect, type SortOption } from '../../components/ui/Pagination';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';
import { canManageClients } from '../../lib/permissions';

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

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Name (A–Z)' },
  { value: 'name', label: 'Name (Z–A)', order: 'desc' },
  { value: 'rating', label: 'Rating (highest)', order: 'desc' },
  { value: 'createdAt', label: 'Recently added', order: 'desc' },
  { value: 'type', label: 'Type', order: 'asc' },
];

export default function ClientsPage() {
  const router = useRouter();
  const { role } = useWorkspaceRole();
  const canManage = role !== null && canManageClients(role);
  const list = usePaginatedList<Client, api.ClientSummary>({
    fetchPage: (params, signal) => api.getClientPage({ ...params, summary: 1 }, signal),
    filterKeys: ['type'],
    sortKeys: ['name', 'rating', 'createdAt', 'type'],
  });
  const { rows: clients, loading: isLoading, error: fetchError, refetch: loadData, summary } = list;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const filtered = clients;
  const { searchInput: searchQuery, setSearchInput: setSearchQuery, filters, setFilter, isFiltered } = list;
  const typeFilter = filters.type || 'all';

  // Stat cards cover every client in the workspace, not just this page.
  const stats = [
    { title: 'Total Clients', value: summary?.total ?? 0, icon: <Building className="h-6 w-6 text-blue-600" />, iconBgColor: 'bg-blue-50' },
    { title: 'Restaurant/Hotel', value: summary?.restaurantHotel ?? 0, icon: <Building className="h-6 w-6 text-purple-600" />, iconBgColor: 'bg-purple-50' },
    { title: 'High Rating', value: summary?.highRating ?? 0, icon: <Star className="h-6 w-6 text-amber-500" />, iconBgColor: 'bg-amber-50' },
  ];

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Clients' }]}>
      <PageHeader
        title="Clients"
        subtitle="Manage your client accounts and delivery locations"
        actions={canManage ? (
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => { setEditingClient(null); setIsFormOpen(true); }}
          >
            Add Client
          </Button>
        ) : undefined}
      />

      {fetchError && (
        <InlineAlert
          type="error"
          title="Couldn’t load clients"
          className="mb-4"
          actionLabel="Try again"
          onAction={() => void loadData()}
        >
          {fetchError}
        </InlineAlert>
      )}

      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x sm:hidden">
          {stats.map((s) => (
            <div key={s.title} className="snap-start shrink-0 w-40 bg-white rounded-xl shadow-sm border border-slate-100 p-4">
              <div className={`inline-flex p-2 rounded-lg ${s.iconBgColor} mb-2`}>{s.icon}</div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.title}</p>
            </div>
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          {stats.map((s) => <StatCard key={s.title} {...s} />)}
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Search clients"
              placeholder="Search by name, address, phone, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900"
            />
          </div>
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setFilter('type', e.target.value)}
            className="min-h-11 px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
          <SortSelect id="client-sort" options={SORT_OPTIONS} sort={list.sort} order={list.order} onChange={list.setSort} />
        </div>
      </Card>

      {isLoading && clients.length === 0 ? (
        <SkeletonTable rows={5} columns={4} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            type={isFiltered ? 'search' : 'data'}
            title={isFiltered ? 'No clients found' : 'No clients yet'}
            description={isFiltered ? 'Try adjusting your search or filter' : 'Add your first client to get started'}
            actionLabel={!isFiltered && canManage ? 'Add Client' : undefined}
            onAction={!isFiltered && canManage ? () => setIsFormOpen(true) : undefined}
          />
        </Card>
      ) : (
        <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client, index) => (
            <FadeIn key={client.id} delay={Math.min(index * 40, 240)}>
            <Card hover className="flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Building className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex items-center gap-1">
                  <TypeBadge type={client.type} />
                  {canManage && <button
                    onClick={() => { setEditingClient(client); setIsFormOpen(true); }}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg ml-1"
                    aria-label={`Edit ${client.name}`}
                  >
                    <Edit className="h-4 w-4" />
                  </button>}
                  <button
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center text-slate-400 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg"
                    title="View details"
                    aria-label={`View ${client.name}`}
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
            </FadeIn>
          ))}
        </div>
        <Card className="mt-4">
          <Pagination
            label="clients"
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            disabled={isLoading}
          />
        </Card>
        </>
      )}

      {/* FAB */}
      {canManage && <button
        onClick={() => { setEditingClient(null); setIsFormOpen(true); }}
        className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
        aria-label="Add client"
      >
        <Plus className="h-6 w-6" />
      </button>}

      <ClientFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingClient(null); }}
        client={editingClient}
        onSubmit={async (client) => {
          const displayName = client.businessName || client.name;
          notify.success(editingClient ? `${displayName} updated` : `${displayName} added`);
          setIsFormOpen(false);
          setEditingClient(null);
          await loadData();
        }}
      />
    </DashboardLayout>
  );
}
