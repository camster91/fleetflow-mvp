import { getVehicles, getDeliveries, getMaintenanceTasks, getClients, getSOPCategories, getVendingMachines, COLLECTION_MAX_PAGES } from '@/services/apiService'

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
