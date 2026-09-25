import { useState } from 'react'
import { useRouter } from 'next/router'
import { Truck, Plus, Search, Edit, Trash2, MapPin, Battery, Download, Grid, List } from 'lucide-react'
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
import type { Vehicle } from '../../services/apiService'
import { notify } from '../../services/notifications'
import VehicleFormModal from '../../components/VehicleFormModal'
import VehicleDetailModal from '../../components/VehicleDetailModal'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'
import { usePaginatedList } from '../../hooks/usePaginatedList'
import { Pagination, SortSelect, type SortOption } from '../../components/ui/Pagination'
import { useRecordQuery } from '../../hooks/useRecordQuery'
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole'
import { canManageVehicles } from '../../lib/permissions'

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Date added' },
  { value: 'name', label: 'Name (A–Z)', order: 'asc' },
  { value: 'name', label: 'Name (Z–A)', order: 'desc' },
  { value: 'status', label: 'Status', order: 'asc' },
  { value: 'mileage', label: 'Mileage (highest)', order: 'desc' },
  { value: 'mileage', label: 'Mileage (lowest)', order: 'asc' },
]

export default function VehiclesPage() {
  const router = useRouter()
  const list = usePaginatedList<Vehicle, api.VehicleSummary>({
    fetchPage: (params, signal) => api.getVehiclePage({ ...params, summary: 1 }, signal),
    filterKeys: ['status'],
    sortKeys: ['name', 'status', 'mileage', 'createdAt'],
  })
  const { rows: vehicles, loading: isLoading, error: fetchError, refetch: loadVehicles, summary } = list
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const { openConfirm } = useConfirmDialog()
  const { role, loading: roleLoading } = useWorkspaceRole()
  const canManage = role !== null && canManageVehicles(role)

  const filteredVehicles = vehicles
  const { searchInput: searchQuery, setSearchInput: setSearchQuery, setFilter, filters, isFiltered } = list
  const statusFilter = filters.status || 'all'

  // Stat cards cover the whole fleet, not just the current page or search.
  const stats = [
    {
      title: 'Total Vehicles',
      value: summary?.total ?? 0,
      icon: <Truck className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'Active',
      value: summary?.active ?? 0,
      icon: <div className="h-2 w-2 rounded-full bg-emerald-500" />,
      iconBgColor: 'bg-emerald-50',
    },
    {
      title: 'Maintenance Due',
      value: summary?.maintenanceDue ?? 0,
      icon: <div className="h-2 w-2 rounded-full bg-amber-500" />,
      iconBgColor: 'bg-amber-50',
    },
    {
      title: 'Avg Mileage',
      value: (summary?.averageMileage ?? 0).toLocaleString(),
      icon: <span className="text-sm font-bold text-slate-600">mi</span>,
      iconBgColor: 'bg-slate-100',
    },
  ]
  const pagination = (
    <Pagination
      label="vehicles"
      page={list.page}
      pageSize={list.pageSize}
      total={list.total}
      onPageChange={list.setPage}
      onPageSizeChange={list.setPageSize}
      disabled={isLoading}
    />
  )

  const handleAdd = () => {
    setEditingVehicle(null)
    setIsFormOpen(true)
  }
  const handleEdit = (v: Vehicle) => {
    const rawStatus = Array.isArray(router.query.status) ? router.query.status[0] : router.query.status
    const rawMileage = Array.isArray(router.query.mileage) ? router.query.mileage[0] : router.query.mileage
    const status =
      rawStatus && ['active', 'inactive', 'delayed'].includes(rawStatus) ? (rawStatus as Vehicle['status']) : v.status
    const mileage = rawMileage && /^\d+$/.test(rawMileage) ? Number(rawMileage) : v.mileage
    setEditingVehicle({ ...v, status, mileage })
    setIsFormOpen(true)
  }
  const handleView = (v: Vehicle) => {
    setSelectedVehicle(v)
    setIsDetailOpen(true)
  }

  useRecordQuery({
    records: vehicles,
    // Wait for the workspace role too: edit links open the editor only for managers.
    loading: isLoading || roleLoading,
    resource: 'vehicles',
    onMatch: handleView,
    onEdit: canManage ? handleEdit : undefined,
    onUnavailable: () => toast.error('This record is unavailable or you no longer have access.'),
    // Edit links carry form prefills under list-filter names; drop them with the link.
    editPrefillKeys: ['status', 'mileage'],
  })

  const handleDelete = (vehicle: Vehicle) => {
    void openConfirm({
      title: 'Delete Vehicle',
      message: `Delete "${vehicle.name}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.deleteVehicle(vehicle.id)
          notify.success(`Vehicle "${vehicle.name}" deleted`)
          await loadVehicles()
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete vehicle')
          throw err
        }
      },
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="success">Active</Badge>
    if (status === 'delayed') return <Badge variant="warning">Delayed</Badge>
    return <Badge variant="default">Inactive</Badge>
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Vehicles' }]}>
      <PageHeader
        title="Vehicles"
        subtitle="Manage your fleet vehicles, drivers, and status"
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="h-4 w-4" />}
              onClick={() => {
                Promise.all([
                  import('../../lib/csvExport'),
                  api.getAllMatching<Vehicle>('/api/vehicles', list.queryParams),
                ])
                  .then(([{ downloadCSV }, rows]) => {
                    downloadCSV(
                      'vehicles',
                      rows.map((v) => ({
                        Name: v.name,
                        Driver: v.driver || '',
                        Status: v.status,
                        Location: v.location || '',
                        Mileage: v.mileage || 0,
                      }))
                    )
                  })
                  .catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : 'Failed to export vehicles')
                  )
              }}
            >
              Export CSV
            </Button>
            {canManage && (
              <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={handleAdd}>
                Add Vehicle
              </Button>
            )}
          </div>
        }
      />

      {fetchError && (
        <InlineAlert
          type="error"
          title="Couldn’t load vehicles"
          className="mb-4"
          actionLabel="Try again"
          onAction={() => void loadVehicles()}
        >
          {fetchError}
        </InlineAlert>
      )}

      {/* Stats */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x sm:hidden">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className="snap-start shrink-0 w-40 bg-white rounded-xl shadow-sm border border-slate-100 p-4"
            >
              <div className={`inline-flex p-2 rounded-lg ${stat.iconBgColor} mb-2`}>{stat.icon}</div>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.title}</p>
            </div>
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                aria-label="Search vehicles"
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full min-h-11 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setFilter('status', e.target.value)}
              className="min-h-11 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="delayed">Delayed</option>
            </select>
            <SortSelect
              id="vehicle-sort"
              options={SORT_OPTIONS}
              sort={list.sort}
              order={list.order}
              onChange={list.setSort}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              aria-label="Table view"
              onClick={() => setViewMode('table')}
              className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg ${viewMode === 'table' ? 'bg-emerald-100 text-emerald-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
              className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg ${viewMode === 'grid' ? 'bg-emerald-100 text-emerald-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Grid className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading && vehicles.length === 0 ? (
        <SkeletonTable rows={5} columns={6} />
      ) : filteredVehicles.length === 0 ? (
        <Card>
          <EmptyState
            type={isFiltered ? 'search' : 'data'}
            title={isFiltered ? 'No results found' : 'No vehicles yet'}
            description={
              isFiltered
                ? 'Try adjusting your search or filters'
                : 'Add your first vehicle to start tracking your fleet'
            }
            actionLabel={!isFiltered && canManage ? 'Add Vehicle' : undefined}
            onAction={!isFiltered && canManage ? handleAdd : undefined}
          />
        </Card>
      ) : viewMode === 'table' ? (
        <Card padding="none">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredVehicles.map((vehicle, index) => (
              <FadeIn key={vehicle.id} delay={Math.min(index * 40, 240)} className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600' : vehicle.status === 'delayed' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}
                  >
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
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{vehicle.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Battery className="h-3.5 w-3.5" />
                    {vehicle.mileage.toLocaleString()} mi
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleView(vehicle)}
                    className="flex-1 py-2 border border-slate-300 rounded-lg text-sm font-medium min-h-11 text-slate-700 hover:bg-slate-50 touch-target"
                    style={{ touchAction: 'manipulation' }}
                  >
                    View
                  </button>
                  {canManage && (
                    <button
                      onClick={() => handleEdit(vehicle)}
                      className="flex-1 py-2 bg-emerald-800 text-white rounded-lg text-sm font-medium min-h-11 touch-target"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Edit
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(vehicle)}
                      className="p-2 border border-red-200 text-red-600 rounded-lg min-h-11 min-w-11 flex items-center justify-center hover:bg-red-50 touch-target"
                      style={{ touchAction: 'manipulation' }}
                      aria-label="Delete vehicle"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Vehicle', 'Status', 'Driver', 'Location', 'Mileage', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-50 rounded-lg mr-3">
                          <Truck className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{vehicle.name}</p>
                          <p className="text-sm text-slate-500">ETA: {vehicle.eta}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(vehicle.status)}
                        {vehicle.maintenanceDue && (
                          <Badge variant="warning" dot>
                            Maintenance
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{vehicle.driver}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-500">
                        <MapPin className="h-4 w-4 mr-1" />
                        {vehicle.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-slate-900">
                        <Battery className="h-4 w-4 mr-1 text-slate-400" />
                        {vehicle.mileage.toLocaleString()} mi
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(vehicle)}>
                          View
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(vehicle)}
                            aria-label="Edit vehicle"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(vehicle)}
                            aria-label="Delete vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t border-slate-200">{pagination}</div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((vehicle) => (
              <Card key={vehicle.id} hover className="cursor-pointer" onClick={() => handleView(vehicle)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-3 rounded-xl ${vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-600' : vehicle.status === 'delayed' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}
                    >
                      <Truck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{vehicle.name}</h3>
                      <p className="text-sm text-slate-500">{vehicle.driver}</p>
                    </div>
                  </div>
                  {getStatusBadge(vehicle.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-slate-500">
                    <MapPin className="h-4 w-4 mr-2" />
                    {vehicle.location}
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <Battery className="h-4 w-4 mr-2" />
                    {vehicle.mileage.toLocaleString()} miles
                  </div>
                </div>
                {vehicle.maintenanceDue && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-800 font-medium">Maintenance Due</p>
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm text-slate-500">ETA: {vehicle.eta}</span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(vehicle)
                      }}
                      aria-label="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Card className="mt-4">{pagination}</Card>
        </>
      )}

      {/* FAB */}
      {canManage && (
        <button
          onClick={handleAdd}
          className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
          aria-label="Add vehicle"
          style={{ touchAction: 'manipulation' }}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <VehicleFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        vehicle={editingVehicle}
        onSubmit={async (vehicle) => {
          notify.success(editingVehicle ? `Vehicle "${vehicle.name}" updated` : `Vehicle "${vehicle.name}" added`)
          await loadVehicles()
        }}
      />
      <VehicleDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} vehicle={selectedVehicle} />
    </DashboardLayout>
  )
}
