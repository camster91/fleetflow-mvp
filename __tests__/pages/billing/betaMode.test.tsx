import { render, screen } from '@testing-library/react'
import BillingPage from '@/pages/billing/index'
import PricingPage from '@/pages/pricing'

jest.mock('@/components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
jest.mock('@/components/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))
jest.mock('@/components/marketing/Navbar', () => ({ Navbar: () => null }))
jest.mock('@/components/marketing/Footer', () => ({ Footer: () => null }))

const unsupportedClaims = /white-label|SLA|dedicated account manager|priority support|custom reports/i

function mockFetch(responses: Record<string, { ok: boolean; body?: unknown }>) {
  global.fetch = jest.fn(async (url: string) => {
    const match = responses[url]
    return { ok: match?.ok ?? false, json: async () => match?.body ?? {} }
  }) as unknown as typeof fetch
}

describe('free beta billing', () => {
  it('pricing page says the beta is free and makes no unsupported claims', () => {
    const { container } = render(<PricingPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Free during the beta')
    expect(container).not.toHaveTextContent(unsupportedClaims)
  })

  it('billing page shows the beta notice and no checkout when billing is not configured', async () => {
    mockFetch({
      '/api/subscription/status': { ok: true, body: { subscription: null } },
      '/api/stripe/availability': { ok: true, body: { available: false, pricing: null } },
    })
    const { container } = render(<BillingPage />)
    expect(await screen.findByText('Fleetvera is free during the beta')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent(unsupportedClaims)
  })

  it('billing page does not claim the beta is free when the status check fails', async () => {
    mockFetch({})
    render(<BillingPage />)
    expect(await screen.findByText('Billing status could not be verified')).toBeInTheDocument()
    expect(screen.queryByText('Fleetvera is free during the beta')).not.toBeInTheDocument()
  })

  it.each(['ACTIVE', 'PAST_DUE'])('billing page shows a neutral warning, not the beta notice, for a %s paid subscription', async (status) => {
    mockFetch({
      '/api/subscription/status': { ok: true, body: { subscription: { plan: 'PRO', status, trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' } } },
      '/api/stripe/availability': { ok: true, body: { available: false, pricing: null } },
    })
    render(<BillingPage />)
    expect(await screen.findByText('Online billing is temporarily unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Fleetvera is free during the beta')).not.toBeInTheDocument()
  })

  it('billing page still offers checkout once billing is configured', async () => {
    mockFetch({
      '/api/subscription/status': { ok: true, body: { subscription: null } },
      '/api/stripe/availability': { ok: true, body: { available: true, pricing: { monthly: { amount: 4900, currency: 'USD' }, yearly: { amount: 49000, currency: 'USD' } } } },
    })
    render(<BillingPage />)
    expect(await screen.findByRole('button', { name: 'Subscribe Monthly' })).toBeEnabled()
    expect(screen.queryByText('Fleetvera is free during the beta')).not.toBeInTheDocument()
  })
})
