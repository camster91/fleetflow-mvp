import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { user: { update: jest.fn() } } }))

import handler from '@/pages/api/auth/complete-onboarding'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('POST /api/auth/complete-onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
  })

  it('rejects cross-origin completion before reading or mutating the session', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://evil.example' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(getUserFromRequest).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('completes onboarding for the authenticated same-origin user', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://fleetvera.example' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' }, data: { onboardingCompleted: true },
    })
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })
})
