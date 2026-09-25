import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(),
  signToken: jest.fn(() => 'rotated-token'),
}))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))

import handler from '@/pages/api/auth/refresh'
import { getUserFromRequest, signToken } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/apiAuth'

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
  })

  it('rejects a cross-origin refresh before reading the session', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://evil.example' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(getUserFromRequest).not.toHaveBeenCalled()
  })

  it('rejects an unauthenticated refresh', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST' })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it('rotates the authenticated session cookie', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com', name: 'User', role: 'user', tokenVersion: 3 },
    })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST' })

    await handler(req, res)

    expect(signToken).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'user',
      tv: 3,
    })
    expect(res.getHeader('set-cookie')).toEqual(expect.stringContaining('token=rotated-token'))
    expect(res._getStatusCode()).toBe(200)
  })
})
