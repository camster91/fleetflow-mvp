import { useCallback, useEffect, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { FindingCard, type BriefFinding } from '@/components/intelligence/FindingCard'
import { safeFindingActionUrl } from '@/lib/intelligence/actionUrls'

type StatusFilter = 'OPEN' | 'DISMISSED' | 'RESOLVED' | 'EXPIRED'
function safeFinding(finding: BriefFinding): BriefFinding {
  return { ...finding, actionUrl: safeFindingActionUrl(finding.actionUrl) }
}

export default function IntelligencePage() {
  const [status, setStatus] = useState<StatusFilter>('OPEN')
  const [findings, setFindings] = useState<BriefFinding[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState({ manage: false, feedback: false })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState('')
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const controller = useRef<AbortController | null>(null)
  const capabilitiesLoaded = useRef(false)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const mutationsInFlight = useRef(new Set<string>())
  const operationVersions = useRef(new Map<string, number>())
  const filterGeneration = useRef(0)
  const refetchAfterMutations = useRef(false)

  const load = useCallback(async (cursor?: string) => {
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    cursor ? setLoadingMore(true) : setLoading(true)
    cursor ? setLoadMoreError(false) : setError(false)
    try {
      if (!cursor && !capabilitiesLoaded.current) {
        const capabilityResponse = await fetch('/api/intelligence/brief', { signal: nextController.signal })
        if (capabilityResponse.ok) {
          const brief = await capabilityResponse.json() as { capabilities?: { manage?: boolean; feedback?: boolean } }
          setCapabilities({ manage: brief.capabilities?.manage === true, feedback: brief.capabilities?.feedback === true })
        }
        if (capabilityResponse.ok) capabilitiesLoaded.current = true
      }
      const params = new URLSearchParams({ status, limit: '25' })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/intelligence/findings?${params}`, { signal: nextController.signal })
      if (!response.ok) throw new Error('findings unavailable')
      const page = await response.json() as { findings: BriefFinding[]; pagination: { nextCursor: string | null } }
      const safe = page.findings.map(safeFinding)
      setFindings(current => cursor ? [...current, ...safe] : safe)
      setNextCursor(page.pagination.nextCursor)
    } catch (loadError) {
      if (!nextController.signal.aborted && !(loadError instanceof DOMException && loadError.name === 'AbortError')) cursor ? setLoadMoreError(true) : setError(true)
    } finally {
      if (!nextController.signal.aborted) { setLoading(false); setLoadingMore(false) }
    }
  }, [status])

  useEffect(() => {
    filterGeneration.current += 1
    void load()
    return () => controller.current?.abort()
  }, [load])

  const mutate = async (finding: BriefFinding, action: 'HELPFUL' | 'NOT_HELPFUL' | 'DISMISS' | 'RESOLVE') => {
    if (mutationsInFlight.current.has(finding.id)) return
    mutationsInFlight.current.add(finding.id)
    const generation = filterGeneration.current
    const version = (operationVersions.current.get(finding.id) ?? 0) + 1
    operationVersions.current.set(finding.id, version)
    const remove = (status === 'OPEN' || status === 'EXPIRED') && (action === 'DISMISS' || action === 'RESOLVE')
    const index = findings.findIndex(item => item.id === finding.id)
    const nextId = index >= 0 ? findings[index + 1]?.id : undefined
    setBusyIds(current => new Set(current).add(finding.id))
    setMessage('')
    setFindings(current => remove ? current.filter(item => item.id !== finding.id) : current.map(item => item.id === finding.id ? { ...item, feedback: action } : item))
    try {
      const response = await fetch('/api/intelligence/findings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: finding.id, action }) })
      if (!response.ok) throw new Error('update unavailable')
      await response.json()
      if (filterGeneration.current === generation) {
        refetchAfterMutations.current = true
        setMessage(action === 'HELPFUL' || action === 'NOT_HELPFUL' ? 'Feedback saved.' : 'Finding updated.')
        if (remove) requestAnimationFrame(() => (nextId ? cardRefs.current.get(nextId) : document.getElementById(findings.length === 1 ? 'intelligence-empty' : 'intelligence-heading'))?.focus())
      }
    } catch {
      if (filterGeneration.current === generation && operationVersions.current.get(finding.id) === version) {
        setFindings(current => {
          const exists = current.some(item => item.id === finding.id)
          return exists ? current.map(item => item.id === finding.id ? finding : item) : [...current.slice(0, Math.max(0, index)), finding, ...current.slice(Math.max(0, index))]
        })
        setMessage('Could not update the finding. It was restored; try again.')
        requestAnimationFrame(() => cardRefs.current.get(finding.id)?.focus())
      }
    } finally {
      mutationsInFlight.current.delete(finding.id)
      setBusyIds(current => { const next = new Set(current); next.delete(finding.id); return next })
      if (mutationsInFlight.current.size === 0 && refetchAfterMutations.current && filterGeneration.current === generation) {
        refetchAfterMutations.current = false
        void load()
      }
    }
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fleet intelligence' }]}>
      <div className="mx-auto max-w-4xl min-w-0 space-y-5">
        <div>
          <h1 id="intelligence-heading" tabIndex={-1} className="text-2xl font-bold text-slate-950">Fleet intelligence findings</h1>
          <p className="mt-1 text-sm text-slate-600">Review the record-backed issues Fleetvera has prioritized for this workspace.</p>
        </div>
        <label className="block max-w-xs text-sm font-medium text-slate-800">Finding status
          <select value={status} onChange={event => setStatus(event.target.value as StatusFilter)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="OPEN">Open</option><option value="DISMISSED">Dismissed</option><option value="RESOLVED">Resolved</option><option value="EXPIRED">Expired</option>
          </select>
        </label>
        <div aria-live="polite" className="min-h-5 text-sm text-slate-700">{message}</div>
        {loading && <div role="status" aria-label="Loading intelligence findings" className="h-40 animate-pulse rounded-xl bg-slate-100"><span className="sr-only">Loading intelligence findings</span></div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"><p className="font-semibold">Could not load findings</p><p className="text-sm">No data was changed.</p><button type="button" onClick={() => void load()} className="mt-2 min-h-11 px-2 font-medium underline">Try again</button></div>}
        {!loading && !error && findings.length === 0 && <div id="intelligence-empty" tabIndex={-1} className="rounded-xl border border-dashed border-slate-300 p-8 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"><p className="font-semibold text-slate-900">No {status.toLowerCase()} findings</p><p className="mt-1 text-sm text-slate-600">Try another status or return after the next refresh.</p></div>}
        {!error && <div className="space-y-4">{findings.map(finding => <FindingCard key={finding.id} finding={finding} canManage={capabilities.manage} canFeedback={capabilities.feedback} busy={busyIds.has(finding.id)} cardRef={node => { if (node) cardRefs.current.set(finding.id, node); else cardRefs.current.delete(finding.id) }} onAction={(item, action) => void mutate(item, action)} />)}</div>}
        {loadMoreError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Could not load more findings. Existing findings are still shown. <button type="button" onClick={() => nextCursor && void load(nextCursor)} className="min-h-11 px-2 font-medium underline">Retry load more</button></div>}
        {nextCursor && !error && !loadMoreError && <button type="button" disabled={loadingMore} onClick={() => void load(nextCursor)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more'}</button>}
      </div>
    </DashboardLayout>
  )
}
