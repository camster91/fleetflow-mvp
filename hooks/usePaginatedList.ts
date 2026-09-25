import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import type { ListPage, ListParams } from '../services/apiService'

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25
export const SEARCH_DEBOUNCE_MS = 300

type QueryValue = string | string[] | undefined

const first = (value: QueryValue): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '')

export interface ListUrlState {
  page: number
  pageSize: number
  q: string
  sort: string
  order: '' | 'asc' | 'desc'
  filters: Record<string, string>
}

/**
 * Read list state from the URL query. Unknown or invalid values fall back to
 * defaults so a hand-edited link never breaks the page. While an `edit` deep
 * link is being consumed its extra keys (e.g. `status`) are edit-form prefills,
 * not list filters, so filters are ignored until that link is consumed.
 */
export function readListState(
  query: Record<string, QueryValue>,
  filterKeys: readonly string[],
  sortKeys: readonly string[] = [],
): ListUrlState {
  const page = Number.parseInt(first(query.page), 10)
  const pageSize = Number.parseInt(first(query.pageSize), 10)
  const sort = first(query.sort)
  const order = first(query.order)
  const editing = first(query.edit) !== ''
  const filters: Record<string, string> = {}
  if (!editing) {
    for (const key of filterKeys) {
      const value = first(query[key])
      if (value && value !== 'all') filters[key] = value
    }
  }
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    q: first(query.q).slice(0, 100),
    sort: sortKeys.includes(sort) ? sort : '',
    order: sortKeys.includes(sort) && (order === 'asc' || order === 'desc') ? order : '',
    filters,
  }
}

interface UsePaginatedListOptions<T, S> {
  fetchPage: (params: ListParams, signal: AbortSignal) => Promise<ListPage<T, S>>
  /** URL keys that are passed through to the API as filters. */
  filterKeys?: readonly string[]
  /** Allowed sort keys (must match the API allow-list). */
  sortKeys?: readonly string[]
  /** Extra API params that are not URL state (e.g. `summary`, `today`). */
  extraParams?: ListParams
  debounceMs?: number
}

export interface UsePaginatedListResult<T, S> {
  rows: T[]
  total: number
  summary: S | undefined
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refetch: (options?: { background?: boolean }) => Promise<void>
  page: number
  pageSize: number
  pageCount: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  /** Search box value (updates immediately); `q` is the debounced, applied value. */
  searchInput: string
  setSearchInput: (value: string) => void
  q: string
  filters: Record<string, string>
  setFilter: (key: string, value: string) => void
  sort: string
  order: '' | 'asc' | 'desc'
  setSort: (sort: string, order?: 'asc' | 'desc') => void
  /** Search/filter/sort params without paging, e.g. for a full CSV export. */
  queryParams: ListParams
  /** True when a search or filter narrows the list. */
  isFiltered: boolean
}

/**
 * Server-side paginated list state kept in the URL query string (`page`,
 * `pageSize`, `q`, `sort`, `order` and the filter keys) so links and the back
 * button restore the same view. Page and filter changes push a history entry;
 * search keystrokes are debounced and replace the current entry.
 */
export function usePaginatedList<T, S = undefined>({
  fetchPage,
  filterKeys = [],
  sortKeys = [],
  extraParams,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: UsePaginatedListOptions<T, S>): UsePaginatedListResult<T, S> {
  const router = useRouter()
  const filterKeyList = filterKeys.join(',')
  const sortKeyList = sortKeys.join(',')
  const state = useMemo(
    () => readListState(router.query, filterKeyList ? filterKeyList.split(',') : [], sortKeyList ? sortKeyList.split(',') : []),
    [router.query, filterKeyList, sortKeyList],
  )

  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<S | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const queryParams = useMemo<ListParams>(() => ({
    q: state.q.trim() || undefined,
    ...state.filters,
    sort: state.sort || undefined,
    order: state.order || undefined,
  }), [state])
  const extraKey = JSON.stringify(extraParams ?? {})
  const requestParams = useMemo<ListParams>(
    () => ({ ...queryParams, ...(JSON.parse(extraKey) as ListParams), page: state.page, limit: state.pageSize }),
    [queryParams, extraKey, state.page, state.pageSize],
  )
  const requestKey = JSON.stringify(requestParams)

  const fetchRef = useRef(fetchPage)
  useEffect(() => { fetchRef.current = fetchPage })
  const generationRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const paramsRef = useRef(requestParams)
  useEffect(() => { paramsRef.current = requestParams }, [requestParams])

  const refetch = useCallback(async (options?: { background?: boolean }) => {
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
      const result = await fetchRef.current(paramsRef.current, controller.signal)
      if (!isCurrent()) return
      setRows(result.data)
      setTotal(result.total)
      setSummary(result.summary)
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
    if (!router.isReady) return
    void refetch()
    return cancelActiveRequest
  }, [router.isReady, requestKey, refetch, cancelActiveRequest])

  const navigate = useCallback((changes: Record<string, string | number | null>, mode: 'push' | 'replace') => {
    const query: Record<string, QueryValue> = { ...router.query }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') delete query[key]
      else query[key] = String(value)
    }
    const go = mode === 'push' && router.push ? router.push : router.replace
    void Promise.resolve(go.call(router, { pathname: router.pathname, query }, undefined, { shallow: true })).catch(() => undefined)
  }, [router])

  const pageCount = Math.max(1, Math.ceil(total / state.pageSize))

  const setPage = useCallback((page: number) => {
    navigate({ page: page > 1 ? page : null }, 'push')
  }, [navigate])

  const setPageSize = useCallback((size: number) => {
    navigate({ pageSize: size === DEFAULT_PAGE_SIZE ? null : size, page: null }, 'push')
  }, [navigate])

  const setFilter = useCallback((key: string, value: string) => {
    navigate({ [key]: value === 'all' ? null : value, page: null }, 'push')
  }, [navigate])

  const setSort = useCallback((sort: string, order?: 'asc' | 'desc') => {
    navigate({ sort: sort || null, order: sort && order ? order : null, page: null }, 'push')
  }, [navigate])

  // Search input: local state for responsiveness, committed to the URL after a pause.
  const [searchInput, setSearchInputState] = useState(state.q)
  const committedQ = useRef(state.q)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    // External navigation (back/forward, a link) changed the applied search.
    if (state.q === committedQ.current) return
    committedQ.current = state.q
    clearTimeout(debounceRef.current)
    setSearchInputState(state.q)
  }, [state.q])
  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = value.trim().slice(0, 100)
      if (next === committedQ.current) return
      committedQ.current = next
      navigate({ q: next || null, page: null }, 'replace')
    }, debounceMs)
  }, [debounceMs, navigate])

  // A page past the end (e.g. after deleting the last row on the last page) moves to the last page.
  useEffect(() => {
    if (!loading && !error && rows.length === 0 && total > 0 && state.page > pageCount) {
      navigate({ page: pageCount > 1 ? pageCount : null }, 'replace')
    }
  }, [loading, error, rows.length, total, state.page, pageCount, navigate])

  return {
    rows, total, summary, loading, error, lastUpdated, refetch,
    page: state.page, pageSize: state.pageSize, pageCount,
    setPage, setPageSize,
    searchInput, setSearchInput, q: state.q,
    filters: state.filters, setFilter,
    sort: state.sort, order: state.order, setSort,
    queryParams,
    isFiltered: Boolean(state.q.trim()) || Object.keys(state.filters).length > 0,
  }
}
