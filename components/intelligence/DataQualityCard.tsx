import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronRight, Database, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { DataQualityIssue, DataQualitySeverity } from '@/lib/intelligence/dataQuality'

interface DataQualityResponse {
  issues: DataQualityIssue[]
  summary: {
    total: number
    bySeverity: Partial<Record<DataQualitySeverity, number>>
    countsComplete: boolean
  }
  coverage: {
    complete: boolean
    sourceTruncated: boolean
    issuesTruncated: boolean
  }
  generatedAt: string
}

const severityPresentation: Record<DataQualitySeverity, { label: string; badge: string; border: string }> = {
  high: { label: 'High priority', badge: 'bg-red-100 text-red-800', border: 'border-l-red-500' },
  medium: { label: 'Medium priority', badge: 'bg-amber-100 text-amber-900', border: 'border-l-amber-500' },
  low: { label: 'Low priority', badge: 'bg-blue-100 text-blue-800', border: 'border-l-blue-500' },
}

function entityLabel(entityType: DataQualityIssue['entityType']): string {
  return entityType.charAt(0).toUpperCase() + entityType.slice(1)
}

export function DataQualityCard() {
  const [data, setData] = useState<DataQualityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const activeRequest = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setFailed(false)
    try {
      const response = await fetch('/api/intelligence/data-quality', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Request failed')
      const next = (await response.json()) as DataQualityResponse
      if (!next || !Array.isArray(next.issues) || !next.summary || !next.coverage) {
        throw new Error('Invalid response')
      }
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setData(next)
    } catch (error) {
      if (
        controller.signal.aborted ||
        activeRequest.current !== controller ||
        (error instanceof Error && error.name === 'AbortError')
      )
        return
      setFailed(true)
      setData(null)
    } finally {
      if (!controller.signal.aborted && activeRequest.current === controller) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => activeRequest.current?.abort()
  }, [load])

  const coverageMessage =
    data && (data.coverage.sourceTruncated || data.coverage.issuesTruncated)
      ? `${
          data.coverage.sourceTruncated && data.coverage.issuesTruncated
            ? 'Partial scan: workspace scan and issue list are limited.'
            : data.coverage.sourceTruncated
              ? 'Partial scan: workspace scan is incomplete.'
              : 'Partial results: issue list is limited.'
        } ${data.summary.countsComplete ? 'Counts include all scanned records.' : 'Counts may be incomplete.'}`
      : null

  return (
    <Card className="border-slate-200" aria-labelledby="data-quality-title">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-700" aria-hidden="true">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 id="data-quality-title" className="text-lg font-semibold text-slate-900">
              Data quality
            </h3>
            <p className="mt-1 text-sm text-slate-500">Fix unreliable records before using fleet recommendations.</p>
          </div>
        </div>
        {!loading && (
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Check data quality again"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <div role="status" aria-label="Checking fleet data quality" className="space-y-3" aria-live="polite">
          <span className="sr-only">Checking fleet data quality</span>
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
          ))}
        </div>
      )}

      {!loading && failed && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Could not check data quality</p>
              <p className="mt-1 text-sm">Try again. Your fleet records were not changed.</p>
            </div>
          </div>
        </div>
      )}

      {!loading && data && coverageMessage && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {coverageMessage}
        </div>
      )}

      {!loading && data && data.issues.length === 0 && data.coverage.complete && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" />
          <p className="mt-2 font-semibold text-emerald-900">Fleet data is ready</p>
          <p className="mt-1 text-sm text-emerald-800">No issues were found by the current deterministic checks.</p>
        </div>
      )}

      {!loading && data && data.issues.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600" aria-label="Issue counts">
            <span>
              {data.summary.total} {data.summary.total === 1 ? 'issue' : 'issues'} found
            </span>
            {(data.summary.bySeverity.high || 0) > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">
                {data.summary.bySeverity.high} high
              </span>
            )}
          </div>
          <ul className="space-y-3">
            {data.issues.slice(0, 5).map((item) => {
              const style = severityPresentation[item.severity]
              return (
                <li key={item.id} className={`rounded-lg border border-slate-200 border-l-4 ${style.border}`}>
                  <a
                    href={item.actionUrl}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-lg p-3 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                    aria-label={`Fix ${item.entityType} record: ${item.message}`}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {entityLabel(item.entityType)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-slate-800">{item.message}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                  </a>
                </li>
              )
            })}
          </ul>
          {data.issues.length > 5 && (
            <p className="mt-3 text-sm text-slate-500">
              Showing 5 of {data.issues.length} returned issues, ordered by priority.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

export default DataQualityCard
