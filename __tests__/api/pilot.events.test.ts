import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: { pilotEnrollment: { findUnique: jest.fn() }, pilotEvent: { upsert: jest.fn() } },
}))

import handler from '@/pages/api/pilot/events'
import { requireTenantContext } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'

const sessionKey = 'abcdefghij_KLMNOP-12'
const valid = { eventType: 'DASHBOARD_OPENED', sessionKey }

async function post(body: unknown, headers: Record<string, string> = { host: 'app.test', origin: 'http://app.test' }) {
  const { req, res } = createMocks({ method: 'POST', headers, body: body as never })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/pilot/events', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(true)
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'actor' } },
      tenant: { ownerId: 'owner', teamId: 'team-1', role: 'DRIVER' },
    })
    ;(prisma.pilotEnrollment.findUnique as jest.Mock).mockResolvedValue({ status: 'ACTIVE', pilotEndsAt: null })
  })

  it('rejects other methods', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('POST')
  })

  it('rejects cross-origin posts before authentication', async () => {
    const res = await post(valid, { host: 'app.test', origin: 'https://evil.test' })
    expect(res._getStatusCode()).toBe(403)
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it('stops when rate limited', async () => {
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(false)
    await post(valid)
    expect(prisma.pilotEnrollment.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    [{ eventType: 'PAGE_VIEW', sessionKey }],
    [{ eventType: 'DASHBOARD_OPENED', sessionKey: 'short' }],
    [{ eventType: 'DASHBOARD_OPENED', sessionKey: 'has spaces in it!!!!' }],
    [{ ...valid, url: '/private' }],
  ])('rejects invalid body %j', async (body) => {
    const res = await post(body)
    expect(res._getStatusCode()).toBe(400)
    expect(prisma.pilotEvent.upsert).not.toHaveBeenCalled()
  })

  it.each([
    ['not enrolled', null],
    ['paused', { status: 'PAUSED', pilotEndsAt: null }],
    ['ended', { status: 'ACTIVE', pilotEndsAt: new Date(Date.now() - 1000) }],
  ])('returns 409 when the workspace pilot is %s', async (_label, enrollment) => {
    ;(prisma.pilotEnrollment.findUnique as jest.Mock).mockResolvedValue(enrollment)
    const res = await post(valid)
    expect(res._getStatusCode()).toBe(409)
    expect(prisma.pilotEvent.upsert).not.toHaveBeenCalled()
  })

  it('records one idempotent event per actor, session and type', async () => {
    const res = await post(valid)
    expect(res._getStatusCode()).toBe(204)
    expect(prisma.pilotEnrollment.findUnique).toHaveBeenCalledWith({
      where: { scopeKey: 'team:team-1' },
      select: { status: true, pilotEndsAt: true },
    })
    const args = (prisma.pilotEvent.upsert as jest.Mock).mock.calls[0][0]
    expect(args.where).toEqual({
      scopeKey_actorId_sessionKey_eventType: {
        scopeKey: 'team:team-1',
        actorId: 'actor',
        sessionKey,
        eventType: 'DASHBOARD_OPENED',
      },
    })
    expect(args.create).toMatchObject({ ownerId: 'owner', teamId: 'team-1', expiresAt: expect.any(Date) })
    expect(args.update).toEqual({})
  })
})
