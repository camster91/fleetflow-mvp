import { render, screen, waitFor } from '@testing-library/react'
import InvoicesPage from '@/pages/billing/invoices'

jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
jest.mock('@/components/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))

describe('InvoicesPage', () => {
  beforeEach(() => jest.resetAllMocks())

  it('shows an empty state', async () => {
    mockFetch({ ok: true, json: async () => ({ invoices: [] }) })
    render(<InvoicesPage />)
    expect(await screen.findByText('No invoices have been recorded yet.')).toBeInTheDocument()
  })

  it('shows a safe error state', async () => {
    mockFetch({ ok: false, json: async () => ({ error: 'secret database detail' }) })
    render(<InvoicesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Invoices could not be loaded')
    expect(screen.queryByText(/secret database detail/)).not.toBeInTheDocument()
  })

  it('renders paid and failed invoices and only links available PDFs', async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        invoices: [invoice('paid', 'https://invoice.stripe.com/paid.pdf'), invoice('failed', null, 'failed-id')],
      }),
    })
    render(<InvoicesPage />)
    expect(await screen.findByText('paid')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getAllByText(/49\.00/)).toHaveLength(2)
    const link = screen.getByRole('link', { name: 'PDF invoice' })
    expect(link).toHaveAttribute('href', 'https://invoice.stripe.com/paid.pdf')
    expect(link).toHaveAttribute('target', '_blank')
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'PDF invoice' })).toHaveLength(1))
  })

  it('formats zero and negative minor-unit amounts', async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        invoices: [
          { ...invoice('paid', null), amount: 0 },
          { ...invoice('paid', null, 'credit'), amount: -500 },
        ],
      }),
    })
    render(<InvoicesPage />)
    expect(await screen.findByText(/0\.00/)).toBeInTheDocument()
    expect(screen.getByText(/5\.00/)).toBeInTheDocument()
  })

  it('falls back safely for malformed currency, dates, and PDF URLs', async () => {
    mockFetch({
      ok: true,
      json: async () => ({
        invoices: [
          {
            ...invoice('paid', 'javascript:alert(1)'),
            currency: 'ZZZ',
            periodStart: 'not-a-date',
            periodEnd: 'also-bad',
          },
        ],
      }),
    })
    render(<InvoicesPage />)
    expect(await screen.findByText('Amount unavailable')).toBeInTheDocument()
    expect(screen.getByText('Date unavailable – Date unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'PDF invoice' })).not.toBeInTheDocument()
  })
})

function mockFetch(result: { ok: boolean; json: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue(result) as jest.Mock
}

function invoice(status: string, invoicePdf: string | null, id = 'paid-id') {
  return {
    id,
    amount: 4900,
    currency: 'USD',
    status,
    invoicePdf,
    createdAt: '2026-08-08T00:00:00.000Z',
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
  }
}
