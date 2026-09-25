import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'

// List pages page, search, filter and sort on the server (#163) with the
// state in the URL; stat cards come from the whole-scope summary.
type Query = Record<string, string | string[] | undefined>
const mockRouter = { isReady: true, pathname: '/vehicles', query: {} as Query, push: jest.fn(), replace: jest.fn() }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
let mockRoleState: { role: string | null; loading: boolean } = { role: 'MANAGER', loading: false }
jest.mock('@/hooks/useWorkspaceRole', () => ({ useWorkspaceRole: () => mockRoleState }))
jest.mock('@/services/apiService', () => ({
  getVehiclePage: jest.fn(), getDeliveryPage: jest.fn(), getClientPage: jest.fn(), getMaintenancePage: jest.fn(),
  getMaintenanceTasksDue: jest.fn(), getVehicles: jest.fn(), getClients: jest.fn(), getAllMatching: jest.fn(),
  deleteVehicle: jest.fn(), deleteDelivery: jest.fn(), updateDelivery: jest.fn(), updateMaintenanceTask: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({ notify: { success: jest.fn(), error: jest.fn() } }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
jest.mock('@/components/PageHeader', () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }))
jest.mock('@/components/VehicleFormModal', () => ({
  __esModule: true,
  default: ({ isOpen, vehicle }: { isOpen: boolean; vehicle?: { id: string } | null }) =>
    isOpen ? <div data-testid="vehicle-edit">{vehicle?.id}</div> : null,
}))
jest.mock('@/components/VehicleDetailModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="vehicle-detail" /> : null),
}))
jest.mock('@/components/DeliveryFormModal', () => ({
  __esModule: true,
  default: ({ isOpen, delivery }: { isOpen: boolean; delivery?: { id: string; status: string } }) =>
    isOpen ? <div data-testid="delivery-edit">{delivery?.id}:{delivery?.status}</div> : null,
}))
jest.mock('@/components/DeliveryTimeline', () => ({ DeliveryTimeline: () => null }))
jest.mock('@/components/ClientFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MaintenanceTaskFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MaintenanceTaskDetailModal', () => ({ __esModule: true, default: () => null }))

import * as api from '@/services/apiService'
import VehiclesPage from '@/pages/vehicles'
import DeliveriesPage from '@/pages/deliveries'
import ClientsPage from '@/pages/clients'
import MaintenancePage from '@/pages/maintenance'

const vehicles = Array.from({ length: 25 }, (_, i) => ({
  id: `v${i + 1}`, name: `Van ${i + 1}`, status: 'active', driver: 'Pat', location: 'Depot', mileage: 100, maintenanceDue: false, eta: '',
}))
const delivery = { id: 'd1', customer: 'North Shop', address: '1 Road', status: 'pending', driver: 'Pat', items: 1, progress: 0, scheduledTime: null, estimatedArrival: null }

const renderPage = (Page: React.ComponentType) => render(<ConfirmDialogProvider><Page /></ConfirmDialogProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  mockRoleState = { role: 'MANAGER', loading: false }
  mockRouter.query = {}
  mockRouter.pathname = '/vehicles'
  mockRouter.push.mockResolvedValue(true)
  mockRouter.replace.mockResolvedValue(true)
  ;(api.getVehiclePage as jest.Mock).mockResolvedValue({
    data: vehicles, total: 312, page: 1, limit: 25, hasMore: true,
    summary: { total: 312, active: 300, maintenanceDue: 12, averageMileage: 45210 },
  })
  ;(api.getDeliveryPage as jest.Mock).mockResolvedValue({
    data: [delivery], total: 1, page: 1, limit: 25, hasMore: false,
    summary: { total: 90, byStatus: { pending: 40, 'in-transit': 30, delivered: 15, cancelled: 5 } },
  })
  ;(api.getClientPage as jest.Mock).mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, hasMore: false, summary: { total: 0, restaurantHotel: 0, highRating: 0 } })
  ;(api.getMaintenancePage as jest.Mock).mockResolvedValue({ data: [], total: 0, page: 1, limit: 25, hasMore: false, summary: { total: 0, overdue: 0, dueThisWeek: 0, completed: 0 } })
  ;(api.getMaintenanceTasksDue as jest.Mock).mockResolvedValue([])
  ;(api.getVehicles as jest.Mock).mockResolvedValue([])
  ;(api.getClients as jest.Mock).mockResolvedValue([])
  global.fetch = jest.fn()
})

