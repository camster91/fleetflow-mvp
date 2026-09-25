import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

const SECRET = 'ci-only-signing-secret-at-least-32-characters'
process.env.JWT_SECRET = SECRET

const mockUserRow = {
  passwordChangedAt: null as Date | null,
  tokenVersion: 0,
  role: 'fleet_manager',
  email: 'a@b.com',
  name: 'A',
  onboardingCompleted: true,
}

jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(async () => ({ ...mockUserRow })) } },
}))

import { getUserFromRequest, signToken, verifyToken } from '@/lib/auth'
import { proxy } from '@/proxy'
import refresh from '@/pages/api/auth/refresh'

function b64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

/**
 * Build an HS256 JWT byte-for-byte the way jsonwebtoken did before the jose
 * migration: header {"alg":"HS256","typ":"JWT"}, claims in insertion order,
 * iat/exp as integer seconds.
 */
function legacyJwt(claims: Record<string, unknown>, { secret = SECRET, header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url')
  return `${signingInput}.${signature}`
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function legacySessionClaims(overrides: Record<string, unknown> = {}) {
  const iat = nowSeconds() - 60
  return {
    purpose: 'session',
    sub: 'u1',
    email: 'a@b.com',
    name: 'A',
    role: 'fleet_manager',
    tv: 0,
    iat,
    exp: iat + 7 * 24 * 60 * 60,
    ...overrides,
  }
}

function apiRequest(token: string) {
  return { headers: { cookie: `token=${token}` } } as NextApiRequest
}

async function proxyAllows(token: string) {
  const response = await proxy(
    new NextRequest('https://fleet.example/dashboard', { headers: { cookie: `token=${token}` } })
  )
  return response.headers.get('x-middleware-next') === '1'
}

function tamper(token: string) {
  const [header, payload, signature] = token.split('.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
  return `${header}.${b64url(JSON.stringify({ ...claims, role: 'admin' }))}.${signature}`
}

beforeEach(() => {
  mockUserRow.tokenVersion = 0
  mockUserRow.passwordChangedAt = null
})

describe('tokens signed with jose', () => {
  it('keep the jsonwebtoken header and claim shape', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', tv: 2 })
    const [header, payload] = token
      .split('.')
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()))

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(payload).toEqual({
      purpose: 'session',
      sub: 'u1',
      email: 'a@b.com',
      name: 'A',
      role: 'fleet_manager',
      tv: 2,
      iat: expect.any(Number),
      exp: expect.any(Number),
    })
    expect(payload.exp - payload.iat).toBe(7 * 24 * 60 * 60)
  })

  it('honours a numeric expiresIn as seconds from now', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' }, 300)
    const payload = await verifyToken(token)
    expect(payload!.exp! - payload!.iat!).toBe(300)
  })

  it('verify in the proxy and in getUserFromRequest', async () => {
    const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', tv: 0 })

    await expect(proxyAllows(token)).resolves.toBe(true)
    await expect(getUserFromRequest(apiRequest(token))).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ id: 'u1', tokenVersion: 0 }) })
    )
  })

  it('verify a signed 2FA challenge but never as a session', async () => {
    const challenge = await signToken(
      { sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', purpose: 'two-factor', tv: 0 },
      '5m'
    )

    await expect(verifyToken(challenge)).resolves.toEqual(expect.objectContaining({ sub: 'u1', purpose: 'two-factor' }))
    await expect(proxyAllows(challenge)).resolves.toBe(false)
    await expect(getUserFromRequest(apiRequest(challenge))).resolves.toBeNull()
  })
})

describe('cookies issued by jsonwebtoken before the migration', () => {
  it('still verify in the proxy, verifyToken and getUserFromRequest', async () => {
    const token = legacyJwt(legacySessionClaims())

    await expect(verifyToken(token)).resolves.toEqual(expect.objectContaining({ sub: 'u1', tv: 0 }))
    await expect(proxyAllows(token)).resolves.toBe(true)
    await expect(getUserFromRequest(apiRequest(token))).resolves.toEqual(
      expect.objectContaining({ user: expect.objectContaining({ id: 'u1' }) })
    )
  })

  it('still verify when they predate the tv claim', async () => {
    const { tv: _tv, ...claims } = legacySessionClaims()
    const token = legacyJwt(claims)

    await expect(proxyAllows(token)).resolves.toBe(true)
    await expect(getUserFromRequest(apiRequest(token))).resolves.not.toBeNull()
  })
})

describe('rejected tokens', () => {
  it.each([
    [
      'a tampered payload (new signer)',
      async () => tamper(await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' })),
    ],
    ['a tampered payload (legacy signer)', async () => tamper(legacyJwt(legacySessionClaims()))],
    [
      'a different signing secret',
      async () => legacyJwt(legacySessionClaims(), { secret: 'some-other-secret-that-is-also-32-chars-long' }),
    ],
    [
      'an expired token',
      async () => legacyJwt(legacySessionClaims({ iat: nowSeconds() - 7200, exp: nowSeconds() - 3600 })),
    ],
    [
      'an unsigned alg=none token',
      async () => {
        const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        return `${header}.${b64url(JSON.stringify(legacySessionClaims()))}.`
      },
    ],
    [
      'a token signed with another HMAC algorithm',
      async () => {
        const header = { alg: 'HS512', typ: 'JWT' }
        const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(legacySessionClaims()))}`
        return `${input}.${createHmac('sha512', SECRET).update(input).digest('base64url')}`
      },
    ],
  ])('rejects %s everywhere', async (_label, build) => {
    const token = await build()

    await expect(verifyToken(token)).resolves.toBeNull()
    await expect(proxyAllows(token)).resolves.toBe(false)
    await expect(getUserFromRequest(apiRequest(token))).resolves.toBeNull()
  })

  it('rejects an expired token signed by the new code', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] })
    try {
      const token = await signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager' }, '1h')
      jest.setSystemTime(new Date('2026-01-01T01:00:01Z'))

      await expect(verifyToken(token)).resolves.toBeNull()
      await expect(getUserFromRequest(apiRequest(token))).resolves.toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('token version revocation', () => {
  function postRefresh(token: string) {
    return createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers: {
        host: 'fleet.example',
        origin: 'https://fleet.example',
        cookie: `token=${token}`,
      },
    })
  }

  it.each([
    ['new', async (tv: number) => signToken({ sub: 'u1', email: 'a@b.com', name: 'A', role: 'fleet_manager', tv })],
    ['legacy', async (tv: number) => legacyJwt(legacySessionClaims({ tv }))],
  ])('returns 401 for a %s token behind the user tokenVersion', async (_label, build) => {
    mockUserRow.tokenVersion = 2
    const stale = await build(1)

    await expect(getUserFromRequest(apiRequest(stale))).resolves.toBeNull()
    const { req, res } = postRefresh(stale)
    await refresh(req, res)
    expect(res._getStatusCode()).toBe(401)

    const current = await build(2)
    const ok = postRefresh(current)
    await refresh(ok.req, ok.res)
    expect(ok.res._getStatusCode()).toBe(200)
    const rotated = (ok.res.getHeader('set-cookie') as string).match(/token=([^;]+)/)![1]
    await expect(verifyToken(rotated)).resolves.toEqual(expect.objectContaining({ sub: 'u1', tv: 2 }))
  })
})
