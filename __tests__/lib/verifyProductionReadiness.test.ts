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
  TOKEN_ENCRYPTION_KEY: 'f'.repeat(32),
  NEXT_PUBLIC_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123',
}

describe('verify-production-readiness', () => {
  it('requires an explicit TOKEN_ENCRYPTION_KEY so 2FA seeds are not tied to JWT_SECRET', () => {
    const { TOKEN_ENCRYPTION_KEY: _omit, ...withoutKey } = core
    const result = evaluateEnvironment(withoutKey)
    expect(result.ready).toBe(false)
    expect(result.missing.some(message => message.startsWith('TOKEN_ENCRYPTION_KEY'))).toBe(true)
    expect(evaluateEnvironment({ ...core, TOKEN_ENCRYPTION_KEY: 'short' }).ready).toBe(false)
  })

  it('fails when the test-only E2E mail capture is configured', () => {
    const result = evaluateEnvironment({ ...core, E2E_EMAIL_CAPTURE_DIR: '/tmp/mail' })
    expect(result.ready).toBe(false)
    expect(result.missing).toContain('E2E_EMAIL_CAPTURE_DIR must not be set outside local end-to-end tests')
  })

  it('accepts a minimally configured controlled pilot without optional providers', () => {
    expect(evaluateEnvironment(core)).toEqual({ mode: 'pilot', ready: true, missing: [], warnings: [] })
  })

  it('requires live billing configuration for a public launch', () => {
    const result = evaluateEnvironment(core, 'public')
    expect(result.ready).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining([
      'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY',
      'STRIPE_PRICE_MONTHLY_AMOUNT', 'STRIPE_PRICE_YEARLY_AMOUNT', 'STRIPE_PRICE_CURRENCY',
    ]))
  })

  it('accepts only the billing configuration consumed by checkout', () => {
    const billing = {
      ...core,
      STRIPE_SECRET_KEY: 'sk_configured',
      STRIPE_WEBHOOK_SECRET: 'whsec_configured',
      STRIPE_PRICE_MONTHLY: 'price_monthly',
      STRIPE_PRICE_YEARLY: 'price_yearly',
      STRIPE_PRICE_MONTHLY_AMOUNT: '4900',
      STRIPE_PRICE_YEARLY_AMOUNT: '49000',
      STRIPE_PRICE_CURRENCY: 'cad',
    }
    expect(evaluateEnvironment(billing, 'public').ready).toBe(true)

    const invalid = evaluateEnvironment({ ...billing, STRIPE_PRICE_YEARLY: 'price_monthly' }, 'public')
    expect(invalid.ready).toBe(false)
    expect(invalid.missing).toContain('Stripe price IDs, integer minor-unit amounts, and currency must be valid')
  })

  it('fails closed for weak secrets, insecure URLs, and malformed action keys without exposing values', () => {
    const result = evaluateEnvironment({ ...core, JWT_SECRET: 'weak', NEXTAUTH_URL: 'http://localhost:3000', ACTION_PREVIEW_KEYS: '{oops' })
    expect(result.ready).toBe(false)
    expect(result.missing.join(' ')).toContain('JWT_SECRET must be at least 32 characters')
    expect(result.missing.join(' ')).toContain('NEXTAUTH_URL must be a canonical https origin')
    expect(result.missing.join(' ')).not.toContain('weak')
  })

  it.each([
    'https://user:pass@fleetvera.example',
    'https://fleetvera.example?redirect=evil',
    'https://fleetvera.example#fragment',
    'https://fleetvera.example/path',
  ])('rejects unsafe canonical application URL %s', value => {
    const result = evaluateEnvironment({ ...core, NEXTAUTH_URL: value })
    expect(result.ready).toBe(false)
    expect(result.missing).toContain('NEXTAUTH_URL must be a canonical https origin')
  })

  it('requires an HTTPS monitoring DSN for pilot and public releases', () => {
    const missing = evaluateEnvironment({ ...core, NEXT_PUBLIC_SENTRY_DSN: '' })
    expect(missing.ready).toBe(false)
    expect(missing.missing).toContain('NEXT_PUBLIC_SENTRY_DSN must be a valid https URL')

    const insecure = evaluateEnvironment({ ...core, NEXT_PUBLIC_SENTRY_DSN: 'http://monitoring.example/123' })
    expect(insecure.ready).toBe(false)
    expect(insecure.missing).toContain('NEXT_PUBLIC_SENTRY_DSN must be a valid https URL')
  })

  it('requires an AES-256-GCM key ring if an integration is configured', () => {
    const result = evaluateEnvironment({ ...core, GOOGLE_MAPS_SERVER_API_KEY: 'configured', INTEGRATION_ENCRYPTION_KEYS: 'bad:not-base64' })
    expect(result.ready).toBe(false)
    expect(result.missing).toContain('INTEGRATION_ENCRYPTION_KEYS must contain AES-256-GCM keys')
  })
})
