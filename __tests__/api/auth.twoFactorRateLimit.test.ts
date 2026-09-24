import { createMocks } from 'node-mocks-http'

// Real limiter (lib/rateLimit is intentionally NOT mocked here).
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'secret') }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('speakeasy', () => ({
  __esModule: true,
  default: { totp: { verifyDelta: jest.fn(() => undefined) } },
}))
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ sub: 'rate-limited-user', purpose: 'two-factor' })),
  signToken: jest.fn(() => 'session-token'),
  tokenVersionOf: jest.requireActual('@/lib/auth').tokenVersionOf,
}))

import handler from '@/pages/api/auth/2fa/validate'
import { prisma } from '@/lib/prisma'

describe('POST /api/auth/2fa/validate rate limiting', () => {
  it('limits one challenge after 5 attempts even when X-Forwarded-For rotates', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'rate-limited-user', email: 'user@example.com', name: 'User', role: 'fleet_manager',
      twoFactorEnabled: true, twoFactorSecret: 'encrypted', backupCodes: '[]',
      tokenVersion: 0, lastTotpStep: null, failedLoginAttempts: 0, lockedUntil: null,
    })

    const statuses: number[] = []
    for (let attempt = 0; attempt < 6; attempt++) {
      const { req, res } = createMocks({
        method: 'POST',
        headers: {
          cookie: 'two_factor_challenge=challenge-token',
          'x-forwarded-for': `203.0.113.${attempt + 1}`,
        },
        body: { code: '000000' },
      })
      await handler(req as never, res as never)
      statuses.push(res._getStatusCode())
    }

    expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
  })
})
