import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

jest.mock('jose', () => ({ jwtVerify: jest.fn() }))

describe('public and protected route policy', () => {
  it.each(['/', '/pricing', '/help', '/privacy-policy'])('allows anonymous access to %s', async (pathname) => {
    const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('redirects anonymous dashboard access to login with a callback', async () => {
    const response = await proxy(new NextRequest('https://fleet.example/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://fleet.example/auth/login?callbackUrl=%2Fdashboard')
  })

  it.each([
    '/clients',
    '/sop',
    '/vending-machines',
    '/driver/delivery/1',
    '/routes',
    '/intelligence',
    '/assistant',
    '/ask',
  ])('protects application surface %s', async (pathname) => {
    const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth/login?callbackUrl=')
  })

  it.each(['/about', '/features', '/blog', '/changelog', '/status'])(
    'retires unsupported public page %s',
    async (pathname) => {
      const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://fleet.example/')
    }
  )
})

describe('session token claims', () => {
  const { jwtVerify } = jest.requireMock('jose') as { jwtVerify: jest.Mock }

  function dashboardWithCookie() {
    return new NextRequest('https://fleet.example/dashboard', {
      headers: { cookie: 'token=signed' },
    })
  }

  it('lets a versioned session token through', async () => {
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'u1', purpose: 'session', tv: 2 } })
    const response = await proxy(dashboardWithCookie())
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('lets a legacy session token without a version claim through', async () => {
    jwtVerify.mockResolvedValueOnce({ payload: { sub: 'u1', purpose: 'session' } })
    const response = await proxy(dashboardWithCookie())
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it.each([
    ['a 2FA challenge', { sub: 'u1', purpose: 'two-factor' }],
    ['a purpose-less token', { sub: 'u1' }],
    ['a malformed version claim', { sub: 'u1', purpose: 'session', tv: 'x' }],
  ])('treats %s as signed out', async (_label, payload) => {
    jwtVerify.mockResolvedValueOnce({ payload })
    const response = await proxy(dashboardWithCookie())
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/auth/login')
  })
})
