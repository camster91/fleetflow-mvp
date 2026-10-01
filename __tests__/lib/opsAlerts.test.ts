jest.mock('@/lib/email', () => ({ sendOpsAlertEmail: jest.fn() }))

import { createMocks } from 'node-mocks-http'
import { sendOpsAlertEmail } from '@/lib/email'
import {
  ALERT_THROTTLE_MS,
  errorLabel,
  notifyOps,
  reportRequestError,
  resetOpsAlertThrottle,
  withCronAlerts,
} from '@/lib/opsAlerts'

const send = sendOpsAlertEmail as jest.Mock
const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  resetOpsAlertThrottle()
  process.env = { ...ORIGINAL_ENV, OPS_ALERT_EMAIL: 'ops@example.com' }
  send.mockResolvedValue({ success: true })
})
afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('notifyOps', () => {
  it('does nothing without an alert address', async () => {
    delete process.env.OPS_ALERT_EMAIL
    expect(await notifyOps('k', 'Title', [])).toBe('unconfigured')
    expect(send).not.toHaveBeenCalled()
  })

  it('emails once per problem per 30 minutes, unless forced', async () => {
    const now = Date.UTC(2026, 9, 1, 12)
    expect(await notifyOps('k', 'Title', [['Job', 'x']], { now })).toBe('sent')
    expect(send).toHaveBeenCalledWith('ops@example.com', 'Title', [
      ['Job', 'x'],
      ['Time (UTC)', '2026-10-01T12:00:00.000Z'],
    ])
    expect(await notifyOps('k', 'Title', [], { now: now + 60_000 })).toBe('throttled')
    expect(await notifyOps('other', 'Title', [], { now: now + 60_000 })).toBe('sent')
    expect(await notifyOps('k', 'Title', [], { now: now + 60_000, force: true })).toBe('sent')
    expect(await notifyOps('k', 'Title', [], { now: now + 60_000 + ALERT_THROTTLE_MS })).toBe('sent')
    expect(send).toHaveBeenCalledTimes(4)
  })

  it('reports a failed send', async () => {
    send.mockResolvedValue({ success: false })
    expect(await notifyOps('k', 'Title', [])).toBe('failed')
    send.mockRejectedValue(new Error('boom'))
    expect(await notifyOps('k2', 'Title', [])).toBe('failed')
  })

  it('does not hold back the next attempt after a failed send', async () => {
    send.mockResolvedValueOnce({ success: false })
    expect(await notifyOps('k', 'Title', [], { now: 1_000 })).toBe('failed')
    expect(await notifyOps('k', 'Title', [], { now: 2_000 })).toBe('sent')
    expect(await notifyOps('k', 'Title', [], { now: 3_000 })).toBe('throttled')
  })
})

describe('errorLabel', () => {
  it('returns class names and Prisma codes, never messages', () => {
    expect(errorLabel(new TypeError('customer@example.com is invalid'))).toBe('TypeError')
    expect(errorLabel(Object.assign(new Error('x'), { code: 'P2002' }))).toBe('Prisma P2002')
    const odd = new Error('x')
    odd.name = 'name with secret value'
    expect(errorLabel(odd)).toBe('Error')
    expect(errorLabel('a string')).toBe('Error')
  })
})

describe('withCronAlerts', () => {
  const run = async (handler: Parameters<typeof withCronAlerts>[1]) => {
    const { req, res } = createMocks({ method: 'POST' })
    await withCronAlerts('pilot-retention', handler)(req as never, res as never)
    return res
  }

  it('alerts on a 5xx response', async () => {
    await run(async (_req, res) => res.status(500).json({ error: 'failed' }))
    expect(send).toHaveBeenCalledWith('ops@example.com', 'Scheduled job pilot-retention failed', [
      ['Job', 'pilot-retention'],
      ['HTTP status', '500'],
      ['Time (UTC)', expect.any(String)],
    ])
  })

  it('alerts on a thrown error and rethrows it', async () => {
    await expect(
      run(async () => {
        throw new RangeError('row 42 of customer data')
      })
    ).rejects.toThrow(RangeError)
    expect(JSON.stringify(send.mock.calls)).not.toContain('customer data')
    expect(send.mock.calls[0][2]).toContainEqual(['Error', 'RangeError'])
  })

  it('stays quiet for success and refused requests', async () => {
    await run(async (_req, res) => res.status(200).json({ ok: true }))
    await run(async (_req, res) => res.status(401).json({ error: 'Unauthorized' }))
    expect(send).not.toHaveBeenCalled()
  })
})

describe('reportRequestError', () => {
  it('uses the route template, never the URL or message', async () => {
    await reportRequestError(
      new Error('secret token abc'),
      { method: 'GET' },
      { routePath: '/api/vehicles/[id]', routeType: 'route' }
    )
    expect(send).toHaveBeenCalledWith('ops@example.com', 'Server error on /api/vehicles/[id]', [
      ['Route', '/api/vehicles/[id]'],
      ['Method', 'GET'],
      ['Kind', 'route'],
      ['Error', 'Error'],
      ['Time (UTC)', expect.any(String)],
    ])
    expect(JSON.stringify(send.mock.calls)).not.toContain('secret token')
  })

  it('leaves cron routes to withCronAlerts so one crash sends one email', async () => {
    await reportRequestError(new Error('x'), { method: 'POST' }, { routePath: '/api/cron/ai-retention' })
    expect(send).not.toHaveBeenCalled()
  })
})
