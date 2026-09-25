import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() }, loginHistory: { findMany: jest.fn() } },
}))

import callback from '@/pages/api/auth/callback'
import register from '@/pages/api/auth/register'
import securitySettings from '@/pages/api/auth/security-settings'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('GET /api/auth/callback (deprecated)', () => {
  it('redirects to the callback page and preserves the query', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { token: 'abc', next: '/dashboard' } })
    await callback(req as never, res as never)
    expect(res._getStatusCode()).toBe(302)
    expect(res._getRedirectUrl()).toBe('/auth/callback?token=abc&next=%2Fdashboard')
  })
})

describe('/api/auth/register', () => {
  it('rejects non-POST methods', () => {
    const { req, res } = createMocks({ method: 'GET' })
    register(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
  })

  it('refuses self-registration', () => {
    const { req, res } = createMocks({ method: 'POST', body: { email: 'new@example.test', password: 'x' } })
    register(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(res._getJSONData().error).toMatch(/Registration is disabled/)
  })
})

describe('GET /api/auth/security-settings', () => {
  async function get(method = 'GET') {
    const { req, res } = createMocks({ method: method as never })
    await securitySettings(req as never, res as never)
    return res
  }

  beforeEach(() => jest.clearAllMocks())

  it('rejects other methods', async () => {
    const res = await get('POST')
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
  })

  it('requires a session and is never cached', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue(null)
    const res = await get()
    expect(res._getStatusCode()).toBe(401)
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 for a deleted user', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await get()
    expect(res._getStatusCode()).toBe(404)
  })

  it('returns only the caller’s last ten logins with whitelisted fields', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ twoFactorEnabled: true, lastLoginAt: null })
    ;(prisma.loginHistory.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'l1',
        userId: 'u1',
        timestamp: new Date('2026-09-01T00:00:00Z'),
        ipAddress: '203.0.113.1',
        userAgent: 'UA',
        success: true,
        failureReason: 'internal detail',
      },
    ])
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { twoFactorEnabled: true, lastLoginAt: true },
    })
    expect(prisma.loginHistory.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { timestamp: 'desc' },
      take: 10,
    })
    const body = res._getJSONData()
    expect(body.twoFactorEnabled).toBe(true)
    expect(body.loginHistory).toEqual([
      { id: 'l1', timestamp: '2026-09-01T00:00:00.000Z', ipAddress: '203.0.113.1', userAgent: 'UA', success: true },
    ])
  })

  it('hides internal errors', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(getUserFromRequest as jest.Mock).mockRejectedValue(new Error('boom'))
    const res = await get()
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Internal server error' })
  })
})
