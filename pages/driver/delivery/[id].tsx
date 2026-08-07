import { toast } from "react-hot-toast";
import { useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import {
  Package, MapPin, FileText, CheckCircle, Truck,
  AlertTriangle, ArrowLeft, Navigation, Loader2,
} from 'lucide-react'
import { useDataFetch } from '../../../hooks/useDataFetch'
import type { Delivery } from '../../../services/apiService'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  'picked-up': 'Picked Up',
  'in-transit': 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  'picked-up': 'bg-blue-100 text-blue-800',
  'in-transit': 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-800',
}

function getGeoLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: false }
    )
  })
}

export default function DriverDeliveryPage() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const [updating, setUpdating] = useState(false)

  const { data: delivery, loading, refetch } = useDataFetch<Delivery | null>(
    async () => {
      if (!id) return null
      const res = await fetch(`/api/deliveries/${id}`)
      if (!res.ok) throw new Error('Failed to load delivery')
      return res.json()
    },
    null,
    [id]
  )

  const updateStatus = useCallback(async (status: string, notes?: string) => {
    if (!id || updating) return
    setUpdating(true)
    try {
      const geo = await getGeoLocation()
      const res = await fetch(`/api/deliveries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, ...geo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update')
      }
      await refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update delivery')
    } finally {
      setUpdating(false)
    }
  }, [id, updating, refetch])

  const isComplete = delivery && ['delivered', 'failed', 'cancelled'].includes(delivery.status)

  return (
    <>
      <Head><title>Delivery - FleetFlow</title></Head>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900 truncate">Delivery Details</h1>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : !delivery ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-slate-500">Delivery not found</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 gap-4 max-w-lg mx-auto w-full">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[delivery.status] || 'bg-slate-100 text-slate-800'}`}>
                {STATUS_LABELS[delivery.status] || delivery.status}
              </span>
              {delivery.estimatedArrival && (
                <span className="text-sm text-slate-500">
                  ETA: {new Date(delivery.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Customer Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">{delivery.customer}</p>
                  <p className="text-sm text-slate-500">{delivery.items} item{delivery.items !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{delivery.address}</p>
                  <button
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(delivery.address)}`, '_blank')}
                    className="mt-1 text-sm text-blue-600 font-medium flex items-center gap-1"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Navigate
                  </button>
                </div>
              </div>

              {delivery.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-700">{delivery.notes}</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-auto space-y-3 pb-4">
              {isComplete ? (
                <div className={`text-center py-6 rounded-xl ${delivery.status === 'delivered' ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <CheckCircle className={`h-12 w-12 mx-auto mb-2 ${delivery.status === 'delivered' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <p className={`text-lg font-semibold ${delivery.status === 'delivered' ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {STATUS_LABELS[delivery.status]}
                  </p>
                  {delivery.completedTime && (
                    <p className="text-sm text-slate-500 mt-1">
                      {new Date(delivery.completedTime).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : delivery.status === 'pending' ? (
                <button
                  onClick={() => updateStatus('picked-up')}
                  disabled={updating}
                  className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />}
                  Mark as Picked Up
                </button>
              ) : (
                <>
                  <button
                    onClick={() => updateStatus('delivered')}
                    disabled={updating}
                    className="w-full py-4 bg-emerald-600 text-white text-lg font-semibold rounded-xl hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {updating ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                    Mark as Delivered
                  </button>
                  <button
                    onClick={() => {
                      const notes = prompt('Describe the issue:')
                      if (notes) updateStatus('failed', notes)
                    }}
                    disabled={updating}
                    className="w-full py-4 bg-white border-2 border-red-200 text-red-600 text-lg font-semibold rounded-xl hover:bg-red-50 active:bg-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Report Issue
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
