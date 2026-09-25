import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IntelligenceBrief } from '@/components/intelligence/IntelligenceBrief'

const finding = {
  id: 'f-1',
  type: 'delivery-late',
  severity: 'high',
  confidence: 0.9,
  score: 500,
  title: 'Late delivery needs attention',
  explanation: 'The scheduled time has passed.',
  evidence: [
    {
      entityType: 'delivery',
      entityId: 'd-1',
      field: 'scheduledTime',
      value: '2026-08-08',
      timestamp: '2026-08-08T12:00:00Z',
    },
  ],
  evidenceValid: true,
  evidenceTotal: 1,
  evidenceTruncated: false,
  action: 'Review delivery',
  actionUrl: '/deliveries?record=d-1',
  feedback: null,
  status: 'OPEN',
  effectiveStatus: 'OPEN',
  generatedAt: '2026-08-08T16:00:00Z',
  expiresAt: '2026-08-09T16:00:00Z',
}
const brief = {
  findings: [finding],
  totalOpen: 1,
  generatedAt: '2026-08-08T16:00:00Z',
  stale: false,
  coverage: { complete: true, sourceTruncated: false, evidenceComplete: true },
  capabilities: { refresh: true, manage: true, feedback: true },
}
const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body })

describe('IntelligenceBrief', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders loading, priority, safe evidence disclosure, and primary action', async () => {
    global.fetch = jest.fn(() => response(brief)) as jest.Mock
    render(<IntelligenceBrief />)
    expect(screen.getByRole('status', { name: /loading fleet intelligence brief/i })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /late delivery needs attention/i })).toBeInTheDocument()
    expect(screen.getByText(/brief generated/i)).toBeInTheDocument()
    expect(screen.getByText('High urgency')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /review delivery/i })).toHaveAttribute('href', '/deliveries?record=d-1')
    const disclosure = screen.getByRole('button', { name: /why am i seeing this/i })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /open delivery record/i })).toHaveAttribute(
      'href',
      '/deliveries?record=d-1'
    )
    expect(screen.queryByText(/\{"/)).not.toBeInTheDocument()
  })

  it('uses the canonical client detail route for client actions and evidence', async () => {
    const clientFinding = {
      ...finding,
      id: 'client-f',
      actionUrl: '/clients/client%2Fone',
      action: 'Review client',
      evidence: [{ entityType: 'client', entityId: 'client/one', field: 'record', value: null, timestamp: null }],
    }
    global.fetch = jest.fn(() => response({ ...brief, findings: [clientFinding] })) as jest.Mock
    render(<IntelligenceBrief />)
    expect(await screen.findByRole('link', { name: /review client/i })).toHaveAttribute('href', '/clients/client%2Fone')
    await userEvent.click(screen.getByRole('button', { name: /why am i seeing this/i }))
    expect(screen.getByRole('link', { name: /open client record/i })).toHaveAttribute('href', '/clients/client%2Fone')
  })

  it('optimistically removes a dismissed finding and rolls back with an error on failure', async () => {
    let rejectPatch!: () => void
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => response(brief))
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectPatch = () => reject(new Error('secret'))
          })
      )
    global.fetch = fetchMock as jest.Mock
    render(<IntelligenceBrief />)
    await screen.findByText(finding.title)
    await userEvent.click(screen.getByRole('button', { name: /dismiss late delivery/i }))
    expect(screen.queryByText(finding.title)).not.toBeInTheDocument()
    rejectPatch()
    expect(await screen.findByText(/could not dismiss/i)).toBeInTheDocument()
    expect(await screen.findByText(finding.title)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('finding-card')).toHaveFocus())
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('moves focus to the next finding after a successful removal', async () => {
    const second = { ...finding, id: 'f-2', title: 'Second finding' }
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response({ ...brief, findings: [finding, second], totalOpen: 2 }))
      .mockImplementationOnce(() => response({ finding: { ...finding, status: 'DISMISSED' } })) as jest.Mock
    render(<IntelligenceBrief />)
    await screen.findByText(second.title)
    await userEvent.click(screen.getByRole('button', { name: /dismiss late delivery/i }))
    await waitFor(() => expect(screen.getByText(second.title).closest('[data-testid="finding-card"]')).toHaveFocus())
  })

  it('records helpful feedback without duplicate actions', async () => {
    let resolvePatch!: (value: unknown) => void
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response(brief))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePatch = resolve
          })
      ) as jest.Mock
    render(<IntelligenceBrief />)
    const helpful = await screen.findByRole('button', { name: 'Mark Late delivery needs attention helpful' })
    await userEvent.click(helpful)
    expect(helpful).toBeDisabled()
    await userEvent.click(helpful)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    resolvePatch({ ok: true, json: async () => ({ finding: { ...finding, feedback: 'HELPFUL' } }) })
    expect(await screen.findByText(/feedback saved/i)).toBeInTheDocument()
  })

  it.each([
    [{ ...brief, findings: [], totalOpen: 0 }, /nothing needs attention/i],
    [{ ...brief, stale: true }, /brief may be stale/i],
    [
      { ...brief, coverage: { complete: false, sourceTruncated: true, evidenceComplete: false } },
      /coverage is incomplete/i,
    ],
  ])('renders truthful state %#', async (payload, message) => {
    global.fetch = jest.fn(() => response(payload)) as jest.Mock
    render(<IntelligenceBrief />)
    expect(await screen.findByText(message)).toBeInTheDocument()
  })

  it('prompts first-time generation instead of claiming an empty fleet is clear', async () => {
    global.fetch = jest.fn(() =>
      response({
        ...brief,
        findings: [],
        totalOpen: 0,
        generatedAt: null,
        stale: true,
        coverage: { complete: false, sourceTruncated: false, evidenceComplete: false, reason: 'NEVER_GENERATED' },
      })
    ) as jest.Mock
    render(<IntelligenceBrief />)
    expect(await screen.findByText(/generate fleet intelligence/i)).toBeInTheDocument()
    expect(screen.queryByText(/nothing needs attention/i)).not.toBeInTheDocument()
  })

  it('renders persisted feedback as an accessible selected state after reload', async () => {
    global.fetch = jest.fn(() => response({ ...brief, findings: [{ ...finding, feedback: 'HELPFUL' }] })) as jest.Mock
    render(<IntelligenceBrief />)
    expect(await screen.findByRole('button', { name: 'Mark Late delivery needs attention helpful' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('shows a safe retryable error and recovers', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response({ error: 'database secret' }, false))
      .mockImplementationOnce(() => response(brief)) as jest.Mock
    render(<IntelligenceBrief />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
    expect(screen.queryByText(/database secret/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(finding.title)).toBeInTheDocument()
  })

  it('does not announce refresh success when the follow-up brief load fails', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response(brief))
      .mockImplementationOnce(() => response({ generatedAt: brief.generatedAt }))
      .mockImplementationOnce(() => response({ error: 'secret' }, false)) as jest.Mock
    render(<IntelligenceBrief />)
    await screen.findByText(finding.title)
    await userEvent.click(screen.getByRole('button', { name: /^refresh$/i }))
    expect(await screen.findByText(/could not refresh fleet intelligence/i)).toBeInTheDocument()
    expect(screen.queryByText(/fleet intelligence refreshed/i)).not.toBeInTheDocument()
    expect(screen.getByText(finding.title)).toBeInTheDocument()
  })

  it('prevents duplicate refresh requests while regeneration is pending', async () => {
    let finish!: (value: unknown) => void
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response(brief))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      ) as jest.Mock
    render(<IntelligenceBrief />)
    const refresh = await screen.findByRole('button', { name: /^refresh$/i })
    await userEvent.click(refresh)
    expect(refresh).toBeDisabled()
    await userEvent.click(refresh)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    finish({ ok: false, json: async () => ({}) })
    expect(await screen.findByText(/could not refresh/i)).toBeInTheDocument()
  })

  it('limits dashboard rendering to five findings', async () => {
    global.fetch = jest.fn(() =>
      response({
        ...brief,
        findings: Array.from({ length: 8 }, (_, i) => ({ ...finding, id: `f-${i}`, title: `Issue ${i}` })),
        totalOpen: 8,
      })
    ) as jest.Mock
    render(<IntelligenceBrief />)
    await waitFor(() => expect(screen.getAllByTestId('finding-card')).toHaveLength(5))
    expect(screen.getByRole('link', { name: /view all 8 findings/i })).toHaveAttribute('href', '/intelligence')
  })

  it('keeps overlapping card outcomes isolated and refetches the authoritative top five', async () => {
    const second = { ...finding, id: 'f-2', title: 'Second finding' }
    let succeed!: (value: unknown) => void
    let fail!: () => void
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() => response({ ...brief, findings: [finding, second], totalOpen: 2 }))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            succeed = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = () => reject(new Error('failed'))
          })
      )
      .mockImplementationOnce(() => response({ ...brief, findings: [second], totalOpen: 1 })) as jest.Mock
    render(<IntelligenceBrief />)
    await screen.findByText(second.title)
    await userEvent.click(screen.getByRole('button', { name: `Dismiss ${finding.title}` }))
    await userEvent.click(screen.getByRole('button', { name: `Dismiss ${second.title}` }))
    succeed({ ok: true, json: async () => ({ finding: finding, noop: false }) })
    fail()
    expect(await screen.findByText(second.title)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(finding.title)).not.toBeInTheDocument())
  })
})
