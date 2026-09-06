import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Calculator, ExternalLink, MapPin } from 'lucide-react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { confirmAction } from '../../services/notifications'

interface IntegrationView {
  provider: string; name: string; status: string; connected: boolean; needsReconnect: boolean
  capabilities: string[]; lastSyncAt: string | null; nextSyncAt: string | null; lastErrorCode: string | null
  readiness: { ready: boolean; reason?: string }
}
interface StagedRecord { id: string; remoteType?: string; remoteId: string; payloadHash: string; revision: number; reviewStatus: string; outcome?: string | null; attemptCount?: number; nextRetryAt?: string | null; lastErrorCode?: string | null; conflictReason: string | null; localEntityId: string | null; payload: { date?: string | null; total?: number | null; currency?: string | null; vendorRef?: string | null } | null; provenance: { provider?: string; syncedAt?: string; attemptedAt?: string } | null }
interface VehicleOption { id: string; name: string }

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet'
const callbackMessages: Record<string, string> = {
  oauth_invalid: 'The authorization link expired or was already used. Reconnect to try again.',
  oauth_failed: 'QuickBooks authorization could not be completed. Check provider availability and reconnect.',
  connection_changed: 'The connection changed while authorization was in progress. Reconnect to try again.',
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [items, setItems] = useState<IntegrationView[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [records, setRecords] = useState<StagedRecord[]>([])
  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const purchaseRecords = records.filter((record) => record.remoteType !== 'delivery_geocode')
  const geocodeRecords = records.filter((record) => record.remoteType === 'delivery_geocode')
  const load = useCallback(async () => {
    try {
      const [response, reviewResponse] = await Promise.all([fetch('/api/integrations'), fetch('/api/integrations/records')])
      const [body, reviewBody] = await Promise.all([response.json(), reviewResponse.json()])
      if (!response.ok) throw new Error(body.error || 'Unable to load integrations')
      if (!reviewResponse.ok) throw new Error(reviewBody.error || 'Unable to load staged records')
      setItems(body.integrations); setRecords(reviewBody.records || []); setVehicles(reviewBody.vehicles || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load integrations') }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!router.isReady) return
    const status = typeof router.query.status === 'string' ? router.query.status : ''
    setError(callbackMessages[status] || '')
  }, [router.isReady, router.query.status])

  async function connect(item: IntegrationView) {
    setBusy(item.provider); setError('')
    try {
      const response = await fetch(`/api/integrations/${item.provider}/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Connection failed')
      if (body.authorizationUrl) window.location.assign(body.authorizationUrl)
      else await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Connection failed') }
    finally { setBusy(null) }
  }
  async function sync(item: IntegrationView) {
    setBusy(item.provider); setError('')
    try {
      const response = await fetch(`/api/integrations/${item.provider}/sync`, { method: 'POST', headers: { 'Idempotency-Key': `${Date.now()}_${Math.random().toString(36).slice(2)}` } })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Sync failed')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Sync failed') }
    finally { setBusy(null) }
  }
  async function disconnect(item: IntegrationView) {
    const ok = await confirmAction(
      'Imported review records remain for audit, but credentials are removed.',
      `Disconnect ${item.name}?`
    )
    if (!ok) return
    setBusy(item.provider); setError('')
    try {
      const response = await fetch(`/api/integrations/${item.provider}/connect`, { method: 'DELETE' })
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || 'Disconnect failed') }
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Disconnect failed') }
    finally { setBusy(null) }
  }
  async function review(record: StagedRecord, action: 'MAP' | 'APPROVE' | 'REJECT') {
    setBusy(record.id); setError('')
    try {
      const response = await fetch('/api/integrations/records', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: record.id, revision: record.revision, payloadHash: record.payloadHash, action, ...(action === 'MAP' ? { vehicleId: mapping[record.id] } : {}) }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Review could not be saved')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Review could not be saved') }
    finally { setBusy(null) }
  }

  return <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings', href: '/settings' }, { label: 'Integrations' }]}>
    <PageHeader title="Integrations" subtitle="Connect verified data sources and review every imported change" />
    <div role="status" aria-live="polite">{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}</div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => {
        const statusLabel = item.connected ? 'Connected' : item.needsReconnect ? 'Reconnect required' : item.readiness.ready ? 'Not connected' : 'Configuration required'
        return <Card key={item.provider}>
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-slate-50 p-3">{item.provider === 'google-maps' ? <MapPin className="h-6 w-6 text-red-500" /> : <Calculator className="h-6 w-6 text-emerald-600" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">{item.name}</h2><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.connected ? 'bg-emerald-100 text-emerald-800' : item.needsReconnect ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{statusLabel}</span></div>
              <p className="mt-1 text-sm text-slate-600">{item.provider === 'google-maps' ? 'Adds missing delivery coordinates through server-side geocoding. Existing locations are never overwritten.' : 'Stages operating-cost records for vehicle mapping and operator review. Imported data is never applied silently.'}</p>
              {!item.readiness.ready && <p className="mt-2 text-sm text-amber-700">{item.readiness.reason}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><div><dt className="font-medium">Last sync</dt><dd>{formatDate(item.lastSyncAt)}</dd></div><div><dt className="font-medium">Next sync</dt><dd>{formatDate(item.nextSyncAt)}</dd></div></dl>
              {item.lastErrorCode && <p className="mt-2 text-xs text-red-700">Action required: {item.lastErrorCode.replaceAll('_', ' ').toLowerCase()}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.connected && <button type="button" disabled={busy === item.provider} onClick={() => void sync(item)} aria-label={`Sync ${item.name} now`} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Sync now</button>}
                {!item.connected && <button type="button" disabled={!item.readiness.ready || busy === item.provider} onClick={() => void connect(item)} aria-label={`${item.needsReconnect ? 'Reconnect' : 'Connect'} ${item.name}`} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{item.needsReconnect ? 'Reconnect' : 'Connect'}</button>}
                {item.connected && <button type="button" disabled={busy === item.provider} onClick={() => void disconnect(item)} aria-label={`Disconnect ${item.name}`} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Disconnect</button>}
              </div>
            </div>
          </div>
        </Card>
      })}
    </div>
    {geocodeRecords.length > 0 && <section className="mt-8" aria-labelledby="geocode-outcome-heading"><h2 id="geocode-outcome-heading" className="text-lg font-semibold text-slate-900">Google Maps delivery outcomes</h2><p className="mt-1 text-sm text-slate-600">Per-delivery results include retries and dead letters; existing coordinates remain untouched.</p><div className="mt-4 space-y-3">{geocodeRecords.map((record) => <Card key={record.id}><div className="flex flex-wrap justify-between gap-2"><p className="font-medium text-slate-900">Delivery {record.remoteId}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{(record.outcome || record.reviewStatus).replaceAll('_', ' ').toLowerCase()}</span></div>{record.lastErrorCode && <p className="mt-2 text-sm text-amber-700">Outcome: {record.lastErrorCode.replaceAll('_', ' ').toLowerCase()}</p>}<p className="mt-2 text-xs text-slate-500">Attempts: {record.attemptCount || 0}{record.nextRetryAt ? ` · Next retry ${formatDate(record.nextRetryAt)}` : ''}</p></Card>)}</div></section>}
    {purchaseRecords.length > 0 && <section className="mt-8" aria-labelledby="staged-cost-heading">
      <h2 id="staged-cost-heading" className="text-lg font-semibold text-slate-900">QuickBooks records awaiting review</h2>
      <p className="mt-1 text-sm text-slate-600">Map each cost to a vehicle, then approve it for a later explicit import. Approval here never creates or overwrites an expense.</p>
      <div className="mt-4 space-y-4">{purchaseRecords.map((record) => <Card key={record.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium text-slate-900">{record.payload?.vendorRef || 'Unassigned vendor'} · {record.payload?.total == null ? 'Amount unavailable' : record.payload.currency ? new Intl.NumberFormat(undefined, { style: 'currency', currency: record.payload.currency }).format(record.payload.total) : `${record.payload.total.toFixed(2)} (provider currency)`}</h3><p className="text-sm text-slate-600">{record.payload?.date || 'Date unavailable'} · Provider record {record.remoteId}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{record.reviewStatus.replaceAll('_', ' ').toLowerCase()}</span></div>
        {record.conflictReason && <p className="mt-2 text-sm text-amber-700">{record.conflictReason}</p>}
        {record.provenance?.syncedAt && <p className="mt-2 text-xs text-slate-500">Synced from {record.provenance.provider || 'provider'} {formatDate(record.provenance.syncedAt)}</p>}
        {record.reviewStatus !== 'APPROVED' && <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-slate-700">Vehicle<select aria-label={`Vehicle for provider record ${record.remoteId}`} value={mapping[record.id] || record.localEntityId || ''} onChange={(event) => setMapping((current) => ({ ...current, [record.id]: event.target.value }))} className="ml-2 min-h-11 rounded-lg border border-slate-300 px-3"><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</select></label>
          <button type="button" disabled={busy === record.id || !(mapping[record.id] || record.localEntityId)} onClick={() => void review(record, 'MAP')} className="min-h-11 rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-50">Map vehicle</button>
          <button type="button" disabled={busy === record.id || record.reviewStatus !== 'MAPPED_PENDING_APPROVAL'} onClick={() => void review(record, 'APPROVE')} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Approve for import</button>
          <button type="button" disabled={busy === record.id} onClick={() => void review(record, 'REJECT')} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Reject</button>
        </div>}
      </Card>)}</div>
    </section>}
    <Card className="mt-6 bg-slate-900 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Need another data source?</h2><p className="text-sm text-slate-300">Use the scoped read-only API while provider demand is validated with operators.</p></div><Link href="/settings/api" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white px-4 py-2 text-sm font-medium"><ExternalLink className="h-4 w-4" />View API docs</Link></div></Card>
  </DashboardLayout>
}
