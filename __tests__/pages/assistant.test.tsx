import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AssistantPage from '@/pages/assistant'
import AskAliasPage from '@/pages/ask'

jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))

describe('Ask Fleetvera page', () => {
  beforeEach(() => { global.fetch = jest.fn() as jest.Mock })
  it('offers supported prompts and renders cited answers', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ empty: false, answer: { claims: [{ text: 'One delivery is late.', citationIds: ['delivery:d1'] }] }, sources: [{ id: 'delivery:d1', type: 'delivery', recordId: 'd1', label: 'Delivery d1', href: '/deliveries?record=d1' }] }) })
    render(<AssistantPage />)
    fireEvent.click(screen.getByRole('button', { name: /which deliveries are late/i }))
    await waitFor(() => expect(screen.getByText('One delivery is late.')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /source: delivery d1/i })).toBeInTheDocument()
  })
  it('shows an aborted state when cancellation is clicked', async () => {
    ;(fetch as jest.Mock).mockImplementation((_url, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
    render(<AssistantPage />)
    fireEvent.change(screen.getByLabelText(/ask a fleet question/i), { target: { value: 'What needs attention today?' } })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i })); fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/cancelled/i)
  })
  it('supports a successful retry after a clear retryable error', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ empty: true, answer: { claims: [], summary: 'No matching records.' }, sources: [] }) })
    render(<AssistantPage />)
    fireEvent.change(screen.getByLabelText(/ask a fleet question/i), { target: { value: 'What needs attention today?' } })
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not answer/i)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('No matching records.')).toBeInTheDocument()
  })

  it('loads and selects only authorized bounded records and /ask renders the same guarded experience', async () => {
    ;(fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ entities: [{ id: 'v1', label: 'Van 1' }] }) })
    const { unmount } = render(<AssistantPage />)
    expect(screen.getByLabelText(/record type/i)).toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: /load authorized records/i }))
    expect(await screen.findByRole('option', { name: 'Van 1' })).toBeInTheDocument(); fireEvent.change(screen.getByLabelText(/authorized record/i), { target: { value: 'v1' } })
    expect(screen.getByRole('button', { name: /summarize selected vehicle/i })).toBeEnabled(); unmount()
    render(<AskAliasPage />); expect(screen.getByRole('heading', { name: /what would you like to check/i })).toBeInTheDocument()
  })

  it('prevents a cancelled stale request from overwriting an immediate retry', async () => {
    let resolveFirst!: (value: unknown) => void
    ;(fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce({ ok: true, json: async () => ({ empty: true, answer: { claims: [], summary: 'Fresh retry result.' }, sources: [] }) })
    render(<AssistantPage />); const input = screen.getByLabelText(/ask a fleet question/i); fireEvent.change(input, { target: { value: 'What needs attention today?' } }); fireEvent.click(screen.getByRole('button', { name: /^ask$/i })); fireEvent.click(await screen.findByRole('button', { name: /cancel/i })); fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(await screen.findByText('Fresh retry result.')).toBeInTheDocument(); resolveFirst({ ok: true, json: async () => ({ empty: true, answer: { claims: [], summary: 'Stale cancelled result.' }, sources: [] }) }); await Promise.resolve(); expect(screen.queryByText('Stale cancelled result.')).not.toBeInTheDocument()
  })
})
