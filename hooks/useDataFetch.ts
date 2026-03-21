import { useState, useEffect, useCallback } from 'react'

interface UseDataFetchResult<T> {
  data: T
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  initialData: T,
  deps: unknown[] = []
): UseDataFetchResult<T> {
  const [data, setData] = useState<T>(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
