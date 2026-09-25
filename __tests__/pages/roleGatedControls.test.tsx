import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'
import { resolveWorkspaceRole } from '@/hooks/useWorkspaceRole'

// UI controls follow the caller's real workspace role (#173); the APIs keep
// enforcing the same rules and are covered by their own route tests.
let mockRole: string | null = 'OWNER'
jest.mock('@/hooks/useWorkspaceRole', () => ({
  ...jest.requireActual('@/hooks/useWorkspaceRole'),
  useWorkspaceRole: () => ({ role: mockRole, loading: false }),
}))
const mockRouter = { isReady: true, pathname: '/', query: {} as Record<string, string>, replace: jest.fn(), push: jest.fn() }
jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/lib/session', () => ({ useSession: () => ({ data: { user: { id: 'u1', name: 'Casey', role: 'user' } }, status: 'authenticated' }) }))
jest.mock('@/services/apiService', () => ({
  getVehicles: jest.fn(), getDeliveries: jest.fn(), getClients: jest.fn(), getMaintenanceTasks: jest.fn(),
  getSOPCategories: jest.fn(), getVendingMachines: jest.fn(),
  deleteVehicle: jest.fn(), deleteDelivery: jest.fn(), updateDelivery: jest.fn(), updateMaintenanceTask: jest.fn(),
  deleteSOPCategory: jest.fn(), deleteVendingMachine: jest.fn(),
}))
jest.mock('@/services/notifications', () => ({ notify: { success: jest.fn(), error: jest.fn() }, confirmAction: jest.fn() }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() }, toast: { error: jest.fn() } }))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
jest.mock('@/components/PageHeader', () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }))
jest.mock('@/components/VehicleFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/VehicleDetailModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DeliveryFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/DeliveryTimeline', () => ({ DeliveryTimeline: () => null }))
jest.mock('@/components/ClientFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MaintenanceTaskFormModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/SOPCategoryFormModal', () => ({ __esModule: true, default: () => null }))

import * as api from '@/services/apiService'
import toast from 'react-hot-toast'
import VehiclesPage from '@/pages/vehicles'
import DeliveriesPage from '@/pages/deliveries'
import ClientsPage from '@/pages/clients'
import MaintenancePage from '@/pages/maintenance'
import SopPage from '@/pages/sop'
import VendingMachinesPage from '@/pages/vending-machines'
import TeamPage from '@/pages/team'
import BillingPage from '@/pages/billing'
import DocumentsPage from '@/pages/documents'

const vehicle = { id: 'v1', name: 'Van Alpha', status: 'active', driver: 'Pat', location: 'Depot', mileage: 10, maintenanceDue: false, eta: '' }
const delivery = { id: 'd1', customer: 'North Shop', address: '1 Road', status: 'pending', driver: 'Pat', items: 1, progress: 0, scheduledTime: null, estimatedArrival: null }
const client = { id: 'c1', name: 'North Client', address: '2 Road', type: 'other' }
const task = { id: 'm1', vehicle: 'Van Alpha', type: 'Brake inspection', dueDate: '2030-01-15', priority: 'high', completed: false }

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })
}

const renderPage = (Page: React.ComponentType) => render(<ConfirmDialogProvider><Page /></ConfirmDialogProvider>)

beforeEach(() => {
  jest.clearAllMocks()
  mockRouter.query = {}
  ;(api.getVehicles as jest.Mock).mockResolvedValue([vehicle])
  ;(api.getDeliveries as jest.Mock).mockResolvedValue([delivery])
  ;(api.getClients as jest.Mock).mockResolvedValue([client])
  ;(api.getMaintenanceTasks as jest.Mock).mockResolvedValue([task])
  ;(api.getSOPCategories as jest.Mock).mockResolvedValue([{ id: 's1', name: 'Safety', description: '', count: 1 }])
  ;(api.getVendingMachines as jest.Mock).mockResolvedValue([{ id: 'vm1', name: 'Lobby', location: 'HQ', status: 'active' }])
  global.fetch = jest.fn(() => jsonResponse({})) as unknown as typeof fetch
})

describe('resolveWorkspaceRole', () => {
  it('mirrors the server workspace resolution', () => {
    expect(resolveWorkspaceRole({ activeTeamId: null, workspaces: [] })).toBe('OWNER')
    expect(resolveWorkspaceRole({ activeTeamId: null, workspaces: [{ id: 't1', role: 'DRIVER' }] })).toBe('DRIVER')
    expect(resolveWorkspaceRole({ activeTeamId: 't2', workspaces: [{ id: 't1', role: 'OWNER' }, { id: 't2', role: 'VIEWER' }] })).toBe('VIEWER')
    expect(resolveWorkspaceRole({ activeTeamId: null, workspaces: [{ id: 't1', role: 'OWNER' }, { id: 't2', role: 'VIEWER' }] })).toBeNull()
    expect(resolveWorkspaceRole(null)).toBeNull()
  })
})

