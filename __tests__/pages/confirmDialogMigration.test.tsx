import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'

const mockRouter = { isReady: true, pathname: '/vehicles', query: {} as Record<string, string>, replace: jest.fn() }

jest.mock('next/router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/services/apiService', () => ({ getVehicles: jest.fn(), deleteVehicle: jest.fn() }))
jest.mock('@/services/notifications', () => ({ notify: { success: jest.fn(), error: jest.fn() } }))
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }))
jest.mock('@/hooks/useDataFetch', () => ({ useDataFetch: jest.fn() }))
jest.mock('@/hooks/useFilteredData', () => ({
  useFilteredData: ({ data }: { data: unknown[] }) => ({
    filtered: data, searchQuery: '', setSearchQuery: jest.fn(), filters: {}, setFilter: jest.fn(),
  }),
}))
jest.mock('@/hooks/useRecordQuery', () => ({ useRecordQuery: jest.fn() }))
jest.mock('@/hooks/useWorkspaceRole', () => ({ useWorkspaceRole: () => ({ role: 'OWNER', loading: false }) }))
jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('@/components/PageHeader', () => ({ PageHeader: () => null }))
jest.mock('@/components/VehicleDetailModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/VehicleFormModal', () => ({ __esModule: true, default: () => null }))

import { useDataFetch } from '@/hooks/useDataFetch'
import * as api from '@/services/apiService'
import { notify } from '@/services/notifications'
import VehiclesPage from '@/pages/vehicles'
import AdminUserManagement from '@/components/AdminUserManagement'

const vehicle = {
  id: 'v-1', name: 'Truck 7', status: 'active', driver: 'Driver', location: 'Depot',
  mileage: 10, maintenanceDue: false, fuelLevel: 80,
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe('vehicles page delete confirmation', () => {
  const refetch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useDataFetch as jest.Mock).mockReturnValue({ data: [vehicle], loading: false, refetch })
  })

  const renderPage = () => render(<ConfirmDialogProvider><VehiclesPage /></ConfirmDialogProvider>)

  it('opens the accessible dialog and cancel does not call the API', async () => {
    renderPage()
    const trigger = screen.getAllByRole('button', { name: 'Delete vehicle' })[0]
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Vehicle' })
    expect(dialog).toHaveAccessibleDescription('Delete "Truck 7"? This cannot be undone.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(api.deleteVehicle).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it('Escape dismisses without deleting', async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete vehicle' })[0])
    await screen.findByRole('alertdialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(api.deleteVehicle).not.toHaveBeenCalled()
  })

  it('confirm calls the API, shows a busy state while pending, then closes and returns focus', async () => {
    const pending = deferred()
    ;(api.deleteVehicle as jest.Mock).mockReturnValue(pending.promise)
    renderPage()
    const trigger = screen.getAllByRole('button', { name: 'Delete vehicle' })[0]
    trigger.focus()
    fireEvent.click(trigger)
    await screen.findByRole('alertdialog')

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(api.deleteVehicle).toHaveBeenCalledWith('v-1')

    const busy = await screen.findByRole('button', { name: 'Processing…' })
    expect(busy).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    // Dismissal is blocked while the delete is in flight.
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(busy)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(api.deleteVehicle).toHaveBeenCalledTimes(1)

    await act(async () => { pending.resolve() })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(notify.success).toHaveBeenCalledWith('Vehicle "Truck 7" deleted')
    expect(refetch).toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })
})

describe('admin user management delete confirmation', () => {
  it('keeps the dialog open when the delete fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    global.fetch = jest.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === 'DELETE'
        ? { ok: false, json: () => Promise.resolve({ error: 'Cannot delete this user' }) }
        : { ok: true, json: () => Promise.resolve({ users: [{ id: 'u-1', name: 'Ada', email: 'ada@example.com', role: 'viewer', createdAt: new Date().toISOString() }] }) })
    ) as unknown as typeof fetch
    render(<ConfirmDialogProvider><AdminUserManagement /></ConfirmDialogProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete user' }))
    await screen.findByRole('alertdialog', { name: 'Delete User' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete User' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled())
    expect(screen.getByRole('alertdialog', { name: 'Delete User' })).toBeInTheDocument()
    expect(screen.getAllByText('Cannot delete this user').length).toBeGreaterThan(0)
  })

  const user = { id: 'u-1', name: 'Ada', email: 'ada@example.com', role: 'viewer', createdAt: new Date().toISOString() }

  beforeEach(() => {
    global.fetch = jest.fn((_url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(init?.method === 'DELETE' ? { success: true } : { users: [user] }),
      })
    ) as unknown as typeof fetch
  })

  it('uses the shared dialog with the Delete User label and only deletes on confirm', async () => {
    render(<ConfirmDialogProvider><AdminUserManagement /></ConfirmDialogProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete user' }))

    await screen.findByRole('alertdialog', { name: 'Delete User' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect((global.fetch as jest.Mock).mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Delete user' }))
    await screen.findByRole('alertdialog')
    fireEvent.click(screen.getByRole('button', { name: 'Delete User' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    const deleteCall = (global.fetch as jest.Mock).mock.calls.find(([, init]) => init?.method === 'DELETE')
    expect(deleteCall?.[0]).toBe('/api/admin/users')
    expect(JSON.parse(deleteCall?.[1].body)).toEqual({ userId: 'u-1' })
  })
})
