import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))

import IntelligencePage from '@/pages/intelligence'

const finding = {
  id: 'f-1', type: 'vehicle-stale', severity: 'medium', confidence: 0.8, score: 300,
  title: 'Vehicle record is stale', explanation: 'Review the vehicle status.', evidence: [],
  evidenceValid: true, evidenceTotal: 0, evidenceTruncated: false, action: 'Review vehicle',
  actionUrl: '/vehicles?record=v-1', feedback: null, generatedAt: '2026-08-08T16:00:00Z', expiresAt: null,
  status: 'OPEN', effectiveStatus: 'OPEN',
}
const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body })

describe('Intelligence findings page', () => {
  beforeEach(() => jest.clearAllMocks())

  it('filters status and follows the signed next cursor without replacing loaded results', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: true, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [finding], pagination: { nextCursor: 'signed.cursor' } }))
      .mockImplementationOnce(() => json({ findings: [{ ...finding, id: 'f-2', title: 'Second issue' }], pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    expect(await screen.findByText(finding.title)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /load more/i }))
    expect(await screen.findByText('Second issue')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('cursor=signed.cursor'), expect.any(Object))
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => json({ finding: { ...finding, status: 'DISMISSED' } }))
    ;(global.fetch as jest.Mock).mockImplementationOnce(() => json({ findings: [{ ...finding, id: 'f-2', title: 'Second issue' }], pagination: { nextCursor: null } }))
    await userEvent.click(screen.getByRole('button', { name: /dismiss vehicle record is stale/i }))
    await waitFor(() => expect(screen.getByText('Second issue').closest('[data-testid="finding-card"]')).toHaveFocus())
  })

  it('changes status filters, rejects unsafe links, and shows safe error and empty states', async () => {
    const unsafe = { ...finding, actionUrl: 'https://evil.example' }
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: false, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [unsafe], pagination: { nextCursor: null } }))
      .mockImplementationOnce(() => json({ error: 'secret' }, false))
      .mockImplementationOnce(() => json({ findings: [], pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    await screen.findByText(finding.title)
    expect(screen.queryByRole('link', { name: /review vehicle/i })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText(/finding status/i), 'DISMISSED')
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load findings/i)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(/no dismissed findings/i)).toBeInTheDocument()
  })

  it('restores a failed lifecycle update and returns focus to its card', async () => {
    let rejectPatch!: () => void
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: true, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [finding], pagination: { nextCursor: null } }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPatch = () => reject(new Error('secret')) })) as jest.Mock
    render(<IntelligencePage />)
    await screen.findByText(finding.title)
    await userEvent.click(screen.getByRole('button', { name: /dismiss vehicle record is stale/i }))
    expect(screen.queryByText(finding.title)).not.toBeInTheDocument()
    rejectPatch()
    expect(await screen.findByText(finding.title)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('finding-card')).toHaveFocus())
  })

  it('keeps canonical client actions and strips every non-canonical variant', async () => {
    const variants = [
      { ...finding, id: 'client-ok', title: 'Canonical client', action: 'Open canonical client', actionUrl: '/clients/client%2Fone' },
      { ...finding, id: 'client-query', title: 'Client query', action: 'Open client query', actionUrl: '/clients?record=c-1' },
      { ...finding, id: 'collection-hash', title: 'Collection hash', action: 'Open hash', actionUrl: '/vehicles?record=v-1#private' },
      { ...finding, id: 'nested-client', title: 'Nested client', action: 'Open nested client', actionUrl: '/clients/c-1/notes' },
    ]
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: false, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: variants, pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    expect(await screen.findByRole('link', { name: 'Open canonical client' })).toHaveAttribute('href', '/clients/client%2Fone')
    expect(screen.queryByRole('link', { name: 'Open client query' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open hash' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open nested client' })).not.toBeInTheDocument()
  })

  it('does not render invalid lifecycle controls in the dismissed tab', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: true, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [finding], pagination: { nextCursor: null } }))
      .mockImplementationOnce(() => json({ findings: [{ ...finding, status: 'DISMISSED', effectiveStatus: 'DISMISSED' }], pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    await screen.findByText(finding.title)
    await userEvent.selectOptions(screen.getByLabelText(/finding status/i), 'DISMISSED')
    await screen.findByText(finding.title)
    expect(screen.queryByRole('button', { name: /dismiss vehicle record/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /resolve vehicle record/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark Vehicle record is stale helpful' })).toBeInTheDocument()
  })

  it('ignores an old mutation failure after the user changes filters', async () => {
    let rejectPatch!: () => void
    const dismissed = { ...finding, id: 'dismissed-current', title: 'Current dismissed item', status: 'DISMISSED', effectiveStatus: 'DISMISSED' }
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: true, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [finding], pagination: { nextCursor: null } }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPatch = () => reject(new Error('old failure')) }))
      .mockImplementationOnce(() => json({ findings: [dismissed], pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    await screen.findByText(finding.title)
    await userEvent.click(screen.getByRole('button', { name: `Dismiss ${finding.title}` }))
    await userEvent.selectOptions(screen.getByLabelText(/finding status/i), 'DISMISSED')
    expect(await screen.findByText(dismissed.title)).toBeInTheDocument()
    rejectPatch()
    await waitFor(() => expect(screen.queryByText(finding.title)).not.toBeInTheDocument())
    expect(screen.getByText(dismissed.title)).toBeInTheDocument()
  })

  it('keeps independent optimistic mutations isolated when one succeeds and one fails', async () => {
    let resolveFirst!: () => void
    let rejectSecond!: () => void
    const second = { ...finding, id: 'f-2', title: 'Second independent issue' }
    global.fetch = jest.fn()
      .mockImplementationOnce(() => json({ capabilities: { manage: true, feedback: true } }))
      .mockImplementationOnce(() => json({ findings: [finding, second], pagination: { nextCursor: null } }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = () => resolve({ ok: true, json: async () => ({ finding: { ...finding, status: 'DISMISSED' } }) }) }))
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSecond = () => reject(new Error('second failed')) }))
      .mockImplementationOnce(() => json({ findings: [second], pagination: { nextCursor: null } })) as jest.Mock
    render(<IntelligencePage />)
    await screen.findByText(finding.title)

    await userEvent.click(screen.getByRole('button', { name: `Dismiss ${finding.title}` }))
    await userEvent.click(screen.getByRole('button', { name: `Dismiss ${second.title}` }))
    expect(screen.queryByText(finding.title)).not.toBeInTheDocument()
    expect(screen.queryByText(second.title)).not.toBeInTheDocument()

    resolveFirst()
    rejectSecond()
    expect(await screen.findByText(second.title)).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5))
    expect(screen.queryByText(finding.title)).not.toBeInTheDocument()
  })
})
