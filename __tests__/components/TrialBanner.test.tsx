import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrialBanner } from '@/components/TrialBanner'

const day = 86_400_000

function mockApi(subscription: unknown, availability: unknown, ok = true) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(url.includes('availability') ? availability : { subscription }),
    })
  ) as unknown as typeof fetch
}

async function renderBanner() {
  await act(async () => {
    render(<TrialBanner />)
  })
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
}

describe('TrialBanner', () => {
  const trial = (msFromNow: number) => ({
    status: 'TRIAL',
    trialEndsAt: new Date(Date.now() + msFromNow).toISOString(),
  })

  it('stays hidden during the free beta when checkout is unavailable', async () => {
    mockApi(trial(-day), { available: false })
    await renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText(/trial/i)).toBeNull()
  })

  it('stays hidden when availability cannot be checked', async () => {
    mockApi(trial(3 * day), null, false)
    await renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('stays hidden without a trial subscription', async () => {
    mockApi({ status: 'ACTIVE', trialEndsAt: null }, { available: true })
    await renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the days left when billing is available', async () => {
    mockApi(trial(3 * day - 1000), { available: true })
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent('3 days left in your trial.')
    expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/billing')
  })

  it('shows an expired trial and can be dismissed with a labelled button', async () => {
    mockApi(trial(-day), { available: true })
    await renderBanner()
    expect(await screen.findByRole('status')).toHaveTextContent('Your trial has expired.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss trial notice' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
