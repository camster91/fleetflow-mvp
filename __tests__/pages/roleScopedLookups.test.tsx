import { fireEvent, render, screen, waitFor } from '@testing-library/react'

// Roles may read their primary list without being allowed to read the lookup
// lists that only feed form pickers (drivers cannot list clients; technicians
// cannot list vehicles). A forbidden lookup must not hide the primary list.
const mockRouter = { isReady: true, pathname: '/deliveries', query: {} as Record<string, string>, replace: jest.fn() }

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/services/apiService', () => ({
  getVehicles: jest.fn(),
  getDeliveryPage: jest.fn(),
  getClients: jest.fn(),
  getMaintenancePage: jest.fn(),
  getMaintenanceTasksDue: jest.fn().mockResolvedValue([]),
  updateDelivery: jest.fn(),
  updateMaintenanceTask: jest.fn(),
  deleteDelivery: jest.fn(),
  deleteMaintenanceTask: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({ notify: { success: jest.fn(), error: jest.fn() } }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }))
jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/PageHeader', () => ({
  PageHeader: ({ actions }: { actions?: React.ReactNode }) => <div>{actions}</div>,
}))
jest.mock('@/components/DeliveryFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MaintenanceTaskDetailModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MaintenanceTaskFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DeliveryTimeline', () => ({ DeliveryTimeline: () => null }))

import * as api from '@/services/apiService'
import DeliveriesPage from '@/pages/deliveries'
import MaintenancePage from '@/pages/maintenance'
import toast from 'react-hot-toast'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'

const forbidden = () => Promise.reject(new Error('You do not have permission to do that'))
const page = <T,>(data: T[]) => ({ data, total: data.length, page: 1, limit: 25, hasMore: false })

describe('role-scoped lookup lists', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('shows a driver their deliveries when clients and vehicles are forbidden', async () => {
    ;(api.getDeliveryPage as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'd-1',
          customer: 'Assigned Customer',
          address: '1 Example St',
          status: 'pending',
          driver: 'Driver',
          progress: 0,
          items: 1,
          scheduledTime: null,
          estimatedArrival: null,
        },
      ])
    )
    ;(api.getVehicles as jest.Mock).mockImplementation(forbidden)
    ;(api.getClients as jest.Mock).mockImplementation(forbidden)

    render(
      <ConfirmDialogProvider>
        <DeliveriesPage />
      </ConfirmDialogProvider>
    )

    expect((await screen.findAllByText('Assigned Customer')).length).toBeGreaterThan(0)
    expect(screen.queryByText('You do not have permission to do that')).not.toBeInTheDocument()
  })

  it('still reports a forbidden delivery list', async () => {
    ;(api.getDeliveryPage as jest.Mock).mockImplementation(forbidden)
    ;(api.getVehicles as jest.Mock).mockResolvedValue([])
    ;(api.getClients as jest.Mock).mockResolvedValue([])

    render(
      <ConfirmDialogProvider>
        <DeliveriesPage />
      </ConfirmDialogProvider>
    )

    expect(await screen.findByText('You do not have permission to do that')).toBeInTheDocument()
  })

  it('shows a technician maintenance work when vehicles are forbidden', async () => {
    ;(api.getMaintenancePage as jest.Mock).mockResolvedValue(
      page([
        {
          id: 'm-1',
          vehicle: 'Van',
          type: 'Brake inspection',
          dueDate: '2030-01-15',
          priority: 'high',
          completed: false,
        },
      ])
    )
    ;(api.getVehicles as jest.Mock).mockImplementation(forbidden)

    render(
      <ConfirmDialogProvider>
        <MaintenancePage />
      </ConfirmDialogProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'List' }))

    expect(await screen.findByText('Brake inspection')).toBeInTheDocument()
    await waitFor(() => expect(toast.error).not.toHaveBeenCalled())
  })
})
