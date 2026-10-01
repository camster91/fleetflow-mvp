import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(),
  signToken: jest.fn(() => 'rotated-session'),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'SECRET') }))
jest.mock('speakeasy', () => ({ totp: { verifyDelta: jest.fn(() => ({ delta: 0 })) } }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('bcryptjs', () => ({ compare: jest.fn(async () => false), compareSync: jest.fn(() => false) }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))

import handler from '@/pages/api/auth/2fa/disable'
import { getUserFromRequest, signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'
import { rateLimitMiddleware } from '@/lib/rateLimit'

describe('passwordless 2FA disable', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue({ delta: 0 })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('disables 2FA with a valid authenticator code when no password exists', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      password: null,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted',
      backupCodes: null,
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ tokenVersion: 5 })
    const { req, res } = createMocks({ method: 'POST', body: { code: '123456' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: null,
        tokenVersion: { increment: 1 },
      },
      select: { tokenVersion: true },
    })
    // Disabling 2FA revokes other sessions and re-issues this one at the new version.
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'user-1', tv: 5 }))
    expect(res.getHeader('set-cookie')).toEqual(expect.stringContaining('token=rotated-session'))
  })

  it('does not disable 2FA when a backup code was consumed concurrently', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue(null)
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      password: null,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted',
      backupCodes: '["hashed-backup-code"]',
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const { req, res } = createMocks({ method: 'POST', body: { code: '1111-2222-3333' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('consumes a matching backup code with async bcrypt, never compareSync', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(bcrypt.compare as jest.Mock).mockImplementation(async (_code: string, hash: string) => hash === 'h2')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted',
      backupCodes: '["h1","h2"]',
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ tokenVersion: 2 })
    const { req, res } = createMocks({ method: 'POST', body: { code: ' 1234-5678-9012 ' } })

    await handler(req as never, res as never)

    expect(speakeasy.totp.verifyDelta).not.toHaveBeenCalled()
    expect(bcrypt.compareSync).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1', backupCodes: '["h1","h2"]', twoFactorEnabled: true },
      data: { backupCodes: '["h1"]' },
    })
    expect(res._getStatusCode()).toBe(200)
  })

  it.each(['000000', 'not-a-code', '1234-5678', 'x'.repeat(5000)])(
    'rejects %s without hashing when it is not a valid code',
    async (code) => {
      ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
      ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue(null)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted',
        backupCodes: '["h1"]',
      })
      const { req, res } = createMocks({ method: 'POST', body: { code } })

      await handler(req as never, res as never)

      expect(res._getStatusCode()).toBe(400)
      expect(bcrypt.compare).not.toHaveBeenCalled()
      expect(bcrypt.compareSync).not.toHaveBeenCalled()
      expect(prisma.user.update).not.toHaveBeenCalled()
    }
  )

  const enrolled = {
    id: 'user-1',
    twoFactorEnabled: true,
    twoFactorSecret: 'encrypted',
    backupCodes: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  }
  const call = async (code = '123456') => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const { req, res } = createMocks({ method: 'POST', body: { code } })
    await handler(req as never, res as never)
    return res
  }

  it('limits guesses per user', async () => {
    ;(rateLimitMiddleware as jest.Mock).mockImplementationOnce(async (_req, res) => {
      res.status(429).json({ error: 'Too many requests' })
      return false
    })
    expect((await call())._getStatusCode()).toBe(429)
    expect(rateLimitMiddleware).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'twoFactor', 'user:user-1')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('counts a wrong code toward the account lockout', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(enrolled)
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue(null)
    expect((await call())._getStatusCode()).toBe(400)
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: { increment: 1 } },
    })
  })

  it('refuses while the account is locked', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enrolled,
      lockedUntil: new Date(Date.now() + 60_000),
    })
    expect((await call())._getStatusCode()).toBe(423)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects an authenticator code whose time step was already used', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(enrolled)
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 })
    expect((await call())._getStatusCode()).toBe(400)
    expect((prisma.user.updateMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      where: { id: 'user-1', AND: [{ OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: expect.any(Number) } }] }] },
      data: { lastTotpStep: expect.any(Number) },
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
