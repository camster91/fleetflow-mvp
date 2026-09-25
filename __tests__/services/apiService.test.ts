import { getVehicles, getDeliveries, getMaintenanceTasks, getClients, getSOPCategories, getVendingMachines, COLLECTION_MAX_PAGES, addVehicle, addDelivery, addMaintenanceTask, addClient, CREATE_NETWORK_RETRIES } from '@/services/apiService'

const page = (data: unknown[], hasMore: boolean) => ({ ok: true, json: async () => ({ data, total: 0, page: 1, limit: 200, hasMore }) }) as Response

describe('API collection response contracts', () => {
  beforeEach(() => jest.restoreAllMocks())

  it.each([
    ['/api/vehicles', getVehicles],
    ['/api/deliveries', getDeliveries],
    ['/api/maintenance', getMaintenanceTasks],
    ['/api/clients', getClients],
    ['/api/sop', getSOPCategories],
    ['/api/vending-machines', getVendingMachines],
  ])('unwraps the paginated collection returned by %s', async (url, loader) => {
    const row = { id: 'row-1' }
    jest.spyOn(global, 'fetch').mockResolvedValue(page([row], false))

    await expect(loader()).resolves.toEqual([row])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(`${url}?page=1&limit=200`, expect.any(Object))
  })

  it('follows hasMore across pages so lists are not truncated at the first page', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({ id: `vehicle-${i}` }))
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(page(rows.slice(0, 200), true))
      .mockResolvedValueOnce(page(rows.slice(200, 400), true))
      .mockResolvedValueOnce(page(rows.slice(400), false))

    await expect(getVehicles()).resolves.toEqual(rows)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/vehicles?page=2&limit=200', expect.any(Object))
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/vehicles?page=3&limit=200', expect.any(Object))
  })

  it('stops at the safety cap if the server keeps reporting hasMore', async () => {
    let n = 0
    jest.spyOn(global, 'fetch').mockImplementation(async () => page([{ id: `row-${n++}` }], true))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(getClients()).resolves.toHaveLength(COLLECTION_MAX_PAGES)
    expect(fetch).toHaveBeenCalledTimes(COLLECTION_MAX_PAGES)
    expect(warn).toHaveBeenCalled()
  })

  it('drops rows repeated across page boundaries by concurrent inserts', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(page([{ id: 'a' }, { id: 'b' }], true))
      .mockResolvedValueOnce(page([{ id: 'b' }, { id: 'c' }], false))
    await expect(getDeliveries()).resolves.toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('stops paging when a page is empty even if hasMore is set', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(page([], true))
    await expect(getDeliveries()).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('propagates an error from a later page instead of returning a partial list', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(page([{ id: 'a' }], true))
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'err', json: async () => ({}) } as Response)
    await expect(getVehicles()).rejects.toThrow('Something went wrong')
  })
})

describe('idempotent create requests', () => {
  const created = { ok: true, json: async () => ({ id: 'new-1' }) } as Response
  const keyOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>)['Idempotency-Key']

  beforeEach(() => jest.restoreAllMocks())

  it.each([
    ['/api/vehicles', () => addVehicle({ name: 'Van' } as never)],
    ['/api/deliveries', () => addDelivery({ customer: 'Acme' } as never)],
    ['/api/maintenance', () => addMaintenanceTask({ title: 'Oil' } as never)],
    ['/api/clients', () => addClient({ name: 'Acme' } as never)],
  ])('sends a valid Idempotency-Key on POST %s', async (url, submit) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(created)
    await expect(submit()).resolves.toEqual({ id: 'new-1' })
    const call = (fetch as jest.Mock).mock.calls[0]
    expect(call[0]).toBe(url)
    expect((call[1] as RequestInit).method).toBe('POST')
    expect(keyOf(call)).toMatch(/^[A-Za-z0-9_-]{8,128}$/)
  })

  it('reuses the key when retrying a network failure of the same submit', async () => {
    jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(created)
    await expect(addClient({ name: 'Acme' } as never)).resolves.toEqual({ id: 'new-1' })
    const calls = (fetch as jest.Mock).mock.calls
    expect(calls).toHaveLength(2)
    expect(keyOf(calls[1])).toBe(keyOf(calls[0]))
  })

  it('gives up after the retry budget and does not retry HTTP errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(addClient({ name: 'Acme' } as never)).rejects.toThrow('Failed to fetch')
    expect(fetch).toHaveBeenCalledTimes(CREATE_NETWORK_RETRIES + 1)

    ;(fetch as jest.Mock).mockReset().mockResolvedValue({ ok: false, status: 500, statusText: 'err', json: async () => ({}) } as Response)
    await expect(addClient({ name: 'Acme' } as never)).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uses a new key for each separate submit', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(created)
    await addClient({ name: 'Acme' } as never)
    await addClient({ name: 'Acme' } as never)
    const calls = (fetch as jest.Mock).mock.calls
    expect(keyOf(calls[0])).not.toBe(keyOf(calls[1]))
  })
})
