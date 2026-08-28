import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/auth/logout'

describe('POST /api/auth/logout', () => {
  it('rejects a cross-origin logout without clearing cookies', () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://evil.example' },
    })
    handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(res.getHeader('set-cookie')).toBeUndefined()
  })

  it('clears the session, 2FA challenge, and selected workspace', () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://fleetvera.example' },
    })
    handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    const cookies = res.getHeader('set-cookie') as string[]
    expect(cookies).toHaveLength(3)
    expect(cookies.join(';')).toContain('token=')
    expect(cookies.join(';')).toContain('two_factor_challenge=')
    expect(cookies.join(';')).toContain('fleetflow_team=')
    expect(cookies.every(cookie => cookie.includes('Max-Age=0'))).toBe(true)
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })

  it('advertises POST for unsupported methods', () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    handler(req, res)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('POST')
  })
})
