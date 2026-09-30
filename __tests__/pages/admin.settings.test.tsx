import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { role: 'admin' } } }),
}))
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/head', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import PlatformSettingsPage from '@/pages/admin/settings'

const base = { help: 'Help text', environmentFallback: false, updatedAt: null }
const settings = (stripeSource: string) => [
  {
    ...base,
    key: 'STRIPE_SECRET_KEY',
    group: 'billing',
    label: 'Stripe secret key',
    secret: true,
    source: stripeSource,
    value: null,
    ...(stripeSource === 'admin' ? { mode: 'test' } : {}),
  },
  {
    ...base,
    key: 'STRIPE_PRICE_CURRENCY',
    group: 'billing',
    label: 'Currency',
    secret: false,
    source: 'environment',
    value: 'CAD',
    environmentFallback: true,
  },
  {
    ...base,
    key: 'CRON_SECRET',
    group: 'operations',
    label: 'Cron secret',
    secret: true,
    source: 'unset',
    value: null,
  },
]

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })

test('saves a write-only secret, shows its source, and reports field errors accessibly', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(json(200, { settings: settings('unset') }))
    .mockResolvedValueOnce(json(200, { settings: settings('admin') }))
    .mockResolvedValueOnce(json(400, { error: 'Must be at least 32 characters with no spaces', field: 'CRON_SECRET' }))
  global.fetch = fetchMock as jest.Mock
  render(<PlatformSettingsPage />)

  expect(await screen.findByRole('heading', { name: 'Stripe billing' })).toBeInTheDocument()
  expect(screen.getByLabelText('Currency')).toHaveValue('CAD')
  const stripeKey = screen.getByLabelText('Stripe secret key')
  expect(stripeKey).toHaveAttribute('type', 'password')
  expect(stripeKey).toHaveValue('')

  fireEvent.change(stripeKey, { target: { value: 'sk_test_abcdefghijklmnop' } })
  const stripeForm = stripeKey.closest('form') as HTMLFormElement
  fireEvent.click(within(stripeForm).getByRole('button', { name: 'Save' }))
  expect(await within(stripeForm).findByText('Saved.')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/admin/settings',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ key: 'STRIPE_SECRET_KEY', value: 'sk_test_abcdefghijklmnop' }),
    })
  )
  expect(screen.getByLabelText('Stripe secret key')).toHaveValue('')
  expect(within(stripeForm).getByText('Set here')).toBeInTheDocument()
  expect(within(stripeForm).getByText('Test mode')).toBeInTheDocument()
  expect(within(stripeForm).getByRole('button', { name: 'Remove' })).toBeInTheDocument()

  const cron = screen.getByLabelText('Cron secret')
  fireEvent.change(cron, { target: { value: 'short' } })
  fireEvent.click(within(cron.closest('form') as HTMLFormElement).getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('at least 32 characters')
  await waitFor(() => expect(cron).toHaveFocus())
  expect(cron).toHaveAttribute('aria-invalid', 'true')
  expect(cron).toHaveAttribute('aria-describedby', 'setting-CRON_SECRET-error')
})
