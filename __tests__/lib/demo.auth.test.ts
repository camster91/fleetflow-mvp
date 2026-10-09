import { getUserFromRequest, signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() }, demoSession: { findUnique: jest.fn() } },
}))
const original = { ...process.env }
beforeEach(() => {
  process.env.FLEETVERA_DEMO_MODE = 'true'
  process.env.FLEETVERA_RELEASE_MODE = 'pilot'
  process.env.DATABASE_URL = 'postgresql://demo@postgres/fleetvera_demo'
  process.env.JWT_SECRET = 'test-only-demo-signing-secret'.repeat(3)
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'MAILGUN_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_MAPS_SERVER_API_KEY',
    'QUICKBOOKS_CLIENT_SECRET',
    'COOLIFY_REDEPLOY_WEBHOOK',
    'OPS_ALERT_EMAIL',
  ])
    delete process.env[key]
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    email: 'sample@example.invalid',
    name: 'Sample',
    role: 'OWNER',
    tokenVersion: 0,
    onboardingCompleted: true,
  })
  ;(prisma.demoSession.findUnique as jest.Mock).mockResolvedValue({
    id: 'demo-1',
    userIds: ['sample-1'],
    expiresAt: new Date(Date.now() + 60000),
  })
})
afterEach(() => {
  process.env = { ...original }
  jest.clearAllMocks()
})
async function request(sub = 'sample-1', demoSessionId: string | null = 'demo-1') {
  const token = await signToken({
    sub,
    email: 'sample@example.invalid',
    name: 'Sample',
    role: 'OWNER',
    ...(demoSessionId ? { demoSessionId } : {}),
  })
  return { headers: { cookie: `token=${token}` } } as any
}
test('accepts only a live demo session member', async () =>
  expect((await getUserFromRequest(await request()))?.demoSessionId).toBe('demo-1'))
test('rejects a user from another visitor session', async () =>
  expect(await getUserFromRequest(await request('foreign'))).toBeNull())
test('rejects expired demos even when the JWT remains valid', async () => {
  ;(prisma.demoSession.findUnique as jest.Mock).mockResolvedValue({ userIds: ['sample-1'], expiresAt: new Date(0) })
  expect(await getUserFromRequest(await request())).toBeNull()
})
test('ordinary session tokens cannot enter a demo', async () =>
  expect(await getUserFromRequest(await request('sample-1', null))).toBeNull())
test('demo tokens cannot enter the ordinary app', async () => {
  delete process.env.FLEETVERA_DEMO_MODE
  expect(await getUserFromRequest(await request())).toBeNull()
})
