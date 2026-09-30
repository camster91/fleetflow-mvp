import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformSetting: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import handler from '@/pages/api/admin/settings'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { decryptSetting, encryptSetting } from '@/lib/platformSettings'

const db = prisma as unknown as {
  platformSetting: Record<string, jest.Mock>
  auditLog: { create: jest.Mock }
  $transaction: jest.Mock
}
const sameOrigin = { host: 'app.test', origin: 'http://app.test' }
const ORIGINAL_ENV = process.env
let rows: Array<{ key: string; envelope: string; updatedAt: Date }> = []

function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'admin-1', name: 'Admin', role } },
    tenant: { ownerId: 'admin-1', teamId: null, role: 'OWNER' },
  })
}

async function call(
  method: string,
  {
    body,
    query,
    headers = sameOrigin,
  }: { body?: unknown; query?: Record<string, string>; headers?: Record<string, string> } = {}
) {
  const { req, res } = createMocks({ method: method as never, headers, body: body as never, query })
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...ORIGINAL_ENV, EMAIL_CONFIG_ENCRYPTION_KEY: 'k'.repeat(40) }
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_PRICE_MONTHLY',
    'STRIPE_PRICE_YEARLY',
    'CRON_SECRET',
    'INTEGRATION_ENCRYPTION_KEYS',
  ])
    delete process.env[key]
  delete (globalThis as { __fleetveraPlatformSettings?: unknown }).__fleetveraPlatformSettings
  rows = []
  db.platformSetting.findMany.mockImplementation(async () => rows)
  db.platformSetting.upsert.mockImplementation(async ({ create }: { create: { key: string; envelope: string } }) => {
    rows = [...rows.filter((row) => row.key !== create.key), { ...create, updatedAt: new Date() }]
  })
  db.platformSetting.deleteMany.mockImplementation(async ({ where }: { where: { key: string } }) => {
    rows = rows.filter((row) => row.key !== where.key)
  })
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  asRole('admin')
})
afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('/api/admin/settings', () => {
  it('rejects unsupported methods and cross-site writes', async () => {
    expect((await call('POST'))._getStatusCode()).toBe(405)
    const res = await call('PUT', {
      body: { key: 'CRON_SECRET', value: 'x'.repeat(40) },
      headers: { host: 'app.test', origin: 'https://evil.test' },
    })
    expect(res._getStatusCode()).toBe(403)
    expect(db.platformSetting.upsert).not.toHaveBeenCalled()
  })

  it.each(['user', 'manager', undefined])('forbids non-platform-admins (%s)', async (role) => {
    asRole(role as string)
    const res = await call('GET')
    expect(res._getStatusCode()).toBe(403)
    expect(db.platformSetting.findMany).not.toHaveBeenCalled()
  })

  it('saves an encrypted value, applies it immediately, audits without the value and never echoes secrets', async () => {
    const secret = 'sk_live_' + 'a'.repeat(24)
    const res = await call('PUT', { body: { key: 'STRIPE_SECRET_KEY', value: ` ${secret} ` } })
    expect(res._getStatusCode()).toBe(200)
    const stored = db.platformSetting.upsert.mock.calls[0][0].create
    expect(stored).toMatchObject({ key: 'STRIPE_SECRET_KEY', updatedById: 'admin-1' })
    expect(stored.envelope).not.toContain(secret)
    expect(decryptSetting('STRIPE_SECRET_KEY', stored.envelope)).toBe(secret)
    expect(process.env.STRIPE_SECRET_KEY).toBe(secret)
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'PLATFORM_SETTING_UPDATED', entityId: 'STRIPE_SECRET_KEY' }),
    })
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(secret)
    expect(res._getData()).not.toContain(secret)
    const setting = res._getJSONData().settings.find((item: { key: string }) => item.key === 'STRIPE_SECRET_KEY')
    expect(setting).toMatchObject({ source: 'admin', value: null, mode: 'live' })
  })

  it('rejects unknown keys and invalid values with the field named', async () => {
    expect((await call('PUT', { body: { key: 'DATABASE_URL', value: 'postgresql://x' } }))._getStatusCode()).toBe(400)
    const res = await call('PUT', { body: { key: 'CRON_SECRET', value: 'short' } })
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toMatchObject({ field: 'CRON_SECRET', error: expect.stringContaining('32') })
    expect(db.platformSetting.upsert).not.toHaveBeenCalled()
  })

  it('refuses identical monthly and yearly prices across admin and environment values', async () => {
    process.env.STRIPE_PRICE_YEARLY = 'price_same123'
    const res = await call('PUT', { body: { key: 'STRIPE_PRICE_MONTHLY', value: 'price_same123' } })
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().error).toMatch(/must be different/)
  })

  it('requires the integration keyring before storing integration credentials', async () => {
    const res = await call('PUT', { body: { key: 'QUICKBOOKS_CLIENT_ID', value: 'ABcdefghij12345' } })
    expect(res._getStatusCode()).toBe(409)
    process.env.INTEGRATION_ENCRYPTION_KEYS = `k1:${Buffer.alloc(32, 1).toString('base64')}`
    expect(
      (await call('PUT', { body: { key: 'QUICKBOOKS_CLIENT_ID', value: 'ABcdefghij12345' } }))._getStatusCode()
    ).toBe(200)
  })

  it('returns 503 without an encryption key', async () => {
    delete process.env.EMAIL_CONFIG_ENCRYPTION_KEY
    const res = await call('PUT', { body: { key: 'CRON_SECRET', value: 'x'.repeat(40) } })
    expect(res._getStatusCode()).toBe(503)
  })

  it('clearing a value falls back to the environment and is audited', async () => {
    process.env.CRON_SECRET = 'e'.repeat(40)
    await call('PUT', { body: { key: 'CRON_SECRET', value: 'a'.repeat(40) } })
    expect(process.env.CRON_SECRET).toBe('a'.repeat(40))
    const res = await call('DELETE', { query: { key: 'CRON_SECRET' } })
    expect(res._getStatusCode()).toBe(200)
    expect(process.env.CRON_SECRET).toBe('e'.repeat(40))
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ action: 'PLATFORM_SETTING_CLEARED', entityId: 'CRON_SECRET' }),
    })
    const setting = res._getJSONData().settings.find((item: { key: string }) => item.key === 'CRON_SECRET')
    expect(setting).toMatchObject({ source: 'environment', value: null })
  })

  it('lists stored settings with their source', async () => {
    rows = [
      {
        key: 'STRIPE_PRICE_MONTHLY',
        envelope: encryptSetting('STRIPE_PRICE_MONTHLY', 'price_admin1'),
        updatedAt: new Date(),
      },
    ]
    const res = await call('GET')
    expect(res._getStatusCode()).toBe(200)
    const setting = res._getJSONData().settings.find((item: { key: string }) => item.key === 'STRIPE_PRICE_MONTHLY')
    expect(setting).toMatchObject({ source: 'admin', value: 'price_admin1' })
  })
})
