import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Package,
  Plus,
  Search,
  MapPin,
  Truck,
  Clock,
  CheckCircle,
  Download,
  Navigation,
  Edit,
  Trash2,
  ChevronDown,
  AlertCircle,
} from 'lucide-react'
import { DeliveryTimeline } from '../../components/DeliveryTimeline'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { InlineAlert } from '../../components/ui/Alert'
import { FadeIn } from '../../components/ui/FadeIn'
import * as api from '../../services/apiService'
import type { Delivery, Vehicle, Client } from '../../services/apiService'
import { notify } from '../../services/notifications'
import DeliveryFormModal from '../../components/DeliveryFormModal'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { useDataFetch } from '../../hooks/useDataFetch'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { Pagination, SortSelect, type SortOption } from '../../components/ui/Pagination'
import { useRecordQuery } from '../../hooks/useRecordQuery'
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole'
import { canManageDeliveries } from '../../lib/permissions'

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first', order: 'asc' },
  { value: 'customer', label: 'Customer (A–Z)', order: 'asc' },
  { value: 'scheduledTime', label: 'Scheduled time', order: 'asc' },
  { value: 'status', label: 'Status', order: 'asc' },
]

export default function DeliveriesPage() {
  const router = useRouter()
  const list = usePaginatedList<Delivery, api.DeliverySummary>({
    fetchPage: (params, signal) => api.getDeliveryPage({ ...params, summary: 1 }, signal),
    filterKeys: ['status'],
    sortKeys: ['createdAt', 'customer', 'scheduledTime', 'status'],
  })
  const { rows: deliveries, loading: isLoading, error: fetchError, lastUpdated, refetch: loadList, summary } = list
  // Vehicles and clients only feed the form pickers. Roles that may not list
  // them (drivers cannot read clients) must still see their deliveries.
  const { data: lookups, refetch: loadLookups } = useDataFetch(
    async () => {
      const [v, c] = await Promise.all([
        api.getVehicles().catch(() => [] as Vehicle[]),
        api.getClients().catch(() => [] as Client[]),
      ])
      return { vehicles: v, clients: c }
    },
    { vehicles: [] as Vehicle[], clients: [] as Client[] },
    []
  )
  const { vehicles, clients } = lookups
  const loadData = useCallback(
    async (options?: { background?: boolean }) => {
      await Promise.all([loadList(options), loadLookups(options)])
    },
    [loadList, loadLookups]
  )
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null)
  const { openConfirm } = useConfirmDialog()
  const { role, loading: roleLoading } = useWorkspaceRole()
  const canManage = role !== null && canManageDeliveries(role)
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null)
  const lastPolled = lastUpdated ?? new Date()

  // Poll every 30 seconds in the background: keep the current list on screen,
  // and pause while the tab is hidden (refresh once when it becomes visible).
  useEffect(() => {
    // Only the visible page is re-polled; picker lookups refresh on saves.
    const poll = () => {
      if (!document.hidden) void loadList({ background: true })
    }
    const interval = setInterval(poll, 30000)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [loadList])

  const minutesAgo = Math.floor((Date.now() - lastPolled.getTime()) / 60000)

  const isStale = (delivery: Delivery) => {
    if (delivery.status !== 'in-transit' && delivery.status !== 'pending') return false
    // Use scheduledTime or estimatedArrival as staleness proxy since updatedAt isn't exposed
    const ref = delivery.estimatedArrival || delivery.scheduledTime
    if (!ref) return false
    return Date.now() - new Date(ref).getTime() > 2 * 60 * 60 * 1000
  }

  const filtered = deliveries
  const { searchInput: searchQuery, setSearchInput: setSearchQuery, filters, setFilter, isFiltered } = list
  const statusFilter = filters.status || 'all'
  const statusCount = (status: string) => summary?.byStatus?.[status] ?? 0

  // Stat cards and chip counts cover every delivery in scope, not just this page.
  const stats = [
    {
      title: 'Total',
      value: summary?.total ?? 0,
      icon: <Package className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'In Transit',
      value: statusCount('in-transit'),
      icon: <Truck className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'Pending',
      value: statusCount('pending'),
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      iconBgColor: 'bg-amber-50',
    },
    {
      title: 'Delivered',
      value: statusCount('delivered'),
      icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
      iconBgColor: 'bg-emerald-50',
    },
  ]

  const handleEdit = (d: Delivery) => {
    const rawStatus = Array.isArray(router.query.status) ? router.query.status[0] : router.query.status
    const rawNotes = Array.isArray(router.query.notes) ? router.query.notes[0] : router.query.notes
    const status =
      rawStatus && ['pending', 'in-transit', 'delivered', 'cancelled'].includes(rawStatus)
        ? (rawStatus as Delivery['status'])
        : d.status
    setEditingDelivery({ ...d, status, ...(typeof rawNotes === 'string' ? { notes: rawNotes.slice(0, 2000) } : {}) })
    setIsFormOpen(true)
  }
  useRecordQuery({
    records: deliveries,
    // Wait for the workspace role too: edit links open the editor only for managers.
    loading: isLoading || roleLoading,
    resource: 'deliveries',
    // Only roles that may update deliveries get the edit form from a deep link.
    onMatch: canManage ? handleEdit : () => undefined,
    onEdit: canManage ? handleEdit : undefined,
    onUnavailable: () => toast.error('This record is unavailable or you no longer have access.'),
    // Edit links carry form prefills under list-filter names; drop them with the link.
    editPrefillKeys: ['status', 'notes'],
  })
  const handleDelete = (d: Delivery) => {
    void openConfirm({
      title: 'Delete Delivery',
      variant: 'danger',
      message: `Delete delivery for "${d.customer}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteDelivery(d.id)
          notify.success(`Delivery for "${d.customer}" deleted`)
          await loadData()
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete delivery')
          throw err
        }
      },
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'delivered') return <Badge variant="success">Delivered</Badge>
    if (status === 'in-transit') return <Badge variant="primary">In Transit</Badge>
    if (status === 'pending') return <Badge variant="warning">Pending</Badge>
    return <Badge>{status}</Badge>
  }

  const getProgressColor = (status: string) => {
    if (status === 'delivered') return 'bg-emerald-500'
    if (status === 'in-transit') return 'bg-blue-500'
    return 'bg-amber-500'
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Deliveries' }]}>
      <PageHeader
        title="Delivery Management"
        subtitle="Track and manage all your deliveries in real-time"
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="h-4 w-4" />}
              onClick={() => {
                Promise.all([
                  import('../../lib/csvExport'),
                  api.getAllMatching<Delivery>('/api/deliveries', list.queryParams),
                ])
                  .then(([{ downloadCSV }, rows]) => {
                    downloadCSV(
                      'deliveries',
                      rows.map((d) => ({
                        Customer: d.customer,
                        Address: d.address,
                        Driver: d.driver,
                        Status: d.status,
                        Progress: d.progress + '%',
                        'Completed Time': d.completedTime || '',
                      }))
                    )
                  })
                  .catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : 'Failed to export deliveries')
                  )
              }}
            >
              Export CSV
            </Button>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus className="h-4 w-4" />}
                onClick={() => setIsFormOpen(true)}
              >
                New Delivery
              </Button>
            )}
          </div>
        }
      />

      {fetchError && (
        <InlineAlert
          type="error"
          title={
            deliveries.length > 0
              ? 'Couldn’t refresh deliveries — showing the last loaded list'
              : 'Couldn’t load deliveries'
          }
          className="mb-4"
          actionLabel="Try again"
          onAction={() => void loadData()}
        >
          {fetchError}
        </InlineAlert>
      )}

      {/* Stats */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x sm:hidden">
          {stats.map((s) => (
            <div
              key={s.title}
              className="snap-start shrink-0 w-40 bg-white rounded-xl shadow-sm border border-slate-100 p-4"
            >
              <div className={`inline-flex p-2 rounded-lg ${s.iconBgColor} mb-2`}>{s.icon}</div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.title}</p>
            </div>
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <StatCard key={s.title} {...s} />
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              aria-label="Search deliveries"
              placeholder="Search deliveries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-11 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setFilter('status', e.target.value)}
            className="min-h-11 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in-transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <SortSelect
            id="delivery-sort"
            options={SORT_OPTIONS}
            sort={list.sort}
            order={list.order}
            onChange={list.setSort}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {['all', 'pending', 'in-transit', 'delivered'].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setFilter('status', s)}
              className={`min-h-11 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${statusFilter === s ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s === 'all' ? 'All Deliveries' : s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
              {s !== 'all' && <span className="ml-2 text-sm">({statusCount(s)})</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Last Updated Indicator */}
      <div className="flex items-center justify-end mb-3 text-xs text-slate-400">
        <Clock className="h-3 w-3 mr-1" />
        Last updated {minutesAgo === 0 ? 'just now' : `${minutesAgo} min${minutesAgo > 1 ? 's' : ''} ago`}
      </div>

      {isLoading && deliveries.length === 0 ? (
        <SkeletonTable rows={5} columns={5} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            type={isFiltered ? 'search' : 'data'}
            title={isFiltered ? 'No results found' : 'No deliveries yet'}
            description={
              isFiltered ? 'Try adjusting your search or filters' : 'Create your first delivery to start tracking'
            }
            actionLabel={!isFiltered && canManage ? 'Create Delivery' : undefined}
            onAction={!isFiltered && canManage ? () => setIsFormOpen(true) : undefined}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {filtered.map((delivery, index) => (
              <FadeIn key={delivery.id} delay={Math.min(index * 40, 240)}>
                <Card hover className={isStale(delivery) ? 'ring-2 ring-amber-300' : ''}>
                  {isStale(delivery) && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-3">
                      <AlertCircle className="h-3.5 w-3.5" />
                      No update in 2+ hours
                    </div>
                  )}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      <div
                        className={`p-3 rounded-xl ${delivery.status === 'delivered' ? 'bg-emerald-50 text-emerald-600' : delivery.status === 'in-transit' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}
                      >
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
                              ETA:{' '}
                              {new Date(delivery.estimatedArrival).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 max-w-sm">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-medium">{delivery.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getProgressColor(delivery.status)}`}
                          style={{ width: `${delivery.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        iconLeft={<Navigation className="h-4 w-4" />}
                        onClick={() =>
                          window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.address)}`, '_blank')
                        }
                      >
                        Navigate
                      </Button>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          iconLeft={<Edit className="h-4 w-4" />}
                          onClick={() => handleEdit(delivery)}
                        >
                          Edit
                        </Button>
                      )}
                      {canManage && delivery.status !== 'delivered' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            try {
                              await api.updateDelivery(delivery.id, {
                                status: 'delivered',
                                progress: 100,
                                completedTime: new Date().toISOString(),
                              })
                              notify.success(`Delivery for ${delivery.customer} marked as delivered`)
                              await loadData()
                            } catch (err: unknown) {
                              toast.error(err instanceof Error ? err.message : 'Failed to update delivery')
                            }
                          }}
                        >
                          Mark Delivered
                        </Button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => handleDelete(delivery)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Delete delivery"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Timeline Toggle */}
                  <button
                    onClick={() => setExpandedTimeline(expandedTimeline === delivery.id ? null : delivery.id)}
                    className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${expandedTimeline === delivery.id ? 'rotate-180' : ''}`}
                    />
                    {expandedTimeline === delivery.id ? 'Hide' : 'Show'} Timeline
                  </button>
                  {expandedTimeline === delivery.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <DeliveryTimeline deliveryId={delivery.id} />
                    </div>
                  )}
                </Card>
              </FadeIn>
            ))}
          </div>
          <Card className="mt-4">
            <Pagination
              label="deliveries"
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

      {canManage && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
          aria-label="New delivery"
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <DeliveryFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingDelivery(null)
        }}
        delivery={editingDelivery ?? undefined}
        clients={clients}
        vehicles={vehicles}
        onSubmit={async (delivery) => {
          notify.success(
            editingDelivery
              ? `Delivery for "${delivery.customer}" updated`
              : `Delivery for "${delivery.customer}" created`
          )
          await loadData()
        }}
      />
    </DashboardLayout>
  )
}
