import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SecuritySettingsPage from '../../pages/settings/security'
import { confirmAction } from '../../services/notifications'

jest.mock('../../components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
jest.mock('../../components/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))
jest.mock('../../services/notifications', () => ({ confirmAction: jest.fn() }))
jest.mock('@/lib/session', () => ({ useSession: () => ({ data: { user: { id: 'u1' } }, status: 'authenticated' }) }))
const mockPush = jest.fn()
jest.mock('next/router', () => ({ useRouter: () => ({ push: mockPush }) }))

function mockFetch(logoutAllOk = true) {
  global.fetch = jest.fn(async (url: string) => {
    if (url === '/api/auth/logout-all') return { ok: logoutAllOk, json: async () => (logoutAllOk ? { ok: true } : { error: 'Server unavailable' }) }
    return { ok: true, json: async () => ({ twoFactorEnabled: false, lastLoginAt: null, loginHistory: [] }) }
  }) as unknown as typeof fetch
}

describe('security settings: log out everywhere', () => {
  beforeEach(() => jest.clearAllMocks())

  it('does nothing until the user confirms', async () => {
    mockFetch()
    ;(confirmAction as jest.Mock).mockResolvedValue(false)
    render(<SecuritySettingsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /log out everywhere/i }))
    expect(confirmAction).toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/auth/logout-all', expect.anything())
  })

  it('posts to /api/auth/logout-all after confirmation', async () => {
    mockFetch()
    ;(confirmAction as jest.Mock).mockResolvedValue(true)
    render(<SecuritySettingsPage />)
    const button = await screen.findByRole('button', { name: /log out everywhere/i })
    // md buttons carry the 44px minimum touch target.
    expect(button.className).toContain('min-h-11')
    await userEvent.click(button)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout-all', { method: 'POST' }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/login'))
  })

  it('shows an error and stays on the page when the request fails', async () => {
    mockFetch(false)
    ;(confirmAction as jest.Mock).mockResolvedValue(true)
    render(<SecuritySettingsPage />)
    await userEvent.click(await screen.findByRole('button', { name: /log out everywhere/i }))
    expect(await screen.findByText('Server unavailable')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalledWith('/auth/login')
  })
})
