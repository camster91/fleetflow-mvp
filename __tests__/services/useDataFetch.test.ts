import { renderHook, act, waitFor } from '@testing-library/react'
import { useDataFetch } from '@/hooks/useDataFetch'

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void }
const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useDataFetch', () => {
  it('does not let an out-of-order earlier response overwrite newer data', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const fetcher = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useDataFetch(fetcher, 'initial', []))
    let refetching: Promise<void> | undefined
    act(() => {
      refetching = result.current.refetch()
    })

    await act(async () => {
      second.resolve('newer')
      await refetching
    })
    expect(result.current.data).toBe('newer')
    expect(result.current.loading).toBe(false)

    await act(async () => {
      first.resolve('stale')
      await first.promise
    })
    expect(result.current.data).toBe('newer')
    expect(fetcher.mock.calls[0][0].aborted).toBe(true)
  })

  it('reloads when deps change and ignores the superseded request', async () => {
    const slow = deferred<string>()
    const calls: string[] = []
    const { result, rerender } = renderHook(
      ({ id }) =>
        useDataFetch(
          () => {
            calls.push(id)
            return id === 'a' ? slow.promise : Promise.resolve(`value-${id}`)
          },
          'initial',
          [id]
        ),
      { initialProps: { id: 'a' } }
    )

    rerender({ id: 'b' })
    await waitFor(() => expect(result.current.data).toBe('value-b'))
    await act(async () => {
      slow.resolve('value-a')
      await slow.promise
    })
    expect(result.current.data).toBe('value-b')
    expect(calls).toEqual(['a', 'b'])
  })

  it('keeps data and loading state during a failed background refresh', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(['row']).mockRejectedValueOnce(new Error('offline'))
    const { result } = renderHook(() => useDataFetch(fetcher, [] as string[], []))
    await waitFor(() => expect(result.current.data).toEqual(['row']))
    const lastUpdated = result.current.lastUpdated
    expect(lastUpdated).toBeInstanceOf(Date)

    const loadingStates: boolean[] = []
    await act(async () => {
      const pending = result.current.refetch({ background: true })
      loadingStates.push(result.current.loading)
      await pending
    })
    expect(loadingStates).toEqual([false])
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual(['row'])
    expect(result.current.error).toBe('offline')
    expect(result.current.lastUpdated).toBe(lastUpdated)
  })

  it('does not update state after unmount', async () => {
    const pending = deferred<string>()
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { result, unmount } = renderHook(() => useDataFetch(() => pending.promise, 'initial', []))
    unmount()
    await act(async () => {
      pending.resolve('late')
      await pending.promise
    })
    expect(result.current.data).toBe('initial')
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
