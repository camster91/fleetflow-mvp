import { getVehicles, getDeliveries, getMaintenanceTasks, getClients, getSOPCategories, getVendingMachines } from '@/services/apiService'

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
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [row], total: 1, page: 1, limit: 100, hasMore: false }),
    } as Response)

    await expect(loader()).resolves.toEqual([row])
    expect(fetch).toHaveBeenCalledWith(url, expect.any(Object))
  })
})