describe('vehicles list', () => {
  it('requests one page with the whole-fleet summary and shows fleet-wide stats', async () => {
    renderPage(VehiclesPage)
    const nav = await screen.findByRole('navigation', { name: 'Vehicles pagination' })
    expect(api.getVehiclePage).toHaveBeenCalledWith({ summary: 1, page: 1, limit: 25 }, expect.any(AbortSignal))
    expect(within(nav).getByText('Showing 1–25 of 312 vehicles')).toBeInTheDocument()
    expect(within(nav).getByText('Page 1 of 13')).toBeInTheDocument()
    expect(screen.getAllByText('312').length).toBeGreaterThan(0)
    expect(screen.getAllByText('45,210').length).toBeGreaterThan(0)
  })

  it('restores search, filter, sort and page from the URL', async () => {
    mockRouter.query = { q: 'van', status: 'delayed', sort: 'mileage', order: 'desc', page: '3', pageSize: '50' }
    renderPage(VehiclesPage)
    await screen.findByRole('navigation', { name: 'Vehicles pagination' })
    expect(api.getVehiclePage).toHaveBeenCalledWith(
      { q: 'van', status: 'delayed', sort: 'mileage', order: 'desc', summary: 1, page: 3, limit: 50 }, expect.any(AbortSignal),
    )
    expect(screen.getByRole('searchbox', { name: 'Search vehicles' })).toHaveValue('van')
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('delayed')
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('mileage|desc')
  })

  it('pushes paging and filtering to the URL so the back button works', async () => {
    renderPage(VehiclesPage)
    fireEvent.click(await screen.findByRole('button', { name: 'Next page' }))
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/vehicles', query: { page: '2' } }, undefined, { shallow: true })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: 'inactive' } })
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/vehicles', query: { status: 'inactive' } }, undefined, { shallow: true })
  })

  it('exports every matching vehicle, not just the visible page', async () => {
    mockRouter.query = { q: 'van', page: '2' }
    ;(api.getAllMatching as jest.Mock).mockResolvedValue([])
    renderPage(VehiclesPage)
    fireEvent.click(await screen.findByRole('button', { name: /Export CSV/ }))
    await waitFor(() => expect(api.getAllMatching).toHaveBeenCalledWith('/api/vehicles', { q: 'van' }))
  })
})

describe('deliveries list', () => {
  it('shows whole-scope status counts on the filter chips', async () => {
    mockRouter.pathname = '/deliveries'
    renderPage(DeliveriesPage)
    expect((await screen.findAllByText('North Shop')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Pending \(40\)/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'All Deliveries' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not treat an edit link prefill as a list filter and drops it with the link', async () => {
    mockRouter.pathname = '/deliveries'
    mockRouter.query = { edit: 'd1', status: 'delivered' }
    renderPage(DeliveriesPage)
    expect(await screen.findByTestId('delivery-edit')).toHaveTextContent('d1:delivered')
    expect(api.getDeliveryPage).toHaveBeenCalledWith({ summary: 1, page: 1, limit: 25 }, expect.any(AbortSignal))
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/deliveries', query: {} }, undefined, { shallow: true }))
  })
})

describe('clients and maintenance lists', () => {
  it('clients: an empty filtered search offers no create shortcut', async () => {
    mockRouter.pathname = '/clients'
    mockRouter.query = { q: 'zzz' }
    renderPage(ClientsPage)
    expect(await screen.findByText('No clients found')).toBeInTheDocument()
  })

  it('maintenance: list filters are server-side and relative to the viewer day', async () => {
    mockRouter.pathname = '/maintenance'
    mockRouter.query = { state: 'overdue' }
    renderPage(MaintenancePage)
    await waitFor(() => expect(api.getMaintenancePage).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'overdue', today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), summary: 1 }), expect.any(AbortSignal),
    ))
    expect(api.getMaintenanceTasksDue).toHaveBeenCalledWith(expect.stringMatching(/-01$/), expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(screen.getByRole('button', { name: 'Overdue' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('edit links wait for the workspace role (Codex finding on #175)', () => {
  it.each([
    ['/vehicles', VehiclesPage, 'v1', 'vehicle-edit'],
    ['/deliveries', DeliveriesPage, 'd1', 'delivery-edit'],
  ] as const)('%s?edit= opens the editor when the role resolves after the list', async (pathname, Page, id, testId) => {
    mockRouter.pathname = pathname
    mockRouter.query = { edit: id }
    mockRoleState = { role: null, loading: true }
    const { rerender } = renderPage(Page)
    // The list has loaded but the role has not: the link must not be consumed yet.
    await waitFor(() => expect(pathname === '/vehicles' ? api.getVehiclePage : api.getDeliveryPage).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('vehicle-detail')).not.toBeInTheDocument()
    expect(screen.queryByTestId(testId)).not.toBeInTheDocument()

    mockRoleState = { role: 'MANAGER', loading: false }
    rerender(<ConfirmDialogProvider><Page /></ConfirmDialogProvider>)
    expect(await screen.findByTestId(testId)).toHaveTextContent(id)
    expect(screen.queryByTestId('vehicle-detail')).not.toBeInTheDocument()
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname, query: {} }, undefined, { shallow: true }))
  })
})
