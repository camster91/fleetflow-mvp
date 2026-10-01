jest.mock('@/lib/prisma', () => ({
  prisma: { opsRecord: { findFirst: jest.fn() }, $queryRaw: jest.fn() },
}))
jest.mock('@/lib/emailConfig', () => ({ configuredMailgun: jest.fn() }))

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { configuredMailgun } from '@/lib/emailConfig'
import { blockingChecks, evidenceCheck, launchChecks } from '@/lib/launchReadiness'

const { BURNED_SECRET_SHA256 } = require('../../scripts/verify-production-readiness.cjs') as {
  BURNED_SECRET_SHA256: Set<string>
}

const db = prisma as unknown as { opsRecord: { findFirst: jest.Mock }; $queryRaw: jest.Mock }
const now = new Date('2026-10-01T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

const readyEnv = (): NodeJS.ProcessEnv =>
  ({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://db',
    JWT_SECRET: 'j'.repeat(40),
    NEXTAUTH_URL: 'https://app.example.com',
    API_CURSOR_SECRET: 'c'.repeat(40),
    ACTION_PREVIEW_KEYS: JSON.stringify({ k1: 'p'.repeat(40) }),
    ACTION_PREVIEW_CURRENT_KID: 'k1',
    EMAIL_CONFIG_ENCRYPTION_KEY: 'e'.repeat(40),
    TOKEN_ENCRYPTION_KEY: 't'.repeat(40),
    CRON_SECRET: 'r'.repeat(40),
    NEXT_PUBLIC_SENTRY_DSN: 'https://key@sentry.example.com/1',
    OPS_ALERT_EMAIL: 'ops@example.com',
  }) as NodeJS.ProcessEnv

const passed = (days: number) => ({ outcome: 'pass', performedAt: daysAgo(days), recordedByName: 'Ops' })

beforeEach(() => {
  jest.clearAllMocks()
  db.$queryRaw.mockResolvedValue([{ failed: 0 }])
  ;(configuredMailgun as jest.Mock).mockResolvedValue({ domain: 'mg.example.com' })
  db.opsRecord.findFirst.mockImplementation(async ({ where }: { where: { kind: string } }) =>
    where.kind === 'go_no_go' ? null : passed(1)
  )
})

const byId = (checks: Awaited<ReturnType<typeof launchChecks>>) => Object.fromEntries(checks.map((c) => [c.id, c]))

describe('evidenceCheck', () => {
  it('fails without evidence or after a failed drill, warns when stale, passes when recent', () => {
    expect(evidenceCheck('b', 'Backup', 'backup_drill', null, now).status).toBe('fail')
    expect(evidenceCheck('b', 'Backup', 'backup_drill', { ...passed(1), outcome: 'fail' }, now).detail).toMatch(
      /failed/
    )
    expect(evidenceCheck('b', 'Backup', 'backup_drill', passed(8), now).status).toBe('warn')
    expect(evidenceCheck('b', 'Backup', 'backup_drill', passed(6), now)).toMatchObject({
      status: 'pass',
      detail: 'Passed on 2026-09-25 (Ops).',
    })
    expect(evidenceCheck('r', 'Restore', 'restore_drill', passed(60), now).status).toBe('pass')
  })
})

describe('launchChecks', () => {
  it('passes a fully configured pilot, with billing and redeploy only as warnings', async () => {
    const checks = byId(await launchChecks(readyEnv(), now))
    expect(blockingChecks(Object.values(checks))).toEqual([])
    expect(checks['leaked-secrets'].status).toBe('pass')
    expect(checks.preflight.status).toBe('pass')
    expect(checks.email).toMatchObject({ status: 'pass', detail: 'Mailgun sends from mg.example.com.' })
    expect(checks.billing.status).toBe('warn')
    expect(checks.deploy.status).toBe('warn')
    expect(checks.decision).toMatchObject({ status: 'warn', detail: 'No decision recorded yet.' })
  })

  it('names a leaked secret without revealing it', async () => {
    const leaked = 'synthetic-leaked-value-for-tests-only-0000'
    const hash = crypto.createHash('sha256').update(leaked).digest('hex')
    BURNED_SECRET_SHA256.add(hash)
    try {
      const checks = await launchChecks({ ...readyEnv(), JWT_SECRET: leaked }, now)
      const secrets = byId(checks)['leaked-secrets']
      expect(secrets).toMatchObject({ status: 'fail', items: ['JWT_SECRET'], issue: 30 })
      expect(byId(checks).preflight.status).toBe('pass')
      expect(JSON.stringify(checks)).not.toContain(leaked)
    } finally {
      BURNED_SECRET_SHA256.delete(hash)
    }
  })

  it('fails on missing configuration, email, monitoring and backups', async () => {
    ;(configuredMailgun as jest.Mock).mockResolvedValue(null)
    db.opsRecord.findFirst.mockResolvedValue(null)
    db.$queryRaw.mockResolvedValue([{ failed: 1 }])
    const env = readyEnv()
    delete env.NEXT_PUBLIC_SENTRY_DSN
    delete env.OPS_ALERT_EMAIL
    const checks = byId(await launchChecks(env, now))
    expect(checks.preflight.items).toContain('NEXT_PUBLIC_SENTRY_DSN must be a valid https URL')
    expect(checks.email.status).toBe('fail')
    expect(checks.sentry.status).toBe('fail')
    expect(checks.alerts.status).toBe('warn')
    expect(checks.backup.status).toBe('fail')
    expect(checks.database.status).toBe('fail')
    expect(blockingChecks(Object.values(checks)).map((check) => check.id)).not.toContain('decision')
  })

  it('requires billing in public mode and flags a test key there', async () => {
    const env = { ...readyEnv(), FLEETVERA_RELEASE_MODE: 'public', FLEETVERA_BETA_ENDS_AT: '2027-01-01' }
    expect(byId(await launchChecks(env, now)).billing.status).toBe('fail')
    const billing = {
      STRIPE_SECRET_KEY: 'sk_test_abcdefghijkl',
      STRIPE_WEBHOOK_SECRET: 'whsec_abcdefghijkl',
      STRIPE_PRICE_MONTHLY: 'price_monthly1',
      STRIPE_PRICE_YEARLY: 'price_yearly1',
      STRIPE_PRICE_MONTHLY_AMOUNT: '4900',
      STRIPE_PRICE_YEARLY_AMOUNT: '49000',
      STRIPE_PRICE_CURRENCY: 'CAD',
    }
    expect(byId(await launchChecks({ ...env, ...billing }, now)).billing.status).toBe('warn')
    const live = { ...env, ...billing, STRIPE_SECRET_KEY: 'sk_live_abcdefghijkl' }
    expect(byId(await launchChecks(live, now)).billing).toMatchObject({
      status: 'pass',
      detail: 'Configured in live mode.',
    })
  })

  it('reports an unreadable Mailgun config and a database error', async () => {
    ;(configuredMailgun as jest.Mock).mockRejectedValue(new Error('decrypt'))
    db.$queryRaw.mockRejectedValue(new Error('down'))
    const checks = byId(await launchChecks(readyEnv(), now))
    expect(checks.email.detail).toMatch(/cannot be decrypted/)
    expect(checks.database.status).toBe('fail')
  })

  it('shows the latest decision', async () => {
    db.opsRecord.findFirst.mockImplementation(async ({ where }: { where: { kind: string } }) =>
      where.kind === 'go_no_go' ? { outcome: 'go', performedAt: daysAgo(0), recordedByName: 'Cam' } : passed(1)
    )
    expect(byId(await launchChecks(readyEnv(), now)).decision).toMatchObject({
      status: 'pass',
      detail: 'Go recorded on 2026-10-01 by Cam.',
    })
  })
})
