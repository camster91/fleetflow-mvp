import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))

import handler from '@/pages/api/auth/me'
import { getUserFromRequest } from '@/lib/auth'

describe('GET /api/auth/me', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects non-GET methods', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
    expect(getUserFromRequest).not.toHaveBeenCalled()
  })

  it('returns 401 without a valid session cookie', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(401)
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })

  it('returns the session user and expiry', async () => {
    const session = {
      user: { id: 'u1', email: 'u1@example.test', name: 'U1', role: 'user' },
      expires: '2030-01-01T00:00:00.000Z',
    }
    ;(getUserFromRequest as jest.Mock).mockResolvedValue(session)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual(session)
  })
})
