import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

jest.mock('jose', () => ({ jwtVerify: jest.fn() }))

describe('public and protected route policy', () => {
  it.each(['/', '/pricing', '/help', '/privacy-policy'])(
    'allows anonymous access to %s',
    async (pathname) => {
      const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
      expect(response.headers.get('x-middleware-next')).toBe('1')
    }
  )

  it('redirects anonymous dashboard access to login with a callback', async () => {
    const response = await proxy(new NextRequest('https://fleet.example/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://fleet.example/auth/login?callbackUrl=%2Fdashboard'
    )
  })

  it.each(['/clients', '/sop', '/vending-machines', '/driver/delivery/1', '/routes'])(
    'protects application surface %s',
    async (pathname) => {
      const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/auth/login?callbackUrl=')
    }
  )

  it.each(['/about', '/features', '/blog', '/changelog', '/status'])(
    'retires unsupported public page %s',
    async (pathname) => {
      const response = await proxy(new NextRequest(`https://fleet.example${pathname}`))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('https://fleet.example/')
    }
  )
})
