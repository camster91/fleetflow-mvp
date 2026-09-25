import { useState, useEffect, useCallback, useRef } from 'react'

export interface RefetchOptions {
  /** Keep the current data on screen and skip the loading state (e.g. polling). */
  background?: boolean
}

interface UseDataFetchResult<T> {
  data: T
  loading: boolean
  error: string | null
  /** Time of the last successful load; failed refreshes leave it unchanged. */
  lastUpdated: Date | null
  refetch: (options?: RefetchOptions) => Promise<void>
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

export function useDataFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  initialData: T,
  deps: unknown[] = []
): UseDataFetchResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Callers pass inline fetchers, so keep the latest one in a ref and only
  // reload when the caller-supplied deps actually change.
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })
  const [trackedDeps, setTrackedDeps] = useState(deps)
  const [depsVersion, setDepsVersion] = useState(0)
  if (!sameDeps(trackedDeps, deps)) {
    setTrackedDeps(deps)
    setDepsVersion((version) => version + 1)
  }

  // Each request gets a generation number and an AbortController; only the
  // newest request may write state, so a slow earlier response can never
  // overwrite newer data, and nothing writes state after unmount.
  const generationRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  const refetch = useCallback(async (options?: RefetchOptions) => {
    const generation = ++generationRef.current
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const isCurrent = () => !controller.signal.aborted && generation === generationRef.current
    if (!options?.background) {
      setLoading(true)
      setError(null)
    }
    try {
      const result = await fetcherRef.current(controller.signal)
      if (!isCurrent()) return
      setData(result)
      setError(null)
      setLastUpdated(new Date())
    } catch (err: unknown) {
      if (!isCurrent()) return
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      if (isCurrent()) setLoading(false)
    }
  }, [])

  const cancelActiveRequest = useCallback(() => {
    generationRef.current++
    controllerRef.current?.abort()
  }, [])

  useEffect(() => {
    void refetch()
    return cancelActiveRequest
  }, [cancelActiveRequest, refetch, depsVersion])

  return { data, loading, error, lastUpdated, refetch }
}
