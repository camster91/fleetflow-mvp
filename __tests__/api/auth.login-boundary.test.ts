import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/prisma', () => ({ prisma: {
  user: { findUnique: jest.fn(), update: jest.fn() },
  verificationToken: { findFirst: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
} }))
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
  id: 'u1', email: 'user@example.com', name: 'User', role: 'fleet_manager',
  failedLoginAttempts: 0, lockedUntil: null, emailVerified: new Date(),
  twoFactorEnabled: false, twoFactorSecret: null,
}

describe('POST /api/auth/login boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(user)
    ;(prisma.verificationToken.findFirst as jest.Mock).mockResolvedValue({
      identifier: 'login:user@example.com', token: 'hashed',
      expires: new Date(Date.now() + 60_000),
    })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (operation) => {
      if (typeof operation !== 'function') return Promise.all(operation)
      return operation({
        verificationToken: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        user: { update: jest.fn().mockResolvedValue(user) },
      })
    })
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
      operation({ verificationToken: { deleteMany }, user: { update } })
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
      ...user, twoFactorEnabled: true, twoFactorSecret: 'encrypted',
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
})

function request(origin: string) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    headers: { host: 'fleetvera.example', origin },
    body: { email: 'user@example.com', code: '123456' },
  })
}
