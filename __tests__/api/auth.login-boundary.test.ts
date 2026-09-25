import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    verificationToken: { findFirst: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn(() => '127.0.0.1'),
  rateLimitMiddleware: jest.fn(async () => true),
}))
jest.mock('@/lib/tokens', () => ({ hashToken: jest.fn(() => 'hashed') }))
jest.mock('@/lib/auth', () => ({ signToken: jest.fn(() => 'signed-token') }))

import handler from '@/pages/api/auth/login'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

const user = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  role: 'fleet_manager',
  failedLoginAttempts: 0,
  lockedUntil: null,
  emailVerified: new Date(),
  twoFactorEnabled: false,
  twoFactorSecret: null,
}

describe('POST /api/auth/login boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user)
    ;(prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue({
      identifier: 'login:user@example.com',
      token: 'hashed',
      expires: new Date(Date.now() + 60_000),
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (operation) => {
      if (typeof operation !== 'function') return Promise.all(operation)
      return operation({
        verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      })
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('rejects cross-origin login before rate limit or database work', async () => {
    const { req, res } = request('https://evil.example')
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('establishes a session and clears stale 2FA/workspace cookies', async () => {
    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const cookies = res.getHeader('set-cookie') as string[]
    expect(cookies.join(';')).toContain('token=signed-token')
    expect(cookies.join(';')).toContain('two_factor_challenge=')
    expect(cookies.join(';')).toContain('fleetflow_team=')
  })

  it('rejects a concurrent reuse when the exact login code was already consumed', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 })
    const update = jest.fn()
    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (operation) =>
      operation({ verificationToken: { deleteMany }, user: { updateMany: update } })
    )

    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        identifier: 'login:user@example.com',
        token: 'hashed',
        expires: { gte: expect.any(Date) },
      },
    })
    expect(update).not.toHaveBeenCalled()
    expect(signToken).not.toHaveBeenCalled()
    expect(res._getStatusCode()).toBe(401)
  })

  it('clears an existing session before returning a 2FA challenge', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted',
    })
    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'two-factor' }), '5m')
    const cookies = res.getHeader('set-cookie') as string[]
    expect(cookies.join(';')).toContain('two_factor_challenge=signed-token')
    expect(cookies.join(';')).toContain('token=')
    expect(cookies.join(';')).toContain('fleetflow_team=')
  })

  it('embeds the user token version in the issued session', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...user, tokenVersion: 7 })
    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u1', tv: 7 }))
  })

  it('restarts the failure count once an old lock has expired', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...user,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000),
    })
    ;(prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null)

    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
    // The expired lock is cleared (guarded on it having lapsed) before counting.
    const calls = (prisma.user.updateMany as jest.Mock).mock.calls.map(([args]) => args)
    expect(calls[0]).toEqual({
      where: { id: 'u1', lockedUntil: { lte: expect.any(Date) } },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
    expect(calls[1]).toEqual({ where: { id: 'u1' }, data: { failedLoginAttempts: { increment: 1 } } })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('locks on the fifth consecutive failure', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...user, failedLoginAttempts: 4 })
    ;(prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue(null)

    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)

    // The lock is a conditional write on the stored count, and revokes sessions.
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', lockedUntil: null, failedLoginAttempts: { gte: 5 } },
      data: { lockedUntil: expect.any(Date), tokenVersion: { increment: 1 } },
    })
  })

  it('refuses the session when the account was locked after the snapshot', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 })
    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (operation) =>
      operation({ verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) }, user: { updateMany } })
    )
    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', OR: [{ lockedUntil: null }, { lockedUntil: { lte: expect.any(Date) } }] },
      })
    )
    expect(res._getStatusCode()).toBe(423)
    expect(signToken).not.toHaveBeenCalled()
  })

  it('still refuses an account whose lock has not expired', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...user,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    })
    const { req, res } = request('https://fleetvera.example')
    await handler(req, res)
    expect(res._getStatusCode()).toBe(423)
  })
})

function request(origin: string) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    headers: { host: 'fleetvera.example', origin },
    body: { email: 'user@example.com', code: '123456' },
  })
}
