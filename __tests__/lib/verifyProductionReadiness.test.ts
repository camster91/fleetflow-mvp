const { evaluateEnvironment } = require('../../scripts/verify-production-readiness.cjs') as { evaluateEnvironment: (env: Record<string, string>, mode?: string) => { ready: boolean; missing: string[]; warnings: string[] } }

const core = {
  DATABASE_URL: 'postgresql://user:password@db:5432/fleetvera',
  JWT_SECRET: 'a'.repeat(32),
  NEXTAUTH_URL: 'https://fleetflow.ashbi.ca',
  API_CURSOR_SECRET: 'b'.repeat(32),
  ACTION_PREVIEW_KEYS: JSON.stringify({ current: 'c'.repeat(32) }),
  ACTION_PREVIEW_CURRENT_KID: 'current',
  CRON_SECRET: 'd'.repeat(32),
  MAILGUN_API_KEY: 'mailgun-key',
  MAILGUN_DOMAIN: 'mg.example.com',
  EMAIL_FROM: 'Fleetvera <noreply@mg.example.com>',
  EMAIL_CONFIG_ENCRYPTION_KEY: 'e'.repeat(32),
}

describe('verify-production-readiness', () => {
  it('accepts a minimally configured controlled pilot without optional providers', () => {
    expect(evaluateEnvironment(core)).toEqual({ mode: 'pilot', ready: true, missing: [], warnings: [] })
  })

  it('requires live billing configuration for a public launch', () => {
    const result = evaluateEnvironment(core, 'public')
    expect(result.ready).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining(['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']))
  })

  it('fails closed for weak secrets, insecure URLs, and malformed action keys without exposing values', () => {
    const result = evaluateEnvironment({ ...core, JWT_SECRET: 'weak', NEXTAUTH_URL: 'http://localhost:3000', ACTION_PREVIEW_KEYS: '{oops' })
    expect(result.ready).toBe(false)
    expect(result.missing.join(' ')).toContain('JWT_SECRET must be at least 32 characters')
    expect(result.missing.join(' ')).toContain('NEXTAUTH_URL must use https')
    expect(result.missing.join(' ')).not.toContain('weak')
  })

  it('requires an AES-256-GCM key ring if an integration is configured', () => {
    const result = evaluateEnvironment({ ...core, GOOGLE_MAPS_SERVER_API_KEY: 'configured', INTEGRATION_ENCRYPTION_KEYS: 'bad:not-base64' })
    expect(result.ready).toBe(false)
    expect(result.missing).toContain('INTEGRATION_ENCRYPTION_KEYS must contain AES-256-GCM keys')
  })
})
