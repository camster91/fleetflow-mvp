import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'secret') }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(() => true) }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('speakeasy', () => ({
  __esModule: true,
  default: { totp: { verifyDelta: jest.fn(() => ({ delta: 0 })) } },
}))
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn(async () => false), compareSync: jest.fn(() => false) },
}))
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(() => ({ sub: 'u1', purpose: 'two-factor' })),
  signToken: jest.fn(() => 'session-token'),
  tokenVersionOf: jest.requireActual('@/lib/auth').tokenVersionOf,
}))

import handler from '@/pages/api/auth/2fa/validate'
import { prisma } from '@/lib/prisma'
import { signToken, verifyToken } from '@/lib/auth'
import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'
import { assertSameOrigin } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'

const enabledUser = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  role: 'fleet_manager',
  twoFactorEnabled: true,
  twoFactorSecret: 'encrypted',
  backupCodes: '[]',
  tokenVersion: 0,
  lastTotpStep: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
}

const incrementCall = { where: { id: 'u1' }, data: { failedLoginAttempts: { increment: 1 } } }
const lockCall = {
  where: { id: 'u1', lockedUntil: null, failedLoginAttempts: { gte: 5 } },
  data: { lockedUntil: expect.any(Date), tokenVersion: { increment: 1 } },
}

function validateRequest(code: string) {
  return createMocks({
    method: 'POST',
    headers: { cookie: 'two_factor_challenge=challenge-token' },
    body: { code },
  })
}

