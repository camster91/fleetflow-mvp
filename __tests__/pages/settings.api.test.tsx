import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import APISettingsPage from '../../pages/settings/api'
import { notify } from '../../services/notifications'

jest.mock('../../components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
jest.mock('../../services/notifications', () => ({
  notify: { success: jest.fn(), error: jest.fn() },
}))

const plaintext = `ff_${'a'.repeat(64)}`
const masked = `ff_${'•'.repeat(16)}`

describe('API settings one-time key handling', () => {
  it('labels historical empty-scope keys as inert and directs the user to replace them', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [{ id: 'legacy-key', name: 'Legacy automation', key: masked, scopes: [], createdAt: new Date().toISOString(), lastUsedAt: null }] }),
    })
    render(<APISettingsPage />)
    const name = await screen.findByText('Legacy automation')
    const row = name.closest('.border') as HTMLElement
    expect(within(row).getByText('Legacy / inert')).toBeInTheDocument()
    expect(within(row).queryByText('Active')).not.toBeInTheDocument()
    expect(within(row).getByText('Generate a replacement key to use the read API.')).toBeInTheDocument()
  })

  it('shows a new secret only in the one-time modal and never enables reveal or copy on table rows', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ apiKey: { id: 'new-key', name: 'Production API Key', key: plaintext, scopes: ['read'], createdAt: new Date().toISOString(), lastUsedAt: null } }),
        }
      }
      return {
        ok: true,
        json: async () => ({ keys: [{ id: 'existing-key', name: 'Existing key', key: masked, scopes: ['read'], createdAt: new Date().toISOString(), lastUsedAt: null }] }),
      }
    })

    render(<APISettingsPage />)
    await screen.findByText('Existing key')
    expect(screen.queryByRole('button', { name: /show existing key/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Copy to clipboard')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Generate Key' }))
    const generateDialog = screen.getByRole('dialog', { name: 'Generate API Key' })
    await user.click(within(generateDialog).getByRole('button', { name: 'Generate secure key' }))

    const oneTimeDialog = await screen.findByRole('dialog', { name: 'API Key Generated' })
    expect(within(oneTimeDialog).getByText(plaintext)).toBeInTheDocument()
    expect(screen.getAllByText(masked)).toHaveLength(2)

    await user.click(within(oneTimeDialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByText(plaintext)).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /show .*key/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Copy to clipboard')).not.toBeInTheDocument()
    expect(screen.getAllByText(masked)).toHaveLength(2)
  })

  it('clears the one-time key only after clipboard copy succeeds', async () => {
    const user = userEvent.setup()
    const writeText = jest.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    ;(global.fetch as jest.Mock).mockImplementation(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => options?.method === 'POST'
        ? { apiKey: { id: 'new-key', name: 'Production API Key', key: plaintext, scopes: ['read'], createdAt: new Date().toISOString(), lastUsedAt: null } }
        : { keys: [] },
    }))
    render(<APISettingsPage />)
    await screen.findByText('No API keys yet')
    await user.click(screen.getByRole('button', { name: 'Generate Key' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Generate API Key' })).getByRole('button', { name: 'Generate secure key' }))
    const modal = await screen.findByRole('dialog', { name: 'API Key Generated' })
    await user.click(within(modal).getByRole('button', { name: 'Copy to Clipboard' }))
    await waitFor(() => expect(screen.queryByText(plaintext)).not.toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith(plaintext)
  })

  it('keeps the one-time key visible when clipboard copy fails', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(async () => { throw new Error('denied') }) } })
    ;(global.fetch as jest.Mock).mockImplementation(async (_url: string, options?: RequestInit) => ({
      ok: true,
      json: async () => options?.method === 'POST'
        ? { apiKey: { id: 'new-key', name: 'Production API Key', key: plaintext, scopes: ['read'], createdAt: new Date().toISOString(), lastUsedAt: null } }
        : { keys: [] },
    }))
    render(<APISettingsPage />)
    await screen.findByText('No API keys yet')
    await user.click(screen.getByRole('button', { name: 'Generate Key' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Generate API Key' })).getByRole('button', { name: 'Generate secure key' }))
    const modal = await screen.findByRole('dialog', { name: 'API Key Generated' })
    await user.click(within(modal).getByRole('button', { name: 'Copy to Clipboard' }))
    expect(within(modal).getByText(plaintext)).toBeInTheDocument()
    expect(notify.error).toHaveBeenCalledWith('Could not copy the API key. Copy it manually before closing.')
  })
})
