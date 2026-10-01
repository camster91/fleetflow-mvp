import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
jest.mock('@/lib/session', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { role: 'admin' } } }),
}))
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/head', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))
import LaunchReadinessPage from '@/pages/admin/launch'

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })
const snapshot = (overrides: Record<string, unknown> = {}) => ({
  mode: 'pilot',
  ready: false,
  deployConfigured: true,
  checks: [
    {
      id: 'leaked-secrets',
      label: 'Leaked secrets replaced',
      status: 'fail',
      detail: 'These settings still use a leaked value.',
      items: ['JWT_SECRET'],
      issue: 30,
    },
    {
      id: 'billing',
      label: 'Stripe billing',
      status: 'warn',
      detail: 'Not needed for the beta.',
      action: { href: '/admin/settings', label: 'Platform settings' },
    },
  ],
  records: [],
  ...overrides,
})

afterEach(() => jest.restoreAllMocks())

test('shows failing checks and blocks a go decision until they pass', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(json(200, snapshot())) as jest.Mock
  render(<LaunchReadinessPage />)

  expect(await screen.findByRole('heading', { name: '1 check failing' })).toBeInTheDocument()
  expect(screen.getByText('JWT_SECRET')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Issue #30' })).toHaveAttribute(
    'href',
    'https://github.com/camster91/fleetflow-mvp/issues/30'
  )
  expect(screen.getByRole('link', { name: 'Platform settings' })).toHaveAttribute('href', '/admin/settings')

  const decision = screen.getByRole('region', { name: 'Go / no-go' })
  expect(within(decision).getByRole('radio', { name: /^Go/ })).toBeDisabled()
  expect(within(decision).getByRole('radio', { name: /No-go/ })).toBeChecked()
  expect(within(decision).getByText('Go is available once no check is failing.')).toBeInTheDocument()
})

test('records evidence and shows it in the history', async () => {
  const saved = snapshot({
    records: [
      {
        id: 'r1',
        kind: 'backup_drill',
        outcome: 'pass',
        performedAt: '2026-10-01T10:00:00.000Z',
        summary: 'Restored into a scratch container',
        evidenceUrl: null,
        reference: 'abcd1234',
        recordedByName: 'Cam',
      },
    ],
  })
  const fetchMock = jest.fn().mockResolvedValueOnce(json(200, snapshot())).mockResolvedValueOnce(json(201, saved))
  global.fetch = fetchMock as jest.Mock
  render(<LaunchReadinessPage />)

  const evidence = await screen.findByRole('region', { name: 'Record backup and monitoring evidence' })
  fireEvent.change(within(evidence).getByLabelText('Summary'), {
    target: { value: 'Restored into a scratch container' },
  })
  fireEvent.change(within(evidence).getByLabelText(/Checksum or ID/), { target: { value: 'abcd1234' } })
  fireEvent.click(within(evidence).getByRole('button', { name: 'Record evidence' }))

  expect(await within(evidence).findByText('Evidence recorded.')).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[1]
  expect(url).toBe('/api/admin/launch')
  expect(JSON.parse(init.body)).toMatchObject({
    kind: 'backup_drill',
    outcome: 'pass',
    summary: 'Restored into a scratch container',
    reference: 'abcd1234',
    performedAt: expect.stringMatching(/Z$/),
  })
  const history = screen.getByRole('region', { name: 'History' })
  expect(within(history).getByText('Backup drill · Passed')).toBeInTheDocument()
  expect(within(history).getByText('abcd1234')).toBeInTheDocument()
})

test('marks the field the server rejected and moves focus to it', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(json(200, snapshot()))
    .mockResolvedValueOnce(
      json(400, { error: 'Evidence link must be an https URL', field: 'evidenceUrl' })
    ) as jest.Mock
  render(<LaunchReadinessPage />)

  const evidence = await screen.findByRole('region', { name: 'Record backup and monitoring evidence' })
  fireEvent.click(within(evidence).getByRole('button', { name: 'Record evidence' }))
  expect(await within(evidence).findByRole('alert')).toHaveTextContent('Evidence link must be an https URL')
  const link = within(evidence).getByLabelText(/Evidence link/)
  await waitFor(() => expect(link).toHaveFocus())
  expect(link).toHaveAttribute('aria-invalid', 'true')
  expect(link.getAttribute('aria-describedby')).toBe(within(evidence).getByRole('alert').id)
})

test('redeploy needs the CI confirmation', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(json(200, snapshot()))
    .mockResolvedValueOnce(json(202, { triggered: true, deploymentId: 'dep-1' }))
  global.fetch = fetchMock as jest.Mock
  render(<LaunchReadinessPage />)

  const button = await screen.findByRole('button', { name: 'Redeploy' })
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'The latest commit passed CI' }))
  fireEvent.click(button)
  expect(await screen.findByText(/Coolify accepted the redeploy \(deployment dep-1\)/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenLastCalledWith(
    '/api/admin/deploy',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ confirm: true }) })
  )
})

test('explains how to enable redeploy and reports load errors with a retry', async () => {
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(json(500, {}))
    .mockResolvedValueOnce(json(200, snapshot({ deployConfigured: false, ready: true, checks: [] })))
  global.fetch = fetchMock as jest.Mock
  render(<LaunchReadinessPage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Launch readiness could not be loaded.')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('heading', { name: 'No blocking problems' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Redeploy' })).not.toBeInTheDocument()
  expect(screen.getByText(/Add the Coolify webhook and token/)).toBeInTheDocument()
})
