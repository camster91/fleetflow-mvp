import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/launchReadiness', () => ({
  ...jest.requireActual('@/lib/launchReadiness'),
  launchChecks: jest.fn(),
}))
jest.mock('@/lib/opsAlerts', () => ({ notifyOps: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    opsRecord: { findMany: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import launchHandler from '@/pages/api/admin/launch'
import testAlertHandler from '@/pages/api/admin/launch/test-alert'
import deployHandler from '@/pages/api/admin/deploy'
import { requireTenantContext } from '@/lib/apiAuth'
import { launchChecks } from '@/lib/launchReadiness'
import { notifyOps } from '@/lib/opsAlerts'
import { prisma } from '@/lib/prisma'
import { applySettings } from '@/lib/platformSettings'

const db = prisma as unknown as {
  opsRecord: { findMany: jest.Mock; create: jest.Mock }
  auditLog: { create: jest.Mock }
  $transaction: jest.Mock
}
const sameOrigin = { host: 'app.test', origin: 'http://app.test' }
const ORIGINAL_ENV = process.env
const TOKEN = '7|' + 'T'.repeat(40)

function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'admin-1', name: 'Admin', role } },
    tenant: { ownerId: 'admin-1', teamId: null, role: 'OWNER' },
  })
}

async function call(
  handler: (req: never, res: never) => unknown,
  method: string,
  { body, headers = sameOrigin }: { body?: unknown; headers?: Record<string, string> } = {}
) {
  const { req, res } = createMocks({ method: method as never, headers, body: body as never })
  await handler(req as never, res as never)
  return res
}

const passing = [{ id: 'preflight', label: 'Server configuration', status: 'pass', detail: 'ok' }]
const failing = [{ id: 'email', label: 'Transactional email', status: 'fail', detail: 'no' }]
const record = (overrides: Record<string, unknown> = {}) => ({
  kind: 'backup_drill',
  outcome: 'pass',
  performedAt: new Date(Date.now() - 60_000).toISOString(),
  summary: 'Encrypted backup restored into a scratch container',
  reference: 'a'.repeat(64),
  evidenceUrl: 'https://drive.example.com/evidence',
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.COOLIFY_DEPLOY_WEBHOOK
  delete process.env.COOLIFY_API_TOKEN
  delete process.env.OPS_ALERT_EMAIL
  delete (globalThis as { __fleetveraPlatformSettings?: unknown }).__fleetveraPlatformSettings
  asRole('admin')
  ;(launchChecks as jest.Mock).mockResolvedValue(passing)
  db.opsRecord.findMany.mockResolvedValue([])
  db.opsRecord.create.mockResolvedValue({ id: 'rec-1' })
  db.auditLog.create.mockResolvedValue({})
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
})
afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('/api/admin/launch', () => {
  it.each(['user', 'manager', undefined])('forbids non-platform-admins (%s)', async (role) => {
    asRole(role as string)
    expect((await call(launchHandler, 'GET'))._getStatusCode()).toBe(403)
    expect(launchChecks).not.toHaveBeenCalled()
  })

  it('rejects other methods and cross-site writes', async () => {
    expect((await call(launchHandler, 'DELETE'))._getStatusCode()).toBe(405)
    const res = await call(launchHandler, 'POST', {
      body: record(),
      headers: { host: 'app.test', origin: 'https://evil.test' },
    })
    expect(res._getStatusCode()).toBe(403)
    expect(db.opsRecord.create).not.toHaveBeenCalled()
  })

  it('returns the checks, history and whether redeploy is configured', async () => {
    db.opsRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        kind: 'go_no_go',
        outcome: 'no_go',
        performedAt: new Date('2026-10-01T10:00:00Z'),
        createdAt: new Date('2026-10-01T10:01:00Z'),
        summary: 'Waiting on backups',
      },
    ])
    const res = await call(launchHandler, 'GET')
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toMatchObject({
      mode: 'pilot',
      ready: true,
      checks: passing,
      deployConfigured: false,
      records: [{ id: 'r1', performedAt: '2026-10-01T10:00:00.000Z' }],
    })
  })

  it('records evidence with an audit entry', async () => {
    const res = await call(launchHandler, 'POST', { body: record() })
    expect(res._getStatusCode()).toBe(201)
    expect(db.opsRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'backup_drill',
        outcome: 'pass',
        reference: 'a'.repeat(64),
        recordedById: 'admin-1',
        recordedByName: 'Admin',
      }),
    })
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'OPS_EVIDENCE_RECORDED', entityId: 'rec-1' }),
    })
  })

  it.each([
    [{ performedAt: new Date(Date.now() + 3_600_000).toISOString() }, 'performedAt'],
    [{ summary: 'x' }, 'summary'],
    [{ evidenceUrl: 'http://insecure.example.com' }, 'evidenceUrl'],
    [{ reference: 'has spaces in it' }, 'reference'],
    [{ outcome: 'go' }, 'outcome'],
  ])('names the invalid field (%p)', async (overrides, field) => {
    const res = await call(launchHandler, 'POST', { body: record(overrides) })
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().field).toBe(field)
    expect(db.opsRecord.create).not.toHaveBeenCalled()
  })

  it('accepts blank optional fields', async () => {
    const res = await call(launchHandler, 'POST', { body: record({ reference: '', evidenceUrl: '' }) })
    expect(res._getStatusCode()).toBe(201)
    expect(db.opsRecord.create.mock.calls[0][0].data).not.toHaveProperty('evidenceUrl', '')
  })

  it('refuses a go while a check fails, but records a no-go', async () => {
    ;(launchChecks as jest.Mock).mockResolvedValue(failing)
    const go = await call(launchHandler, 'POST', { body: record({ kind: 'go_no_go', outcome: 'go' }) })
    expect(go._getStatusCode()).toBe(409)
    expect(go._getJSONData().error).toContain('Transactional email')
    const noGo = await call(launchHandler, 'POST', { body: record({ kind: 'go_no_go', outcome: 'no_go' }) })
    expect(noGo._getStatusCode()).toBe(201)
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'LAUNCH_DECISION_RECORDED' }),
    })
  })

  it('records a go when nothing fails', async () => {
    const res = await call(launchHandler, 'POST', { body: record({ kind: 'go_no_go', outcome: 'go' }) })
    expect(res._getStatusCode()).toBe(201)
  })
})

