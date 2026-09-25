import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Sparkles } from 'lucide-react'
import { FindingCard, type BriefFinding } from './FindingCard'

interface BriefResponse {
  findings: BriefFinding[]
  totalOpen: number
  generatedAt: string | null
  retrievedAt?: string
  stale: boolean
  coverage: { complete: boolean; sourceTruncated: boolean; evidenceComplete: boolean; reason?: string | null }
  capabilities: { refresh: boolean; manage: boolean; feedback: boolean }
}

const EMPTY_CAPABILITIES = { refresh: false, manage: false, feedback: false }

export function IntelligenceBrief() {
  const [data, setData] = useState<BriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [message, setMessage] = useState('')
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const refreshInFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const mutationsInFlight = useRef(new Set<string>())
  const operationVersions = useRef(new Map<string, number>())
  const refetchAfterMutations = useRef(false)
  const focusAfterRender = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!focusAfterRender.current) return
    const target = cardRefs.current.get(focusAfterRender.current)
    if (target) {
      focusAfterRender.current = null
      target.focus()
    }
  }, [data?.findings])

  const load = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError(false)
    try {
      const response = await fetch('/api/intelligence/brief', { signal: controller.signal })
      if (!response.ok) throw new Error('brief unavailable')
      const next = (await response.json()) as BriefResponse
      if (!controller.signal.aborted) setData(next)
      return !controller.signal.aborted
    } catch (loadError) {
      if (!controller.signal.aborted && !(loadError instanceof DOMException && loadError.name === 'AbortError'))
        setError(true)
      return false
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => activeRequest.current?.abort()
  }, [load])

  const mutate = async (finding: BriefFinding, action: 'HELPFUL' | 'NOT_HELPFUL' | 'DISMISS' | 'RESOLVE') => {
    if (mutationsInFlight.current.has(finding.id)) return
    mutationsInFlight.current.add(finding.id)
    const version = (operationVersions.current.get(finding.id) ?? 0) + 1
    operationVersions.current.set(finding.id, version)
    const removes = action === 'DISMISS' || action === 'RESOLVE'
    const index = data?.findings.findIndex((item) => item.id === finding.id) ?? -1
    const nextId = index >= 0 ? data?.findings[index + 1]?.id : undefined
    setBusyIds((current) => new Set(current).add(finding.id))
    setMessage('')
    setData((current) =>
      current
        ? {
            ...current,
            findings: removes
              ? current.findings.filter((item) => item.id !== finding.id)
              : current.findings.map((item) => (item.id === finding.id ? { ...item, feedback: action } : item)),
            totalOpen: removes ? Math.max(0, current.totalOpen - 1) : current.totalOpen,
          }
        : current
    )
    try {
      const response = await fetch('/api/intelligence/findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: finding.id, action }),
      })
      if (!response.ok) throw new Error('mutation unavailable')
      await response.json()
      refetchAfterMutations.current = true
      setMessage(
        action === 'HELPFUL' || action === 'NOT_HELPFUL'
          ? 'Feedback saved.'
          : action === 'DISMISS'
            ? 'Finding dismissed.'
            : 'Finding resolved.'
      )
      if (removes)
        requestAnimationFrame(() => {
          const target = nextId
            ? cardRefs.current.get(nextId)
            : document.getElementById(
                (data?.totalOpen ?? 1) - 1 === 0 ? 'intelligence-brief-empty' : 'intelligence-brief-heading'
              )
          target?.focus()
        })
    } catch {
      focusAfterRender.current = finding.id
      if (operationVersions.current.get(finding.id) === version)
        setData((current) => {
          if (!current) return current
          const exists = current.findings.some((item) => item.id === finding.id)
          const nextFindings = exists
            ? current.findings.map((item) => (item.id === finding.id ? finding : item))
            : [...current.findings.slice(0, Math.max(0, index)), finding, ...current.findings.slice(Math.max(0, index))]
          return {
            ...current,
            findings: nextFindings,
            totalOpen: removes && !exists ? current.totalOpen + 1 : current.totalOpen,
          }
        })
      setMessage(`Could not ${action.toLowerCase().replace('_', ' ')}. The finding was restored; try again.`)
    } finally {
      mutationsInFlight.current.delete(finding.id)
      setBusyIds((current) => {
        const next = new Set(current)
        next.delete(finding.id)
        return next
      })
      if (mutationsInFlight.current.size === 0 && refetchAfterMutations.current) {
        refetchAfterMutations.current = false
        void load()
      }
    }
  }

  const refresh = async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setRefreshing(true)
    setMessage('')
    try {
      const response = await fetch('/api/intelligence/findings', { method: 'POST' })
      if (!response.ok) throw new Error('refresh unavailable')
      if (!(await load())) throw new Error('brief reload unavailable')
      setMessage('Fleet intelligence refreshed.')
    } catch {
      setMessage('Could not refresh fleet intelligence. Try again.')
    } finally {
      refreshInFlight.current = false
      setRefreshing(false)
    }
  }

  const capabilities = data?.capabilities || EMPTY_CAPABILITIES
  const generatedLabel =
    data?.generatedAt && Number.isFinite(new Date(data.generatedAt).getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(data.generatedAt)
        )
      : null
  return (
    <section
      aria-labelledby="intelligence-brief-heading"
      className="min-w-0 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/70 to-white p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Fleet intelligence
          </p>
          <h2 id="intelligence-brief-heading" tabIndex={-1} className="mt-1 text-xl font-bold text-slate-950">
            What needs attention today
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Prioritized from your workspace records. You stay in control of every action.
          </p>
        </div>
        {capabilities.refresh && (
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      <div aria-live="polite" aria-atomic="true" className="mt-2 min-h-5 text-sm text-slate-700">
        {message}
      </div>
      {loading && !data && (
        <div role="status" aria-label="Loading fleet intelligence brief" className="mt-4 space-y-3">
          <span className="sr-only">Loading fleet intelligence brief</span>
          {[0, 1].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {error && !data && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-900">Could not load the intelligence brief</p>
          <p className="mt-1 text-sm text-red-800">Your fleet data was not changed.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 min-h-11 rounded-lg px-3 text-sm font-medium text-red-900 underline"
          >
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          <p className="mt-1 text-xs text-slate-500">
            {generatedLabel ? `Brief generated ${generatedLabel}` : 'Brief generation time unavailable'}
          </p>
          {(data.stale || !data.coverage.complete) && (
            <div
              role="status"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              {data.stale ? 'This brief may be stale. Refresh it before making time-sensitive decisions.' : ''}
              {data.stale && !data.coverage.complete ? ' ' : ''}
              {!data.coverage.complete ? 'Coverage is incomplete, so additional issues may exist.' : ''}
            </div>
          )}
          {data.findings.length === 0 ? (
            <div
              id="intelligence-brief-empty"
              tabIndex={-1}
              className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-white p-6 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <p className="font-semibold text-slate-900">
                {data.coverage.reason === 'NEVER_GENERATED'
                  ? 'Generate fleet intelligence'
                  : 'Nothing needs attention right now'}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {data.coverage.reason === 'NEVER_GENERATED'
                  ? 'Refresh intelligence to analyze this workspace for the first time.'
                  : 'No current open findings were found in this workspace.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {data.findings.slice(0, 5).map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  canManage={capabilities.manage}
                  canFeedback={capabilities.feedback}
                  busy={busyIds.has(finding.id)}
                  cardRef={(node) => {
                    if (node) cardRefs.current.set(finding.id, node)
                    else cardRefs.current.delete(finding.id)
                  }}
                  onAction={(item, action) => void mutate(item, action)}
                />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">
              Showing {Math.min(data.findings.length, 5)} of {data.totalOpen} open findings
            </span>
            <Link
              href="/intelligence"
              className="inline-flex min-h-11 items-center px-2 font-medium text-emerald-800 underline"
            >
              View all {data.totalOpen} findings
            </Link>
          </div>
        </>
      )}
    </section>
  )
}

export default IntelligenceBrief