describe('list pages hide create/edit/delete from roles that cannot manage', () => {
  const pages = [
    { name: 'vehicles', Page: VehiclesPage, record: 'Van Alpha', add: /Add Vehicle/, managers: ['OWNER', 'ADMIN', 'MANAGER'], readers: ['DISPATCHER', 'DRIVER', 'VIEWER'] },
    { name: 'deliveries', Page: DeliveriesPage, record: 'North Shop', add: /New Delivery/, managers: ['OWNER', 'MANAGER', 'DISPATCHER'], readers: ['DRIVER', 'VIEWER'] },
    { name: 'clients', Page: ClientsPage, record: 'North Client', add: /Add Client/, managers: ['OWNER', 'MANAGER'], readers: ['DISPATCHER', 'VIEWER'] },
    { name: 'maintenance', Page: MaintenancePage, record: null, add: /Add Task/, managers: ['OWNER', 'MANAGER', 'TECHNICIAN'], readers: ['DRIVER', 'VIEWER'] },
    { name: 'sop', Page: SopPage, record: 'Safety', add: /New Category/, managers: ['OWNER', 'MANAGER'], readers: ['TECHNICIAN', 'DRIVER', 'VIEWER'] },
    { name: 'vending machines', Page: VendingMachinesPage, record: 'Lobby', add: /Add Machine/, managers: ['OWNER', 'MANAGER'], readers: ['VIEWER', 'MEMBER'] },
  ]

  for (const { name, Page, record, add, managers, readers } of pages) {
    it.each(managers)(`${name}: %s sees the create action`, async (role) => {
      mockRole = role
      renderPage(Page)
      expect(await screen.findByRole('button', { name: add })).toBeInTheDocument()
    })

    it.each([...readers, null])(`${name}: %s gets no create, edit or delete action`, async (role) => {
      mockRole = role
      renderPage(Page)
      if (record) expect((await screen.findAllByText(record)).length).toBeGreaterThan(0)
      else await screen.findByRole('heading', { name: 'Maintenance Calendar' })
      expect(screen.queryByRole('button', { name: add })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^(Edit|Delete)\b/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Mark Delivered|Set Maintenance|Set Active/ })).not.toBeInTheDocument()
    })
  }

  it('vehicles: a manager also gets edit and delete row actions', async () => {
    mockRole = 'MANAGER'
    renderPage(VehiclesPage)
    expect((await screen.findAllByRole('button', { name: 'Delete vehicle' })).length).toBeGreaterThan(0)
  })
})

describe('/team controls follow the caller role', () => {
  const members = [
    { id: 'm-owner', role: 'OWNER', status: 'ACCEPTED', invitedAt: '2026-01-01', joinedAt: '2026-01-01', user: { id: 'u-o', name: 'Olive Owner', email: 'owner@example.test', image: null }, invitedByUser: null },
    { id: 'm-admin', role: 'ADMIN', status: 'ACCEPTED', invitedAt: '2026-01-01', joinedAt: '2026-01-01', user: { id: 'u-a', name: 'Ada Admin', email: 'admin@example.test', image: null }, invitedByUser: null },
    { id: 'm-driver', role: 'DRIVER', status: 'ACCEPTED', invitedAt: '2026-01-01', joinedAt: '2026-01-01', user: { id: 'u-d', name: 'Dee Driver', email: 'driver@example.test', image: null }, invitedByUser: null },
  ]
  beforeEach(() => { global.fetch = jest.fn(() => jsonResponse(members)) as unknown as typeof fetch })

  it('an admin can invite and manage non-admin members with only assignable roles', async () => {
    mockRole = 'ADMIN'
    renderPage(TeamPage)
    expect((await screen.findAllByText('Dee Driver')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Invite Member/ })).toBeInTheDocument()
    const selects = screen.getAllByRole('combobox', { name: /Role for Dee Driver/ })
    expect(selects.length).toBeGreaterThan(0)
    const options = within(selects[0]).getAllByRole('option').map((option) => option.getAttribute('value'))
    expect(options).toEqual(['MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'])
    // Admins are peers and the owner needs a dedicated transfer.
    expect(screen.queryByRole('combobox', { name: /Role for Ada Admin/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Role for Olive Owner/ })).not.toBeInTheDocument()
  })

  it('the owner may also manage admins', async () => {
    mockRole = 'OWNER'
    renderPage(TeamPage)
    expect((await screen.findAllByRole('combobox', { name: /Role for Ada Admin/ })).length).toBeGreaterThan(0)
    expect(screen.getAllByTitle(/Remove/).length).toBeGreaterThan(0)
  })

  it.each(['MANAGER', 'MEMBER', 'VIEWER'])('%s sees the member list read-only', async (role) => {
    mockRole = role
    renderPage(TeamPage)
    expect((await screen.findAllByText('Dee Driver')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Invite/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/Remove|Resend/)).not.toBeInTheDocument()
  })

  it.each(['DISPATCHER', 'TECHNICIAN', 'DRIVER'])('%s gets a notice and the member list is never requested', async (role) => {
    mockRole = role
    renderPage(TeamPage)
    expect(await screen.findByText('Team list not available for your role')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/team')
    expect(screen.queryByText('driver@example.test')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Invite/ })).not.toBeInTheDocument()
  })
})

