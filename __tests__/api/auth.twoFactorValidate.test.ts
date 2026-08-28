import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'secret') }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(() => true) }))
jest.mock('speakeasy', () => ({ __esModule: true, default: { totp: { verify: jest.fn(() => true) } } }))
jest.mock('bcryptjs', () => ({ compareSync: jest.fn(() => false) }))
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ sub: 'u1', purpose: 'two-factor' })),
  signToken: jest.fn(() => 'session-token'),
}))

import handler from '@/pages/api/auth/2fa/validate'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'

describe('POST /api/auth/2fa/validate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('exchanges a valid challenge and TOTP for a session cookie', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1', email: 'user@example.com', name: 'User', role: 'fleet_manager',
      twoFactorEnabled: true, twoFactorSecret: 'encrypted', backupCodes: '[]',
    })
    const { req, res } = createMocks({
      method: 'POST',
      headers: { cookie: 'two_factor_challenge=challenge-token' },
      body: { code: '123456' },
    })

    await handler(req as never, res as never)

    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u1', purpose: 'session' }))
    const cookies = res.getHeader('set-cookie') as string[]
    expect(cookies.join(';')).toContain('token=session-token')
    expect(cookies.join(';')).toContain('two_factor_challenge=')
    expect(res._getStatusCode()).toBe(200)
  })

  it('rejects a missing challenge even when a userId is supplied', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { userId: 'u1', code: '123456' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a backup code when another request consumed the same snapshot', async () => {
    ;(speakeasy.totp.verify as jest.Mock).mockReturnValue(false)
    ;(bcrypt.compareSync as jest.Mock).mockReturnValue(true)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1', email: 'user@example.com', name: 'User', role: 'fleet_manager',
      twoFactorEnabled: true, twoFactorSecret: 'encrypted',
      backupCodes: '["hashed-backup-code"]',
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const { req, res } = createMocks({
      method: 'POST',
      headers: { cookie: 'two_factor_challenge=challenge-token' },
      body: { code: 'backup-code' },
    })

    await handler(req as never, res as never)

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        backupCodes: '["hashed-backup-code"]',
        twoFactorEnabled: true,
      },
      data: { backupCodes: '[]' },
    })
    expect(res._getStatusCode()).toBe(400)
    expect(signToken).not.toHaveBeenCalled()
  })
})
