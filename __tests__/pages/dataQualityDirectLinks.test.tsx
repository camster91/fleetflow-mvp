import { render, screen, waitFor } from '@testing-library/react'

const mockReplace = jest.fn()
const mockRouter = { isReady: true, pathname: '/vehicles', query: {} as Record<string, string>, replace: mockReplace }

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/services/apiService', () => ({
  getVehicles: jest.fn(), getDeliveries: jest.fn(), getClients: jest.fn(),
  getMaintenanceTasks: jest.fn(), updateDelivery: jest.fn(), updateMaintenanceTask: jest.fn(),
  deleteVehicle: jest.fn(), deleteDelivery: jest.fn(), deleteMaintenanceTask: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({ notify: { success: jest.fn(), error: jest.fn() } }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }))
jest.mock('@/hooks/useDataFetch', () => ({ useDataFetch: jest.fn() }))
jest.mock('@/hooks/useFilteredData', () => ({
  useFilteredData: ({ data }: { data: unknown[] }) => ({
    filtered: data, searchQuery: '', setSearchQuery: jest.fn(), filters: {}, setFilter: jest.fn(),
  }),
}))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('@/components/PageHeader', () => ({ PageHeader: () => null }))
jest.mock('@/components/VehicleDetailModal', () => ({
  __esModule: true,
  default: ({ isOpen, vehicle }: { isOpen: boolean; vehicle?: { id: string } | null }) =>
    isOpen ? <div data-testid="vehicle-detail">{vehicle?.id}</div> : null,
}))
jest.mock('@/components/VehicleFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DeliveryFormModal', () => ({
  __esModule: true,
  default: ({ isOpen, delivery }: { isOpen: boolean; delivery?: { id: string } }) =>
    isOpen ? <div data-testid="delivery-edit">{delivery?.id}</div> : null,
}))
jest.mock('@/components/MaintenanceTaskDetailModal', () => ({
  __esModule: true,
  default: ({ isOpen, task }: { isOpen: boolean; task?: { id: string } | null }) =>
    isOpen ? <div data-testid="maintenance-detail">{task?.id}</div> : null,
}))
jest.mock('@/components/MaintenanceTaskFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/ConfirmModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DeliveryTimeline', () => ({ DeliveryTimeline: () => null }))

import { useDataFetch } from '@/hooks/useDataFetch'
import * as api from '@/services/apiService'
import VehiclesPage from '@/pages/vehicles'
import DeliveriesPage from '@/pages/deliveries'
import MaintenancePage from '@/pages/maintenance'
import toast from 'react-hot-toast'

const vehicle = (id: string) => ({
  id, name: `Vehicle ${id}`, status: 'active', driver: 'Driver', location: 'Depot',
  mileage: 10, maintenanceDue: false, fuelLevel: 80,
})
const delivery = (id: string) => ({
  id, customer: `Customer ${id}`, address: '1 Main St', status: 'pending', driver: 'Driver',
  progress: 0, items: 1, scheduledTime: new Date().toISOString(), estimatedArrival: null,
})
const task = (id: string) => ({
  id, vehicle: 'Vehicle', type: 'Oil change', dueDate: '2026-08-09',
  priority: 'medium', completed: false,
})

