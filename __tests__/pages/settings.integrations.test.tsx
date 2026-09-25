import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import IntegrationsPage from '@/pages/settings/integrations'

jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}))
const mockQuery: Record<string, string> = {}
let mockRouterReady = true
jest.mock('next/router', () => ({ useRouter: () => ({ query: mockQuery, isReady: mockRouterReady }) }))

describe('integration settings', () => {
  beforeEach(() => {
    Object.keys(mockQuery).forEach((key) => delete mockQuery[key])
    mockRouterReady = true
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        integrations: [
          {
            provider: 'google-maps',
            name: 'Google Maps',
            status: 'CONNECTED',
            connected: true,
            readiness: { ready: true },
            capabilities: ['geocode', 'routes'],
            lastSyncAt: '2026-08-08T12:00:00Z',
            nextSyncAt: '2026-08-08T13:00:00Z',
            lastErrorCode: null,
          },
          {
            provider: 'quickbooks',
            name: 'QuickBooks Online',
            status: 'RECONNECT_REQUIRED',
            connected: false,
            needsReconnect: true,
            readiness: { ready: true },
            capabilities: ['expenses'],
            lastSyncAt: null,
            nextSyncAt: null,
            lastErrorCode: 'TOKEN_EXPIRED',
          },
        ],
      }),
    }) as any
  })

  it('shows an allowlisted actionable OAuth callback message', async () => {
    mockQuery.status = 'connection_changed'
    render(<IntegrationsPage />)
    expect(
      await screen.findByText('The connection changed while authorization was in progress. Reconnect to try again.')
    ).toBeInTheDocument()
  })

  it('waits for router hydration and responds to a subsequent safe callback status', async () => {
    mockRouterReady = false
    const view = render(<IntegrationsPage />)
    expect(screen.queryByText(/authorization link expired/i)).not.toBeInTheDocument()
    mockRouterReady = true
    mockQuery.status = 'oauth_invalid'
    view.rerender(<IntegrationsPage />)
    expect(
      await screen.findByText('The authorization link expired or was already used. Reconnect to try again.')
    ).toBeInTheDocument()
  })

  it('does not render mojibake in provider record separators', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url === '/api/integrations/records'
          ? {
              vehicles: [],
              records: [
                {
                  id: 'record-glyph',
                  remoteId: 'qb-glyph',
                  payloadHash: 'a'.repeat(64),
                  revision: 1,
                  reviewStatus: 'PENDING_REVIEW',
                  conflictReason: null,
                  localEntityId: null,
                  payload: { vendorRef: 'Garage', total: 1, date: '2026-08-08' },
                  provenance: null,
                },
              ],
            }
          : { integrations: [] },
    }))
    const { container } = render(<IntegrationsPage />)
    await screen.findByText(/Garage/)
    expect(container.textContent).not.toMatch(/[ÃÂâ]/)
    expect(container.textContent).toContain('Garage ·')
  })

  it('shows safe Google retry and dead-letter outcomes to admins', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url === '/api/integrations/records'
          ? {
              vehicles: [],
              records: [
                {
                  id: 'geo-1',
                  remoteType: 'delivery_geocode',
                  remoteId: 'delivery-1',
                  payloadHash: 'b'.repeat(64),
                  revision: 1,
                  reviewStatus: 'DEAD_LETTER',
                  outcome: 'DEAD_LETTER',
                  attemptCount: 2,
                  nextRetryAt: null,
                  lastErrorCode: 'ZERO_RESULTS',
                  conflictReason: 'ZERO_RESULTS',
                  localEntityId: null,
                  payload: null,
                  provenance: { provider: 'google-maps' },
                },
              ],
            }
          : { integrations: [] },
    }))
    render(<IntegrationsPage />)
    expect(await screen.findByText('Google Maps delivery outcomes')).toBeInTheDocument()
    expect(screen.getByText('Outcome: zero results')).toBeInTheDocument()
    expect(screen.getByText('Attempts: 2')).toBeInTheDocument()
  })

  it('shows truthful sync state and explicit reconnect/disconnect controls', async () => {
    render(<IntegrationsPage />)
    expect(await screen.findByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Reconnect required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sync Google Maps now' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Disconnect Google Maps' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect QuickBooks Online' })).toBeInTheDocument()
  })

  it('starts sync with an idempotency key', async () => {
    render(<IntegrationsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sync Google Maps now' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/integrations/google-maps/sync',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
        })
      )
    )
  })

  it('shows staged payload provenance and requires mapping before approval', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url === '/api/integrations/records'
          ? {
              vehicles: [{ id: 'vehicle-1', name: 'Van 1' }],
              records: [
                {
                  id: 'record-1',
                  remoteId: 'qb-1',
                  payloadHash: 'a'.repeat(64),
                  revision: 1,
                  reviewStatus: 'PENDING_REVIEW',
                  conflictReason: 'Vehicle mapping and operator confirmation required',
                  localEntityId: null,
                  payload: { vendorRef: 'Garage', total: 125, date: '2026-08-08' },
                  provenance: { provider: 'quickbooks', syncedAt: '2026-08-08T12:00:00Z' },
                },
              ],
            }
          : { integrations: [] },
    }))
    render(<IntegrationsPage />)
    expect(await screen.findByText(/Garage/)).toBeInTheDocument()
    expect(screen.getByText(/Vehicle mapping and operator confirmation required/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve for import' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('Vehicle for provider record qb-1'), 'vehicle-1')
    expect(screen.getByRole('button', { name: 'Map vehicle' })).toBeEnabled()
  })
})
