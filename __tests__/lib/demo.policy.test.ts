import { assertDemoEnvironment, demoEnabled, demoRouteAllowed } from '@/lib/demo/policy'
import { evaluateDemoEnvironment } from '../../scripts/verify-demo-config.cjs'

const env = {
  FLEETVERA_DEMO_MODE: 'true',
  FLEETVERA_RELEASE_MODE: 'pilot',
  DATABASE_URL: 'postgresql://demo:password@postgres:5432/fleetvera_demo',
  NEXTAUTH_URL: 'https://demo.example',
  JWT_SECRET: 'j'.repeat(40),
  API_CURSOR_SECRET: 'c'.repeat(40),
  EMAIL_CONFIG_ENCRYPTION_KEY: 'e'.repeat(40),
  TOKEN_ENCRYPTION_KEY: 't'.repeat(40),
  ACTION_PREVIEW_KEYS: JSON.stringify({ 'demo-v1': 'a'.repeat(40) }),
  ACTION_PREVIEW_CURRENT_KID: 'demo-v1',
}
test('demo is explicitly off by default', () => expect(demoEnabled({})).toBe(false))
test('demo accepts only its dedicated database and pilot mode', () => {
  expect(() => assertDemoEnvironment(env)).not.toThrow()
  expect(() => assertDemoEnvironment({ ...env, DATABASE_URL: 'postgresql://user@postgres/fleetflow' })).toThrow()
  expect(() =>
    assertDemoEnvironment({ ...env, DATABASE_URL: 'postgresql://user@postgres/fleetvera_rebuild_production' })
  ).toThrow()
  expect(() => assertDemoEnvironment({ ...env, FLEETVERA_RELEASE_MODE: 'public' })).toThrow()
})
test.each([
  'STRIPE_SECRET_KEY',
  'MAILGUN_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_MAPS_SERVER_API_KEY',
  'QUICKBOOKS_CLIENT_SECRET',
  'COOLIFY_REDEPLOY_WEBHOOK',
  'OPS_ALERT_EMAIL',
])('refuses real provider configuration %s', (key) => {
  expect(() => assertDemoEnvironment({ ...env, [key]: 'configured' })).toThrow()
  expect(evaluateDemoEnvironment({ ...env, [key]: 'configured' }).ready).toBe(false)
})
test('pre-migration preflight requires canonical TLS and independent secrets', () => {
  expect(evaluateDemoEnvironment(env).ready).toBe(true)
  expect(evaluateDemoEnvironment({ ...env, JWT_SECRET: '', NEXTAUTH_URL: 'http://demo.example' }).ready).toBe(false)
})
test.each([
  '/api/admin/users',
  '/api/admin/deploy',
  '/api/auth/send-code',
  '/api/auth/login',
  '/api/auth/2fa/setup',
  '/api/team/invite',
  '/api/team/accept-invite',
  '/api/settings/api-keys',
  '/api/stripe/checkout-session',
  '/api/stripe/webhook',
  '/api/integrations/quickbooks/connect',
  '/api/integrations/quickbooks/callback',
  '/api/integrations/google-maps/sync',
  '/api/documents/upload',
  '/api/new-unreviewed-endpoint',
])('denies side effects and unknown writes: %s', (path) => expect(demoRouteAllowed(path, 'POST')).toBe(false))
test.each([
  '/api/vehicles',
  '/api/deliveries/123/status',
  '/api/maintenance',
  '/api/assistant/query',
  '/api/assistant/actions/execute',
  '/api/demo/start',
  '/api/demo/role',
  '/api/demo/reset',
])('allows scoped sample workflows: %s', (path) => expect(demoRouteAllowed(path, 'POST')).toBe(true))
test.each([
  '/api/admin/settings',
  '/api/auth/security-settings',
  '/api/settings/api-keys',
  '/api/v1/vehicles',
  '/api/new-endpoint',
])('denies unreviewed reads: %s', (path) => expect(demoRouteAllowed(path, 'GET')).toBe(false))