describe('data-quality direct record links', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRouter.query = {}
    mockRouter.pathname = '/vehicles'
    ;(api.getVehicles as jest.Mock).mockResolvedValue([])
    ;(api.getDeliveries as jest.Mock).mockResolvedValue([])
    ;(api.getClients as jest.Mock).mockResolvedValue([])
    ;(api.getMaintenanceTasks as jest.Mock).mockResolvedValue([])
    global.fetch = jest.fn()
  })

  it('opens the matching tenant-loaded vehicle detail and consumes the query', async () => {
    mockRouter.pathname = '/vehicles'
    mockRouter.query = { record: 'v-2' }
    ;(useDataFetch as jest.Mock).mockReturnValue({
      data: [vehicle('v-1'), vehicle('v-2')], loading: false, refetch: jest.fn(),
    })
    render(<VehiclesPage />)
    expect(await screen.findByTestId('vehicle-detail')).toHaveTextContent('v-2')
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/vehicles', query: {} }, undefined, { shallow: true })
  })

  it('opens the matching tenant-loaded delivery editor', async () => {
    mockRouter.pathname = '/deliveries'
    mockRouter.query = { record: 'd-2' }
    ;(useDataFetch as jest.Mock).mockReturnValue({
      data: { deliveries: [delivery('d-1')], vehicles: [], clients: [] },
      loading: false, refetch: jest.fn(),
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => delivery('d-2') })
    render(<DeliveriesPage />)
    expect(await screen.findByTestId('delivery-edit')).toHaveTextContent('d-2')
    expect(global.fetch).toHaveBeenCalledWith('/api/deliveries/d-2', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('opens the matching tenant-loaded maintenance detail', async () => {
    mockRouter.pathname = '/maintenance'
    mockRouter.query = { record: 'm-2' }
    ;(api.getMaintenanceTasks as jest.Mock).mockResolvedValue([task('m-1')])
    ;(api.getVehicles as jest.Mock).mockResolvedValue([])
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => task('m-2') })
    render(<MaintenancePage />)
    expect(await screen.findByTestId('maintenance-detail')).toHaveTextContent('m-2')
    expect(global.fetch).toHaveBeenCalledWith('/api/maintenance/m-2', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it.each([403, 404])('does not open an unavailable record after a %s response and then consumes the query', async (status) => {
    mockRouter.pathname = '/vehicles'
    mockRouter.query = { record: 'other-tenant' }
    ;(useDataFetch as jest.Mock).mockReturnValue({
      data: [vehicle('v-1')], loading: false, refetch: jest.fn(),
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status, json: async () => ({ error: 'hidden' }) })
    render(<VehiclesPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(screen.queryByTestId('vehicle-detail')).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('This record is unavailable or you no longer have access.')
  })

  it('waits for a deep-link lookup before consuming the query', async () => {
    mockRouter.pathname = '/deliveries'
    mockRouter.query = { record: 'd-2' }
    ;(useDataFetch as jest.Mock).mockReturnValue({
      data: { deliveries: [delivery('d-1')], vehicles: [], clients: [] },
      loading: false, refetch: jest.fn(),
    })
    let resolveLookup!: (value: unknown) => void
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
    render(<DeliveriesPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalled()

    resolveLookup({ ok: true, json: async () => delivery('d-2') })
    expect(await screen.findByTestId('delivery-edit')).toHaveTextContent('d-2')
    expect(mockReplace).toHaveBeenCalled()
  })

  it('handles a rejected shallow URL cleanup without losing the opened record', async () => {
    mockRouter.pathname = '/vehicles'
    mockRouter.query = { record: 'v-2' }
    mockReplace.mockRejectedValueOnce(new Error('navigation interrupted'))
    ;(useDataFetch as jest.Mock).mockReturnValue({
      data: [vehicle('v-2')], loading: false, refetch: jest.fn(),
    })
    render(<VehiclesPage />)
    expect(await screen.findByTestId('vehicle-detail')).toHaveTextContent('v-2')
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  })

  it('retries an aborted lookup when the paged list refreshes during resolution', async () => {
    mockRouter.pathname = '/deliveries'
    mockRouter.query = { record: 'd-2' }
    let currentData = {
      data: { deliveries: [delivery('d-1')], vehicles: [], clients: [] },
      loading: false, refetch: jest.fn(),
    }
    ;(useDataFetch as jest.Mock).mockImplementation(() => currentData)
    let firstSignal: AbortSignal | undefined
    ;(global.fetch as jest.Mock)
      .mockImplementationOnce((_url, init) => {
        firstSignal = (init as RequestInit).signal as AbortSignal
        return new Promise(() => undefined)
      })
      .mockResolvedValueOnce({ ok: true, json: async () => delivery('d-2') })

    const { rerender } = render(<DeliveriesPage />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    currentData = {
      ...currentData,
      data: { ...currentData.data, deliveries: [delivery('d-1'), delivery('d-3')] },
    }
    rerender(<DeliveriesPage />)

    expect(await screen.findByTestId('delivery-edit')).toHaveTextContent('d-2')
    expect(firstSignal?.aborted).toBe(true)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
