import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(),
  signToken: jest.fn(() => 'rotated-token'),
}))

import handler from '@/pages/api/auth/refresh'
import { getUserFromRequest, signToken } from '@/lib/auth'

describe('POST /api/auth/refresh', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects an unauthenticated refresh', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST' })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(401)
  })

  it('rotates the authenticated session cookie', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com', name: 'User', role: 'user' },
    })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST' })

    await handler(req, res)

    expect(signToken).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'user',
    })
    expect(res.getHeader('set-cookie')).toEqual(expect.stringContaining('token=rotated-token'))
    expect(res._getStatusCode()).toBe(200)
  })
})