describe('/billing for roles that cannot view billing', () => {
  it.each(['DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER'])('%s sees the read-only free-beta notice without calling billing endpoints', async (role) => {
    mockRole = role
    render(<BillingPage />)
    expect(await screen.findByText('Fleetvera is free during the beta')).toBeInTheDocument()
    expect(screen.getByText(/Billing is managed by your workspace owner or admin/)).toBeInTheDocument()
    expect(screen.queryByText('Billing status could not be verified')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('treats a 403 from the status endpoint as not a billing viewer, not an error', async () => {
    mockRole = null
    global.fetch = jest.fn((url: string) => url === '/api/subscription/status' ? jsonResponse({ error: 'Forbidden' }, 403) : jsonResponse({ available: false, pricing: null })) as unknown as typeof fetch
    render(<BillingPage />)
    expect(await screen.findByText('Fleetvera is free during the beta')).toBeInTheDocument()
    expect(screen.queryByText('Billing status could not be verified')).not.toBeInTheDocument()
  })

  it('a manager can view the plan but gets no checkout', async () => {
    mockRole = 'MANAGER'
    global.fetch = jest.fn((url: string) => url === '/api/subscription/status'
      ? jsonResponse({ subscription: null })
      : jsonResponse({ available: true, pricing: { monthly: { amount: 4900, currency: 'USD' }, yearly: { amount: 49000, currency: 'USD' } } })) as unknown as typeof fetch
    render(<BillingPage />)
    expect(await screen.findByText(/You can view the plan but not change it/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Subscribe/ })).not.toBeInTheDocument()
  })
})

describe('/documents after a document is CONFIRMED', () => {
  const extraction = { documentType: 'service_invoice', fields: { vendor: { value: 'Honest Garage', confidence: 0.9, citationIds: [] } }, services: [], parts: [], citations: [], warnings: [] }
  const row = (status: string) => ({ id: 'doc1', originalName: 'invoice.pdf', mimeType: 'application/pdf', status, revision: 3, extraction, expiresAt: '2030-01-01T00:00:00Z' })

  it('offers no second record and explains why', async () => {
    global.fetch = jest.fn(() => jsonResponse({ documents: [row('CONFIRMED')] })) as unknown as typeof fetch
    render(<DocumentsPage />)
    expect(await screen.findByText(/already created a fleet record, so it cannot create another/)).toBeInTheDocument()
    for (const name of ['Extract', 'Save reviewed draft', 'Preview maintenance task', 'Preview expense', 'Add service', 'Add part']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByRole('textbox', { name: /^vendor/i })).toHaveAttribute('readonly')
  })

  it('still offers review actions before confirmation', async () => {
    global.fetch = jest.fn(() => jsonResponse({ documents: [row('REVIEWED')] })) as unknown as typeof fetch
    render(<DocumentsPage />)
    expect(await screen.findByRole('button', { name: 'Preview expense' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(/cannot create another/)).not.toBeInTheDocument())
  })
})

// Codex finding on #168: a failed delete must keep the ConfirmDialog open for retry or cancel.
describe('a rejected delete keeps the confirm dialog open', () => {
  const cases = [
    { name: 'vehicles', Page: VehiclesPage, record: 'Van Alpha', trigger: 'Delete vehicle', title: 'Delete Vehicle', remove: () => api.deleteVehicle },
    { name: 'deliveries', Page: DeliveriesPage, record: 'North Shop', trigger: 'Delete delivery', title: 'Delete Delivery', remove: () => api.deleteDelivery },
    { name: 'sop', Page: SopPage, record: 'Safety', trigger: 'Delete Safety', title: 'Delete Category', remove: () => api.deleteSOPCategory },
    { name: 'vending machines', Page: VendingMachinesPage, record: 'Lobby', trigger: 'Delete Lobby', title: 'Delete Machine', remove: () => api.deleteVendingMachine },
  ]
  it.each(cases)('$name', async ({ Page, record, trigger, title, remove }) => {
    mockRole = 'OWNER'
    ;(remove() as jest.Mock).mockRejectedValue(new Error('Server refused the delete'))
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage(Page)
    await screen.findAllByText(record)
    fireEvent.click(screen.getAllByRole('button', { name: trigger })[0])
    const dialog = await screen.findByRole('alertdialog', { name: title })
    fireEvent.click(within(dialog).getByRole('button', { name: /^(Confirm|Delete)/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Server refused the delete'))
    // Still open and usable again (not busy) so the user can retry or cancel.
    await waitFor(() => expect(within(screen.getByRole('alertdialog', { name: title })).getByRole('button', { name: 'Cancel' })).toBeEnabled())
    expect(remove()).toHaveBeenCalledTimes(1)
  })
})
