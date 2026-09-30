jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import {
  applySettings,
  decryptSetting,
  describeSettings,
  encryptSetting,
  environmentValue,
  refreshPlatformSettings,
  REFRESH_INTERVAL_MS,
  settingDefinition,
} from '@/lib/platformSettings'

const ORIGINAL_ENV = process.env
const MANAGED = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_MONTHLY', 'CRON_SECRET', 'OPENAI_API_KEY', 'AI_PROVIDER']

function dbWith(rows: Array<{ key: string; envelope: string }>) {
  return {
    platformSetting: {
      findMany: jest
        .fn()
        .mockResolvedValue(rows.map((row) => ({ ...row, updatedAt: new Date('2026-09-30T00:00:00Z') }))),
    },
  } as never
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, EMAIL_CONFIG_ENCRYPTION_KEY: 'k'.repeat(40) }
  for (const key of MANAGED) delete process.env[key]
  delete (globalThis as { __fleetveraPlatformSettings?: unknown }).__fleetveraPlatformSettings
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})
afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('setting envelopes', () => {
  it('round-trips a value and binds it to its setting name', () => {
    const envelope = encryptSetting('STRIPE_SECRET_KEY', 'sk_test_abcdefghijkl')
    expect(envelope).toMatch(/^setting-v1:/)
    expect(envelope).not.toContain('abcdefghijkl')
    expect(decryptSetting('STRIPE_SECRET_KEY', envelope)).toBe('sk_test_abcdefghijkl')
    expect(() => decryptSetting('OPENAI_API_KEY', envelope)).toThrow('could not be authenticated')
  })

  it('rejects a changed encryption key and a missing one', () => {
    const envelope = encryptSetting('CRON_SECRET', 'c'.repeat(40))
    process.env.EMAIL_CONFIG_ENCRYPTION_KEY = 'z'.repeat(40)
    expect(() => decryptSetting('CRON_SECRET', envelope)).toThrow()
    delete process.env.EMAIL_CONFIG_ENCRYPTION_KEY
    expect(() => encryptSetting('CRON_SECRET', 'c'.repeat(40))).toThrow('EMAIL_CONFIG_ENCRYPTION_KEY')
  })
})

describe('validation', () => {
  const check = (key: string, value: string) => settingDefinition(key)!.schema.safeParse(value).success
  it('accepts provider-shaped values and rejects others', () => {
    expect(check('STRIPE_SECRET_KEY', 'sk_live_abcdefghijklmnop')).toBe(true)
    expect(check('STRIPE_SECRET_KEY', 'pk_live_abcdefghijklmnop')).toBe(false)
    expect(check('STRIPE_WEBHOOK_SECRET', 'whsec_abcdefghijklmnop')).toBe(true)
    expect(check('STRIPE_PRICE_MONTHLY', 'price_1Abcdef')).toBe(true)
    expect(check('STRIPE_PRICE_MONTHLY_AMOUNT', '49.00')).toBe(false)
    expect(settingDefinition('STRIPE_PRICE_CURRENCY')!.schema.parse(' cad ')).toBe('CAD')
    expect(check('STRIPE_PRICE_CURRENCY', 'JPY')).toBe(false)
    expect(check('QUICKBOOKS_REDIRECT_URI', 'http://example.com/cb')).toBe(false)
    expect(check('QUICKBOOKS_REDIRECT_URI', 'https://app.example.com/api/integrations/quickbooks/callback')).toBe(true)
    expect(check('OPENAI_API_KEY', 'sk-proj-' + 'a'.repeat(40))).toBe(true)
    expect(check('AI_PROVIDER', 'anthropic')).toBe(false)
    expect(check('CRON_SECRET', 'short')).toBe(false)
    expect(check('CRON_SECRET', 'x'.repeat(32))).toBe(true)
    expect(settingDefinition('DATABASE_URL')).toBeUndefined()
  })
})

