import { act, renderHook, waitFor } from '@testing-library/react'

type Query = Record<string, string | string[] | undefined>
const mockRouter = {
  isReady: true,
  pathname: '/vehicles',
  query: {} as Query,
  push: jest.fn(),
  replace: jest.fn(),
}
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))

import { readListState, usePaginatedList } from '@/hooks/usePaginatedList'

const page = (rows: Array<{ id: string }>, total = rows.length, summary?: unknown) =>
  ({ data: rows, total, page: 1, limit: 25, hasMore: false, summary })

// Navigations update the mocked URL; the test re-renders to simulate Next's router event.
function navigateTo(url: { query: Query }) {
  mockRouter.query = url.query
  return Promise.resolve(true)
}

beforeEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  mockRouter.isReady = true
  mockRouter.query = {}
  mockRouter.push.mockImplementation(navigateTo)
  mockRouter.replace.mockImplementation(navigateTo)
})

describe('readListState', () => {
  it('reads valid URL state and falls back to defaults', () => {
    expect(readListState({}, ['status'])).toEqual({ page: 1, pageSize: 25, q: '', sort: '', order: '', filters: {} })
    expect(readListState({ page: '3', pageSize: '50', q: 'van', status: 'delayed', sort: 'name', order: 'desc' }, ['status'], ['name']))
      .toEqual({ page: 3, pageSize: 50, q: 'van', sort: 'name', order: 'desc', filters: { status: 'delayed' } })
    expect(readListState({ page: '-2', pageSize: '1000', sort: 'ownerId', order: 'desc', status: 'all' }, ['status'], ['name']))
      .toEqual({ page: 1, pageSize: 25, q: '', sort: '', order: '', filters: {} })
    expect(readListState({ page: ['2', '4'], q: ['a', 'b'] }, [])).toMatchObject({ page: 2, q: 'a' })
  })

  it('treats filter keys on an edit deep link as form prefills, not list filters', () => {
    expect(readListState({ edit: 'd1', status: 'delivered' }, ['status']).filters).toEqual({})
    expect(readListState({ record: 'd1', status: 'delivered' }, ['status']).filters).toEqual({ status: 'delivered' })
  })
})

describe('usePaginatedList', () => {
  const setup = (fetchPage = jest.fn().mockResolvedValue(page([{ id: 'a' }], 1, { total: 7 }))) => {
    const hook = renderHook(() => usePaginatedList<{ id: string }, { total: number }>({
      fetchPage, filterKeys: ['status'], sortKeys: ['name'], extraParams: { summary: 1 }, debounceMs: 200,
    }))
    return { ...hook, fetchPage }
  }

  it('fetches the page described by the URL and exposes rows, total and summary', async () => {
    mockRouter.query = { page: '2', pageSize: '50', q: 'van', status: 'delayed', sort: 'name', order: 'asc' }
    const { result, fetchPage } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenCalledWith(
      { q: 'van', status: 'delayed', sort: 'name', order: 'asc', summary: 1, page: 2, limit: 50 },
      expect.any(AbortSignal),
    )
    expect(result.current).toMatchObject({ rows: [{ id: 'a' }], total: 1, summary: { total: 7 }, page: 2, pageSize: 50, isFiltered: true })
    expect(result.current.queryParams).toEqual({ q: 'van', status: 'delayed', sort: 'name', order: 'asc' })
  })

  it('waits for the router to be ready before fetching', async () => {
    mockRouter.isReady = false
    const { result, fetchPage, rerender } = setup()
    expect(fetchPage).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(true)
    mockRouter.isReady = true
    rerender()
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1))
  })

  it('pushes page, page-size, filter and sort changes to the URL and resets to page 1 on filter changes', async () => {
    mockRouter.query = { page: '3', record: 'keep-me' }
    const { result } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setPage(4))
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/vehicles', query: { page: '4', record: 'keep-me' } }, undefined, { shallow: true })

    act(() => result.current.setFilter('status', 'active'))
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/vehicles', query: { status: 'active', record: 'keep-me' } }, undefined, { shallow: true })

    act(() => result.current.setFilter('status', 'all'))
    expect(mockRouter.push.mock.calls.at(-1)[0].query).not.toHaveProperty('status')

    act(() => result.current.setPageSize(100))
    expect(mockRouter.push.mock.calls.at(-1)[0].query).toMatchObject({ pageSize: '100' })
    act(() => result.current.setPageSize(25))
    expect(mockRouter.push.mock.calls.at(-1)[0].query).not.toHaveProperty('pageSize')

    act(() => result.current.setSort('name', 'desc'))
    expect(mockRouter.push.mock.calls.at(-1)[0].query).toMatchObject({ sort: 'name', order: 'desc' })
    act(() => result.current.setSort(''))
    expect(mockRouter.push.mock.calls.at(-1)[0].query).not.toHaveProperty('sort')
  })

  it('refetches when the URL changes (e.g. the back button)', async () => {
    const { result, fetchPage, rerender } = setup()
    await waitFor(() => expect(result.current.loading).toBe(false))
    mockRouter.query = { page: '2' }
    rerender()
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)))
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('debounces search input into a single URL replace and resets the page', async () => {
    jest.useFakeTimers()
    mockRouter.query = { page: '3' }
    const { result, rerender } = setup()
    act(() => { result.current.setSearchInput('v') })
    act(() => { result.current.setSearchInput('va') })
    act(() => { result.current.setSearchInput('van ') })
    expect(result.current.searchInput).toBe('van ')
    expect(mockRouter.replace).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(200) })
    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/vehicles', query: { q: 'van' } }, undefined, { shallow: true })
    rerender()
    expect(result.current.q).toBe('van')
    // The committed value does not clobber what the user is still typing.
    expect(result.current.searchInput).toBe('van ')
    jest.useRealTimers()
  })

  it('syncs the search box when navigation changes the applied search', async () => {
    mockRouter.query = { q: 'van' }
    const { result, rerender } = setup()
    expect(result.current.searchInput).toBe('van')
    mockRouter.query = {}
    rerender()
    await waitFor(() => expect(result.current.searchInput).toBe(''))
  })

  it('moves to the last page when the requested page is past the end', async () => {
    mockRouter.query = { page: '5' }
    const fetchPage = jest.fn().mockResolvedValue(page([], 30))
    setup(fetchPage)
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/vehicles', query: { page: '2' } }, undefined, { shallow: true }))
  })

  it('reports errors, keeps only the newest response and supports background refetch', async () => {
    let resolveFirst!: (value: unknown) => void
    const fetchPage = jest.fn()
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(page([{ id: 'new' }]))
      .mockRejectedValueOnce(new Error('You do not have permission to do that'))
    const { result, rerender } = setup(fetchPage)
    mockRouter.query = { page: '2' }
    rerender()
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'new' }]))
    resolveFirst(page([{ id: 'stale' }]))
    await act(async () => { await Promise.resolve() })
    expect(result.current.rows).toEqual([{ id: 'new' }])
    expect(fetchPage.mock.calls[0][1].aborted).toBe(true)

    await act(async () => { await result.current.refetch({ background: true }) })
    expect(result.current.error).toBe('You do not have permission to do that')
    expect(result.current.rows).toEqual([{ id: 'new' }])
  })
})
