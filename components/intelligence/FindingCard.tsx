import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronDown, Check, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { ActionPreview } from '@/components/assistant/ActionPreview'

export interface BriefEvidence {
  entityType: 'vehicle' | 'delivery' | 'maintenance' | 'client'
  entityId: string
  field: string
  value: string | number | boolean | null
  timestamp: string | null
}

export interface BriefFinding {
  id: string
  type: string
  severity: string
  confidence: number
  score: number
  title: string
  explanation: string
  evidence: BriefEvidence[]
  evidenceValid: boolean
  evidenceTotal: number | null
  evidenceTruncated: boolean
  action: string | null
  actionUrl: string | null
  feedback: string | null
  status?: string
  effectiveStatus?: string
  generatedAt: string
  expiresAt: string | null
}

interface FindingCardProps {
  finding: BriefFinding
  canManage: boolean
  canFeedback: boolean
  busy?: boolean
  onAction: (finding: BriefFinding, action: 'HELPFUL' | 'NOT_HELPFUL' | 'DISMISS' | 'RESOLVE') => void
  cardRef?: (node: HTMLElement | null) => void
}

function evidenceHref(item: BriefEvidence): string {
  if (item.entityType === 'client') return `/clients/${encodeURIComponent(item.entityId)}`
  return `/${item.entityType === 'vehicle' ? 'vehicles' : item.entityType === 'delivery' ? 'deliveries' : 'maintenance'}?record=${encodeURIComponent(item.entityId)}`
}

function presentValue(value: BriefEvidence['value']): string {
  if (value === null) return 'Not recorded'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value).slice(0, 160)
}

export function FindingCard({ finding, canManage, canFeedback, busy = false, onAction, cardRef }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deliveryStatus, setDeliveryStatus] = useState<'pending' | 'in-transit' | 'delivered' | 'cancelled'>('in-transit')
  const [maintenanceType, setMaintenanceType] = useState('')
  const severity = ['high', 'medium', 'low'].includes(finding.severity) ? finding.severity : 'unknown'
  const urgency = severity === 'high' ? 'High urgency' : severity === 'medium' ? 'Medium urgency' : severity === 'low' ? 'Low urgency' : 'Urgency unavailable'
  const disclosureId = `finding-evidence-${finding.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const deliveryEvidence = finding.evidence.find(item => item.entityType === 'delivery' && item.timestamp)
  const vehicleEvidence = finding.evidence.find(item => item.entityType === 'vehicle' && item.timestamp)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <article ref={cardRef} tabIndex={-1} data-testid="finding-card" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${severity === 'high' ? 'bg-red-50 text-red-700' : severity === 'medium' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{urgency}
          </p>
          <h3 className="mt-2 break-words text-base font-semibold text-slate-950">{finding.title}</h3>
          <p className="mt-1 break-words text-sm text-slate-600">{finding.explanation}</p>
        </div>
        {finding.actionUrl && (
          <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-emerald-900 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2" href={finding.actionUrl}>
            {finding.action || 'Review record'}
          </Link>
        )}
      </div>

      <button type="button" aria-expanded={expanded} aria-controls={disclosureId} onClick={() => setExpanded(value => !value)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
        Why am I seeing this?<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {expanded && (
        <div id={disclosureId} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
          {!finding.evidenceValid ? (
            <p role="status" className="text-amber-800">Supporting evidence is unavailable. Refresh the brief before acting.</p>
          ) : finding.evidence.length === 0 ? (
            <p className="text-slate-600">No supporting records were retained for this finding.</p>
          ) : (
            <ul className="space-y-2">
              {finding.evidence.map((item, index) => (
                <li key={`${item.entityType}:${item.entityId}:${item.field}:${index}`} className="break-words">
                  <span className="font-medium text-slate-800">{item.field}:</span> <span className="text-slate-600">{presentValue(item.value)}</span>{' '}
                  <Link className="inline-flex min-h-11 items-center text-emerald-800 underline" href={evidenceHref(item)}>Open {item.entityType} record</Link>
                </li>
              ))}
            </ul>
          )}
          {finding.evidenceTruncated && <p role="status" className="mt-2 text-amber-800">Only part of the supporting evidence is shown.</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {canFeedback && <>
          <button disabled={busy} type="button" aria-pressed={finding.feedback === 'HELPFUL'} aria-label={`Mark ${finding.title} helpful`} onClick={() => onAction(finding, 'HELPFUL')} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm hover:bg-slate-100 disabled:opacity-50 ${finding.feedback === 'HELPFUL' ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'}`}><ThumbsUp className="h-4 w-4" aria-hidden="true" />Helpful</button>
          <button disabled={busy} type="button" aria-pressed={finding.feedback === 'NOT_HELPFUL'} aria-label={`Mark ${finding.title} not helpful`} onClick={() => onAction(finding, 'NOT_HELPFUL')} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm hover:bg-slate-100 disabled:opacity-50 ${finding.feedback === 'NOT_HELPFUL' ? 'bg-amber-50 text-amber-900' : 'text-slate-700'}`}><ThumbsDown className="h-4 w-4" aria-hidden="true" />Not helpful</button>
        </>}
        {canManage && finding.effectiveStatus === 'OPEN' && <>
          <button disabled={busy} type="button" aria-label={`Dismiss ${finding.title}`} onClick={() => onAction(finding, 'DISMISS')} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" />Dismiss</button>
          <button disabled={busy} type="button" aria-label={`Resolve ${finding.title}`} onClick={() => onAction(finding, 'RESOLVE')} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" />Resolve</button>
        </>}
      </div>
      {canManage && finding.evidenceValid && (deliveryEvidence || vehicleEvidence) && <section aria-label={`Suggested actions for ${finding.title}`} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        <p className="text-sm font-semibold text-slate-800">Suggested actions</p>
        {deliveryEvidence && <div className="space-y-2"><label className="block text-xs font-medium text-slate-700">Delivery status<select value={deliveryStatus} onChange={event => setDeliveryStatus(event.target.value as typeof deliveryStatus)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><option value="pending">Pending</option><option value="in-transit">In transit</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label><ActionPreview sourceFindingId={finding.id} action={{ type: 'update_delivery_status', deliveryId: deliveryEvidence.entityId, values: { status: deliveryStatus }, expectedUpdatedAt: deliveryEvidence.timestamp! }} /></div>}
        {vehicleEvidence && <div className="space-y-2"><label className="block text-xs font-medium text-slate-700">Maintenance task type<input value={maintenanceType} maxLength={200} onChange={event => setMaintenanceType(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" /></label>{maintenanceType.trim() && <ActionPreview sourceFindingId={finding.id} action={{ type: 'create_maintenance_task', vehicleId: vehicleEvidence.entityId, values: { vehicle: 'Authorized vehicle', type: maintenanceType.trim(), dueDate: today, priority: finding.severity === 'high' ? 'high' : finding.severity === 'medium' ? 'medium' : 'low' }, expectedVehicleUpdatedAt: vehicleEvidence.timestamp! }} />}</div>}
      </section>}
    </article>
  )
}