describe('environment overlay', () => {
  it('lets admin values win and restores the environment when they are removed', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fromenvironment'
    applySettings(
      new Map([
        ['STRIPE_SECRET_KEY', 'sk_live_fromadmin12345'],
        ['CRON_SECRET', 'c'.repeat(32)],
      ])
    )
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_live_fromadmin12345')
    expect(process.env.CRON_SECRET).toBe('c'.repeat(32))
    expect(environmentValue('STRIPE_SECRET_KEY')).toBe('sk_test_fromenvironment')
    expect(environmentValue('CRON_SECRET')).toBeUndefined()

    applySettings(new Map([['STRIPE_SECRET_KEY', 'sk_live_second1234567']]))
    expect(environmentValue('STRIPE_SECRET_KEY')).toBe('sk_test_fromenvironment')
    expect('CRON_SECRET' in process.env).toBe(false)

    applySettings(new Map())
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_test_fromenvironment')
  })

  it('ignores unmanaged keys', () => {
    process.env.DATABASE_URL = 'postgresql://original'
    applySettings(new Map([['DATABASE_URL', 'postgresql://evil']]))
    expect(process.env.DATABASE_URL).toBe('postgresql://original')
  })
})

describe('refreshPlatformSettings', () => {
  it('applies stored values, skips unknown keys, and falls back to the environment for undecryptable ones', async () => {
    process.env.OPENAI_API_KEY = 'sk-environment'
    const db = dbWith([
      { key: 'CRON_SECRET', envelope: encryptSetting('CRON_SECRET', 'a'.repeat(40)) },
      { key: 'OPENAI_API_KEY', envelope: encryptSetting('STRIPE_SECRET_KEY', 'sk-moved') },
      { key: 'DATABASE_URL', envelope: encryptSetting('DATABASE_URL', 'postgresql://evil') },
    ])
    await refreshPlatformSettings({ db }, 1_000)
    expect(process.env.CRON_SECRET).toBe('a'.repeat(40))
    expect(process.env.OPENAI_API_KEY).toBe('sk-environment')
    expect(process.env.DATABASE_URL).not.toBe('postgresql://evil')
    expect(console.warn).toHaveBeenCalledWith(expect.not.stringContaining('sk-moved'))
  })

  it('reloads at most once a minute unless forced', async () => {
    const db = dbWith([])
    await refreshPlatformSettings({ db }, 1_000)
    await refreshPlatformSettings({ db }, 1_000 + REFRESH_INTERVAL_MS - 1)
    expect((db as { platformSetting: { findMany: jest.Mock } }).platformSetting.findMany).toHaveBeenCalledTimes(1)
    await refreshPlatformSettings({ db, force: true }, 1_001)
    await refreshPlatformSettings({ db }, 1_000 + REFRESH_INTERVAL_MS + 1)
    expect((db as { platformSetting: { findMany: jest.Mock } }).platformSetting.findMany).toHaveBeenCalledTimes(3)
  })

  it('keeps current values when the database is unavailable', async () => {
    await refreshPlatformSettings(
      { db: dbWith([{ key: 'CRON_SECRET', envelope: encryptSetting('CRON_SECRET', 'b'.repeat(40)) }]) },
      1
    )
    const failing = { platformSetting: { findMany: jest.fn().mockRejectedValue(new Error('down')) } } as never
    await expect(refreshPlatformSettings({ db: failing, force: true }, 2)).rejects.toThrow('down')
    expect(process.env.CRON_SECRET).toBe('b'.repeat(40))
  })
})

describe('describeSettings', () => {
  it('reports sources and never returns secret values', () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_fromenv'
    process.env.OPENAI_API_KEY = 'sk-environment-value'
    const updatedAt = new Date('2026-09-30T00:00:00Z')
    const settings = describeSettings([
      { key: 'STRIPE_SECRET_KEY', value: 'sk_live_adminvalue123', updatedAt },
      { key: 'CRON_SECRET', value: null, updatedAt },
    ])
    const byKey = Object.fromEntries(settings.map((setting) => [setting.key, setting]))
    expect(byKey.STRIPE_SECRET_KEY).toMatchObject({
      source: 'admin',
      value: null,
      mode: 'live',
      environmentFallback: false,
    })
    expect(byKey.STRIPE_PRICE_MONTHLY).toMatchObject({ source: 'environment', value: 'price_fromenv' })
    expect(byKey.OPENAI_API_KEY).toMatchObject({ source: 'environment', value: null, environmentFallback: true })
    expect(byKey.CRON_SECRET).toMatchObject({ source: 'unreadable', value: null })
    expect(byKey.GOOGLE_MAPS_SERVER_API_KEY).toMatchObject({ source: 'unset', value: null })
    expect(JSON.stringify(settings)).not.toMatch(/adminvalue|environment-value/)
  })
})