describe('/api/admin/launch/test-alert', () => {
  it('needs an alert address', async () => {
    expect((await call(testAlertHandler, 'POST'))._getStatusCode()).toBe(409)
    expect(notifyOps).not.toHaveBeenCalled()
  })

  it('sends a forced test alert and audits it', async () => {
    process.env.OPS_ALERT_EMAIL = 'ops@example.com'
    ;(notifyOps as jest.Mock).mockResolvedValue('sent')
    const res = await call(testAlertHandler, 'POST')
    expect(res._getStatusCode()).toBe(200)
    expect(notifyOps).toHaveBeenCalledWith('test', 'Test alert', [['Sent by', 'Admin']], { force: true })
    expect(db.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'OPS_ALERT_TESTED' }) })
  })

  it('reports a failed send', async () => {
    process.env.OPS_ALERT_EMAIL = 'ops@example.com'
    ;(notifyOps as jest.Mock).mockResolvedValue('failed')
    expect((await call(testAlertHandler, 'POST'))._getStatusCode()).toBe(502)
  })

  it('is admin-only', async () => {
    asRole('user')
    expect((await call(testAlertHandler, 'POST'))._getStatusCode()).toBe(403)
  })
})

describe('/api/admin/deploy', () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    global.fetch = fetchMock as never
    fetchMock.mockReset()
  })

  it('needs confirmation and configuration', async () => {
    expect((await call(deployHandler, 'POST', { body: {} }))._getStatusCode()).toBe(400)
    expect((await call(deployHandler, 'POST', { body: { confirm: true } }))._getStatusCode()).toBe(409)
    process.env.COOLIFY_DEPLOY_WEBHOOK = 'http://coolify.example.com/api/v1/deploy?uuid=abc'
    process.env.COOLIFY_API_TOKEN = TOKEN
    expect((await call(deployHandler, 'POST', { body: { confirm: true } }))._getStatusCode()).toBe(409)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is admin-only and same-origin', async () => {
    asRole('manager')
    expect((await call(deployHandler, 'POST', { body: { confirm: true } }))._getStatusCode()).toBe(403)
    asRole('admin')
    const res = await call(deployHandler, 'POST', {
      body: { confirm: true },
      headers: { host: 'app.test', origin: 'https://evil.test' },
    })
    expect(res._getStatusCode()).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('when configured', () => {
    beforeEach(() => {
      process.env.COOLIFY_DEPLOY_WEBHOOK = 'https://coolify.example.com/api/v1/deploy?uuid=abc'
      process.env.COOLIFY_API_TOKEN = TOKEN
    })

    it('posts to the webhook with the token, without following redirects', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        json: async () => ({ deployments: [{ deployment_uuid: 'dep-123', message: 'queued' }] }),
      })
      const res = await call(deployHandler, 'POST', { body: { confirm: true } })
      expect(res._getStatusCode()).toBe(202)
      expect(res._getJSONData()).toEqual({ triggered: true, deploymentId: 'dep-123' })
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toBe('https://coolify.example.com/api/v1/deploy?uuid=abc')
      expect(init).toMatchObject({
        method: 'POST',
        redirect: 'error',
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'DEPLOY_TRIGGERED', entityId: 'dep-123' }),
      })
      expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(TOKEN)
    })

    it('never sends an environment token to an admin-entered webhook', async () => {
      applySettings(new Map([['COOLIFY_DEPLOY_WEBHOOK', 'https://attacker.example.com/x']]))
      const res = await call(deployHandler, 'POST', { body: { confirm: true } })
      expect(res._getStatusCode()).toBe(409)
      expect(res._getJSONData().error).toMatch(/same place/)
      expect(fetchMock).not.toHaveBeenCalled()
      applySettings(
        new Map([
          ['COOLIFY_DEPLOY_WEBHOOK', 'https://coolify.example.com/x'],
          ['COOLIFY_API_TOKEN', TOKEN],
        ])
      )
      fetchMock.mockResolvedValue({ status: 200, json: async () => ({}) })
      expect((await call(deployHandler, 'POST', { body: { confirm: true } }))._getStatusCode()).toBe(202)
    })

    it('reports a refusal or an unreachable Coolify without echoing the token', async () => {
      fetchMock.mockResolvedValue({ status: 401, json: async () => ({ message: 'Unauthenticated.' }) })
      const refused = await call(deployHandler, 'POST', { body: { confirm: true } })
      expect(refused._getStatusCode()).toBe(502)
      expect(refused._getJSONData().error).toContain('HTTP 401')
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
      const unreachable = await call(deployHandler, 'POST', { body: { confirm: true } })
      expect(unreachable._getJSONData().error).toBe('Coolify could not be reached.')
      expect(refused._getData() + unreachable._getData()).not.toContain(TOKEN)
      expect(db.auditLog.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ action: 'DEPLOY_FAILED' }),
      })
    })
  })
})
