import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

interface UseFilteredDataOptions<T> {
  data: T[]
  searchFields: (keyof T)[]
  filterFn?: (item: T, filters: Record<string, string>) => boolean
  debounceMs?: number
}

interface UseFilteredDataResult<T> {
  filtered: T[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
}

export function useFilteredData<T>({
  data,
  searchFields,
  filterFn,
  debounceMs = 200,
}: UseFilteredDataOptions<T>): UseFilteredDataResult<T> {
  const [searchQuery, setSearchQueryRaw] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const setSearchQuery = useCallback(
    (q: string) => {
      setSearchQueryRaw(q)
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => setDebouncedQuery(q), debounceMs)
    },
    [debounceMs]
  )

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const filtered = useMemo(() => {
    return data.filter((item) => {
      // Search across specified fields
      if (debouncedQuery) {
        const q = debouncedQuery.toLowerCase()
        const matchesSearch = searchFields.some((field) => {
          const val = item[field]
          return typeof val === 'string' && val.toLowerCase().includes(q)
        })
        if (!matchesSearch) return false
      }
      // Apply custom filter function
      if (filterFn && !filterFn(item, filters)) return false
      return true
    })
  }, [data, debouncedQuery, searchFields, filterFn, filters])

  return { filtered, searchQuery, setSearchQuery, filters, setFilter }
}
