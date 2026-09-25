import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

const mockUserRow = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  role: 'fleet_manager',
  onboardingCompleted: true,
  passwordChangedAt: null,
  tokenVersion: 0,
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async () => ({ ...mockUserRow })),
      update: jest.fn(async ({ data }) => {
        if (data.tokenVersion?.increment) mockUserRow.tokenVersion += data.tokenVersion.increment
        return { ...mockUserRow }
      }),
    },
  },
}))

import logoutAll from '@/pages/api/auth/logout-all'
import refresh from '@/pages/api/auth/refresh'
import { signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function post(cookie?: string) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    headers: {
      host: 'fleetvera.example',
      origin: 'https://fleetvera.example',
      ...(cookie ? { cookie } : {}),
    },
  })
}

describe('POST /api/auth/logout-all', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserRow.tokenVersion = 0
  })

  it('revokes every existing session: an old cookie gets 401 afterwards', async () => {
    const otherDevice = await signToken({
      sub: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'fleet_manager',
      tv: 0,
    })
    const thisDevice = await signToken({
      sub: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'fleet_manager',
      tv: 0,
    })

    const before = post(`token=${otherDevice}`)
    await refresh(before.req, before.res)
    expect(before.res._getStatusCode()).toBe(200)

    const logout = post(`token=${thisDevice}`)
    await logoutAll(logout.req, logout.res)
    expect(logout.res._getStatusCode()).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { tokenVersion: { increment: 1 } },
    })
    const cookies = logout.res.getHeader('set-cookie') as string[]
    expect(cookies.join(';')).toContain('token=;')

    const after = post(`token=${otherDevice}`)
    await refresh(after.req, after.res)
    expect(after.res._getStatusCode()).toBe(401)
  })

  it('keeps pre-existing tokens without a version claim valid until a revocation', async () => {
    const legacy = await signToken({ sub: 'u1', email: 'user@example.com', name: 'User', role: 'fleet_manager' })

    const first = post(`token=${legacy}`)
    await refresh(first.req, first.res)
    expect(first.res._getStatusCode()).toBe(200)

    const logout = post(`token=${legacy}`)
    await logoutAll(logout.req, logout.res)

    const after = post(`token=${legacy}`)
    await refresh(after.req, after.res)
    expect(after.res._getStatusCode()).toBe(401)
  })

  it('returns 401 without touching the database when there is no valid session', async () => {
    const { req, res } = post()
    await logoutAll(req, res)
    expect(res._getStatusCode()).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: { host: 'fleetvera.example', origin: 'https://evil.example' },
    })
    await logoutAll(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
