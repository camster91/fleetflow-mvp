import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'

interface UseRecordQueryOptions<T extends { id: string }> {
  records: T[]
  loading: boolean
  onMatch: (record: T) => void
  resource: 'vehicles' | 'deliveries' | 'maintenance'
  onUnavailable: () => void
}

/**
 * Consume a data-quality `?record=` link only after tenant-scoped page data is
 * loaded. Records beyond the first list page are resolved through the existing
 * authenticated, tenant-authorized detail route and the returned ID must match.
 * Other query parameters are preserved.
 */
export function useRecordQuery<T extends { id: string }>({
  records,
  loading,
  onMatch,
  resource,
  onUnavailable,
}: UseRecordQueryOptions<T>): void {
  const router = useRouter()
  const processed = useRef<string | null>(null)
  const inFlight = useRef<string | null>(null)
  const onMatchRef = useRef(onMatch)
  const onUnavailableRef = useRef(onUnavailable)

  useEffect(() => {
    onMatchRef.current = onMatch
    onUnavailableRef.current = onUnavailable
  }, [onMatch, onUnavailable])

  const raw = router.query.record
  const recordId = Array.isArray(raw) ? raw[0] : raw

  useEffect(() => {
    if (!router.isReady || loading) return
    if (!recordId) {
      processed.current = null
      inFlight.current = null
      return
    }
    if (processed.current === recordId || inFlight.current === recordId) return
    inFlight.current = recordId
    const controller = new AbortController()

    const consumeQuery = async () => {
      const { record: _record, ...remainingQuery } = router.query
      try {
        await router.replace(
          { pathname: router.pathname, query: remainingQuery },
          undefined,
          { shallow: true },
        )
      } catch {
        // The record is already resolved; interrupted shallow navigation must
        // not close it or create an unhandled rejection.
      }
    }

    const resolveRecord = async () => {
      const local = records.find((record) => record.id === recordId)
      if (local) {
        processed.current = recordId
        inFlight.current = null
        onMatchRef.current(local)
        await consumeQuery()
        return
      }

      try {
        const response = await fetch(`/api/${resource}/${encodeURIComponent(recordId)}`, {
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (response.ok) {
          const candidate: unknown = await response.json()
          if (controller.signal.aborted) return
          processed.current = recordId
          inFlight.current = null
          if (
            candidate && typeof candidate === 'object' &&
            (candidate as { id?: unknown }).id === recordId
          ) {
            onMatchRef.current(candidate as T)
          } else {
            onUnavailableRef.current()
          }
        } else {
          processed.current = recordId
          inFlight.current = null
          onUnavailableRef.current()
        }
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return
        processed.current = recordId
        inFlight.current = null
        onUnavailableRef.current()
      }

      if (!controller.signal.aborted) await consumeQuery()
    }

    void resolveRecord()
    return () => {
      controller.abort()
      if (inFlight.current === recordId) inFlight.current = null
    }
  }, [loading, recordId, records, resource, router])
}
