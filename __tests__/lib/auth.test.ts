import { verifyToken, signToken, hashPassword, verifyPassword, getUserFromRequest, tokenVersionOf } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { NextApiRequest } from 'next'

// Mock prisma so importing auth doesn't blow up
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}))

describe('signToken / verifyToken', () => {
  it('returns payload for a valid token', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'user' })
    const payload = await verifyToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('u1')
    expect(payload!.email).toBe('a@b.com')
  })

  it('returns null for an invalid token', async () => {
    expect(await verifyToken('bad.token.here')).toBeNull()
  })

  it('returns null for an empty string', async () => {
    expect(await verifyToken('')).toBeNull()
  })
})

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('SecureP@ss1')
    expect(hash).not.toBe('SecureP@ss1')
    expect(await verifyPassword('SecureP@ss1', hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('SecureP@ss1')
    expect(await verifyPassword('WrongPass', hash)).toBe(false)
  })
})

describe('getUserFromRequest', () => {
  it('never accepts a two-factor challenge as an authenticated session', async () => {
    const token = await signToken(
      {
        sub: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: 'fleet_manager',
        purpose: 'two-factor',
      } as any,
      '5m'
    )
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a purpose-less JWT as an authenticated session', async () => {
    const token = await signToken({
      sub: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'fleet_manager',
      purpose: undefined,
    })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.toBeNull()
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('returns the signed token expiry with the custom session', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' }, '1h')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      passwordChangedAt: null,
      role: 'fleet_manager',
      email: 'a@b.com',
      name: 'A',
      onboardingCompleted: true,
    })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    const session = await getUserFromRequest(req)

    expect(session?.expires).toEqual(expect.any(String))
    expect(new Date(session!.expires!).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('session token versions', () => {
  const dbUser = {
    passwordChangedAt: null,
    role: 'fleet_manager',
    email: 'a@b.com',
    name: 'A',
    onboardingCompleted: true,
  }

  it('treats a token without a version claim as version 0', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...dbUser, tokenVersion: 0 })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ id: 'u1', tokenVersion: 0 }) })
    )
  })

  it('rejects a token whose version is behind the user record', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', tv: 1 })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...dbUser, tokenVersion: 2 })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.toBeNull()
  })

  it('rejects a legacy unversioned token once the user has revoked sessions', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...dbUser, tokenVersion: 1 })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.toBeNull()
  })

  it('accepts a token at the current version', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', tv: 3 })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...dbUser, tokenVersion: 3 })
    const req = { headers: { cookie: `token=${token}` } } as NextApiRequest

    await expect(getUserFromRequest(req)).resolves.not.toBeNull()
  })

  it('rejects a malformed version claim', () => {
    expect(tokenVersionOf({ tv: -1 })).toBeNull()
    expect(tokenVersionOf({ tv: 1.5 })).toBeNull()
    expect(tokenVersionOf({})).toBe(0)
  })
})
