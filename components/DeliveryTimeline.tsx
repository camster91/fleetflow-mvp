import { useState, useEffect } from 'react'
import { Package, Truck, CheckCircle, XCircle, AlertTriangle, Clock, MapPin } from 'lucide-react'

interface DeliveryEvent {
  id: string
  deliveryId: string
  status: string
  timestamp: string
  notes: string | null
  latitude: number | null
  longitude: number | null
  createdBy: string | null
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-500 bg-amber-50', label: 'Pending' },
  'picked-up': { icon: Package, color: 'text-blue-500 bg-blue-50', label: 'Picked Up' },
  'in-transit': { icon: Truck, color: 'text-blue-500 bg-blue-50', label: 'In Transit' },
  delivered: { icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50', label: 'Delivered' },
  failed: { icon: AlertTriangle, color: 'text-red-500 bg-red-50', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-slate-500 bg-slate-50', label: 'Cancelled' },
}

export function DeliveryTimeline({ deliveryId }: { deliveryId: string }) {
  const [events, setEvents] = useState<DeliveryEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!deliveryId) return
    setLoading(true)
    fetch(`/api/deliveries/${deliveryId}/events`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [deliveryId])

  if (loading) {
    return <div className="py-4 text-center text-sm text-slate-400">Loading timeline...</div>
  }

  if (events.length === 0) {
    return <div className="py-4 text-center text-sm text-slate-400">No status updates yet</div>
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => {
        const config = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending
        const Icon = config.icon
        const isLast = i === events.length - 1

        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`p-1.5 rounded-full ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <p className="text-sm font-medium text-slate-900">{config.label}</p>
              <p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>
              {event.notes && <p className="text-sm text-slate-600 mt-1">{event.notes}</p>}
              {event.latitude != null && event.longitude != null && (
                <a
                  href={`https://maps.google.com/?q=${event.latitude},${event.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 flex items-center gap-1 mt-1"
                >
                  <MapPin className="h-3 w-3" /> View location
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