describe('POST /api/auth/2fa/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(true)
    ;(verifyToken as jest.Mock).mockReturnValue({ sub: 'u1', purpose: 'two-factor' })
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue({ delta: 0 })
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('rejects a cross-origin exchange before validating the challenge', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        host: 'fleetvera.example',
        origin: 'https://evil.example',
        cookie: 'two_factor_challenge=challenge-token',
      },
      body: { code: '123456' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('exchanges a valid challenge and TOTP for a session cookie', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...enabledUser, tokenVersion: 4 })
    ;(verifyToken as jest.Mock).mockReturnValue({ sub: 'u1', purpose: 'two-factor', tv: 4 })
    const { req, res } = validateRequest('123456')

    await handler(req as never, res as never)

    expect(rateLimitMiddleware).toHaveBeenCalledWith(req, res, 'twoFactor', 'user:u1')
    const step = Math.floor(Date.now() / 1000 / 30)
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        twoFactorEnabled: true,
        tokenVersion: 4,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: expect.any(Date) } }],
        AND: [{ OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: expect.any(Number) } }] }],
      },
      data: expect.objectContaining({ lastTotpStep: expect.any(Number), failedLoginAttempts: 0 }),
    })
    const recordedStep = (prisma.user.updateMany as jest.Mock).mock.calls[0][0].data.lastTotpStep
    expect(Math.abs(recordedStep - step)).toBeLessThanOrEqual(1)
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u1', purpose: 'session', tv: 4 }))
    const cookies = res.getHeader('set-cookie') as string[]
    expect(cookies.join(';')).toContain('token=session-token')
    expect(cookies.join(';')).toContain('two_factor_challenge=')
    expect(cookies.join(';')).toContain('fleetflow_team=')
    expect(res._getStatusCode()).toBe(200)
  })

  it('rejects a replayed TOTP code whose time step was already accepted', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      lastTotpStep: Math.floor(Date.now() / 1000 / 30) + 5,
    })
    // The conditional update matches nothing because lastTotpStep >= this step.
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const { req, res } = validateRequest('123456')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(signToken).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).toHaveBeenCalledWith(incrementCall)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('does not run bcrypt for a wrong 6-digit code and counts the failure', async () => {
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue(undefined)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      backupCodes: '["h1","h2","h3"]',
    })
    const { req, res } = validateRequest('000000')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(bcrypt.compareSync).not.toHaveBeenCalled()
    // Counted in the database, never as an absolute value from the snapshot.
    expect(prisma.user.updateMany).toHaveBeenCalledWith(incrementCall)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects malformed input without trying TOTP or backup codes', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      backupCodes: '["h1"]',
    })
    const { req, res } = validateRequest('not-a-code')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(speakeasy.totp.verifyDelta).not.toHaveBeenCalled()
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it('locks the account on the fifth failed 2FA attempt, shared with login lockout', async () => {
    ;(speakeasy.totp.verifyDelta as jest.Mock).mockReturnValue(undefined)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      failedLoginAttempts: 4,
    })
    const { req, res } = validateRequest('000000')

    await handler(req as never, res as never)

    expect(prisma.user.updateMany).toHaveBeenCalledWith(incrementCall)
    expect(prisma.user.updateMany).toHaveBeenCalledWith(lockCall)
    expect(res._getStatusCode()).toBe(400)
  })

  it('refuses a locked account before checking the code', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    })
    const { req, res } = validateRequest('123456')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(423)
    expect(speakeasy.totp.verifyDelta).not.toHaveBeenCalled()
    expect(signToken).not.toHaveBeenCalled()
  })

  it('rejects a challenge issued before the user revoked their sessions', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...enabledUser, tokenVersion: 1 })
    const { req, res } = validateRequest('123456')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(401)
    expect(signToken).not.toHaveBeenCalled()
  })

  it('accepts a matching backup code with async bcrypt and consumes it', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...enabledUser,
      backupCodes: '["h1","h2"]',
    })
    ;(bcrypt.compare as jest.Mock).mockImplementation(async (_code, hash) => hash === 'h2')
    const { req, res } = validateRequest('1234-5678-9012')

    await handler(req as never, res as never)

    expect(speakeasy.totp.verifyDelta).not.toHaveBeenCalled()
    expect(bcrypt.compareSync).not.toHaveBeenCalled()
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        twoFactorEnabled: true,
        tokenVersion: 0,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: expect.any(Date) } }],
        backupCodes: '["h1","h2"]',
      },
      data: expect.objectContaining({ backupCodes: '["h1"]', failedLoginAttempts: 0, lockedUntil: null }),
    })
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(res._getStatusCode()).toBe(200)
    expect(JSON.parse(res._getData())).toEqual(expect.objectContaining({ isBackupCode: true }))
  })

  it('rejects a missing challenge even when a userId is supplied', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { userId: 'u1', code: '123456' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a backup code when another request consumed the same snapshot', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'fleet_manager',
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted',
      backupCodes: '["hashed-backup-code"]',
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const { req, res } = createMocks({
      method: 'POST',
      headers: { cookie: 'two_factor_challenge=challenge-token' },
      body: { code: '1111-2222-3333' },
    })

    await handler(req as never, res as never)

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'u1',
        backupCodes: '["hashed-backup-code"]',
        twoFactorEnabled: true,
      }),
      data: expect.objectContaining({ backupCodes: '[]' }),
    })
    expect(res._getStatusCode()).toBe(400)
    expect(signToken).not.toHaveBeenCalled()
  })

  it('does not issue a session or clear a lock set concurrently after the snapshot', async () => {
    // Snapshot says unlocked; by the time the success write runs, another
    // request has locked the account (and bumped tokenVersion), so the guarded
    // write matches no row.
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(enabledUser)
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const { req, res } = validateRequest('123456')

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(signToken).not.toHaveBeenCalled()
    const successWrite = (prisma.user.updateMany as jest.Mock).mock.calls[0][0]
    expect(successWrite.where).toEqual(
      expect.objectContaining({
        tokenVersion: 0,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: expect.any(Date) } }],
      })
    )
    // Every write that clears lockedUntil is conditioned on the stored lock.
    for (const [args] of (prisma.user.updateMany as jest.Mock).mock.calls) {
      if (args.data.lockedUntil === null) expect('OR' in args.where || 'lockedUntil' in args.where).toBe(true)
    }
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
