import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanBanner } from '@/components/PlanBanner'

const DAY = 86_400_000
const inDays = (days: number) => new Date(Date.now() + days * DAY).toISOString()

function mockEntitlement(
  entitlement: Record<string, unknown>,
  canManageBilling = true,
  ok = true,
  deletionAt: string | null = null
) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok,
      json: () =>
        Promise.resolve({
          entitlement: {
            enforced: true,
            access: 'FULL',
            reason: 'ACTIVE',
            trialEndsAt: null,
            graceEndsAt: null,
            accessEndsAt: null,
            readOnlySince: null,
            ...entitlement,
          },
          deletionAt,
          canManageBilling,
        }),
    })
  ) as unknown as typeof fetch
}

async function renderBanner() {
  await act(async () => {
    render(<PlanBanner />)
  })
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/subscription/entitlement'))
}

describe('PlanBanner', () => {
  it.each([
    ['billing is not enforced (free beta)', { enforced: false, access: 'FULL', reason: 'NOT_ENFORCED' }],
    ['the subscription is active', { reason: 'ACTIVE' }],
    ['the trial has more than two weeks left', { reason: 'TRIAL', trialEndsAt: inDays(30) }],
  ])('renders nothing when %s', async (_label, entitlement) => {
    mockEntitlement(entitlement)
    await renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders nothing when the check fails', async () => {
    mockEntitlement({}, true, false)
    await renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('counts down the trial and can be dismissed', async () => {
    mockEntitlement({ reason: 'TRIAL', trialEndsAt: inDays(3 - 0.01) })
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent('3 days left in your free trial.')
    expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/billing')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss plan notice' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('warns about a failed payment with the grace deadline', async () => {
    mockEntitlement({ reason: 'PAYMENT_GRACE', graceEndsAt: inDays(4) })
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Your last payment failed\. Update your payment details by/
    )
    expect(screen.getByRole('link', { name: 'Update payment' })).toBeInTheDocument()
  })

  it('explains a pending cancellation', async () => {
    mockEntitlement({ reason: 'CANCELLING', accessEndsAt: inDays(10) })
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent(/Your subscription ends on .* becomes read-only/)
  })

  it.each([
    ['TRIAL_EXPIRED', 'Your free trial has ended.'],
    ['PAYMENT_OVERDUE', 'Your payment is overdue.'],
    ['CANCELLED', 'Your subscription has ended.'],
  ])('explains a read-only workspace (%s) and cannot be dismissed', async (reason, lead) => {
    mockEntitlement({ access: 'READ_ONLY', reason })
    await renderBanner()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(`${lead} This workspace is read-only: you can still view and export your data.`)
    expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/billing')
    expect(screen.queryByRole('button', { name: 'Dismiss plan notice' })).toBeNull()
  })

  it('announces the deletion date once deletion is switched on', async () => {
    mockEntitlement({ access: 'READ_ONLY', reason: 'CANCELLED' }, true, true, '2027-09-01T12:00:00.000Z')
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Unless it is reactivated, its data will be deleted on or after .*2027/
    )
  })

  it('tells members without billing access who can fix a read-only workspace', async () => {
    mockEntitlement({ access: 'READ_ONLY', reason: 'TRIAL_EXPIRED' }, false)
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent('Ask your workspace owner or admin to subscribe.')
    expect(screen.queryByRole('link')).toBeNull()
  })
})
