import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, Edit, Phone, Mail, Globe, MapPin, Star, Package, Building, Save, X } from 'lucide-react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { SkeletonTable } from '../../components/ui/Skeleton'
import * as api from '../../services/apiService'
import type { Client } from '../../services/apiService'
import { notify } from '../../services/notifications'
import toast from 'react-hot-toast'
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole'
import { canManageClients } from '../../lib/permissions'

export default function ClientDetailPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Client>>({})
  const [isSaving, setIsSaving] = useState(false)
  const { role } = useWorkspaceRole()
  const canManage = role !== null && canManageClients(role)

  const loadClient = useCallback(async () => {
    if (!id) return
    try {
      const data = await api.getClientById(id)
      setClient(data)
      setEditForm(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load client')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadClient()
  }, [loadClient])

  const handleSave = async () => {
    if (!client || !editForm) return
    setIsSaving(true)
    try {
      const updated = await api.updateClient(client.id, editForm)
      setClient(updated)
      setEditForm(updated)
      setIsEditing(false)
      notify.success(`${updated.name} updated`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client')
    } finally {
      setIsSaving(false)
    }
  }

  const set = <K extends keyof Client>(field: K, value: Client[K]) =>
    setEditForm((prev) => ({ ...prev, [field]: value }))

  if (isLoading)
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Clients', href: '/clients' },
          { label: '...' },
        ]}
      >
        <SkeletonTable rows={6} columns={2} />
      </DashboardLayout>
    )

  if (!client)
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Clients', href: '/clients' },
          { label: 'Not Found' },
        ]}
      >
        <Card>
          <p className="text-center text-slate-500 py-8">Client not found</p>
        </Card>
      </DashboardLayout>
    )

  const current = isEditing ? editForm : client

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Clients', href: '/clients' },
        { label: client.name },
      ]}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
            {client.businessName && <p className="text-slate-500">{client.businessName}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<X className="h-4 w-4" />}
                onClick={() => {
                  setIsEditing(false)
                  setEditForm(client)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Save className="h-4 w-4" />}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : canManage ? (
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Edit className="h-4 w-4" />}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" /> Business Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Client Name</label>
                    <input
                      value={editForm.name ?? ''}
                      onChange={(e) => set('name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Business Name</label>
                    <input
                      value={editForm.businessName ?? ''}
                      onChange={(e) => set('businessName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                    <select
                      value={editForm.type ?? 'other'}
                      onChange={(e) => set('type', e.target.value as Client['type'])}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      {(
                        [
                          'restaurant',
                          'hotel',
                          'office',
                          'retail',
                          'warehouse',
                          'cafe',
                          'institution',
                          'other',
                        ] as const
                      ).map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                    <input
                      value={editForm.address ?? ''}
                      onChange={(e) => set('address', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                    <input
                      value={editForm.phone ?? ''}
                      onChange={(e) => set('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                    <input
                      value={editForm.email ?? ''}
                      onChange={(e) => set('email', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Type</p>
                    <p className="font-medium text-slate-900 capitalize">{client.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="font-medium text-slate-900 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {client.address}
                    </p>
                  </div>
                  {client.phone && (
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium text-slate-900 flex items-center gap-1">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {client.phone}
                      </p>
                    </div>
                  )}
                  {client.email && (
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="font-medium text-slate-900 flex items-center gap-1">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {client.email}
                      </p>
                    </div>
                  )}
                  {client.website && (
                    <div>
                      <p className="text-xs text-slate-500">Website</p>
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 flex items-center gap-1"
                      >
                        <Globe className="h-4 w-4" />
                        {client.website}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
            {isEditing && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                <textarea
                  value={editForm.notes ?? ''}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                />
              </div>
            )}
            {!isEditing && client.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-700">{client.notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-3">Status</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Rating</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= (client.rating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Frequency</span>
                <span className="text-sm font-medium text-slate-900 capitalize">
                  {client.deliveryFrequency ?? 'N/A'}
                </span>
              </div>
              {client.lastDeliveryDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Last Delivery</span>
                  <span className="text-sm font-medium text-slate-900">
                    {new Date(client.lastDeliveryDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" /> Delivery Info
            </h2>
            <div className="space-y-2 text-sm">
              {client.businessHours && (
                <div>
                  <p className="text-xs text-slate-500">Business Hours</p>
                  <p className="text-slate-700">{client.businessHours}</p>
                </div>
              )}
              {client.parkingInstructions && (
                <div>
                  <p className="text-xs text-slate-500">Parking</p>
                  <p className="text-slate-700">{client.parkingInstructions}</p>
                </div>
              )}
              {client.dropoffInstructions && (
                <div>
                  <p className="text-xs text-slate-500">Drop-off</p>
                  <p className="text-slate-700">{client.dropoffInstructions}</p>
                </div>
              )}
              {!client.businessHours && !client.parkingInstructions && !client.dropoffInstructions && (
                <p className="text-slate-400 text-xs">No delivery instructions on file.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
