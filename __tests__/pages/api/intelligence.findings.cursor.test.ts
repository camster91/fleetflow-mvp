import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { intelligenceFinding: { findMany: jest.fn() } },
}))

import handler, { FINDING_PAGE_LIMIT_MAX } from '@/pages/api/intelligence/findings'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const exactScope = { ownerId: 'owner-1', teamId: 'team-1' }
const context = {
  session: { user: { id: 'member-1' } },
  tenant: {
    ...exactScope, role: 'VIEWER',
    resourceWhere: { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] },
  },
}

function row(id: string, score: number) {
  return {
    id, type: 'vehicle-stale', severity: 'medium', confidence: 0.9, score,
    ruleVersion: 'fleet-ops-v1', title: 'Title', explanation: 'Explanation',
    evidence: '{"items":[],"total":0,"truncated":false}', action: 'Review',
    actionUrl: '/vehicles', status: 'OPEN', feedback: null,
    generatedAt: new Date(), expiresAt: null, resolvedAt: null,
  }
}

describe('finding signed keyset cursor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([])
  })

  it('returns a small score-desc/id-asc page and signs the final returned key', async () => {
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([
      row('a', 500), row('b', 500), row('c', 490),
    ])
    const { req, res } = createMocks({ method: 'GET', query: { limit: '2', status: 'OPEN' } })
    await handler(req as never, res as never)
    expect(prisma.intelligenceFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [exactScope, { status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] }] },
      orderBy: [{ score: 'desc' }, { id: 'asc' }], take: 3,
    }))
    const body = res._getJSONData()
    expect(body.findings.map((finding: { id: string }) => finding.id)).toEqual(['a', 'b'])
    expect(body.pagination).toEqual({ limit: 2, nextCursor: expect.any(String) })

    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockClear().mockResolvedValue([])
    const second = createMocks({
      method: 'GET', query: { limit: '2', status: 'OPEN', cursor: body.pagination.nextCursor },
    })
    await handler(second.req as never, second.res as never)
    expect(second.res._getStatusCode()).toBe(200)
    expect(prisma.intelligenceFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [
        exactScope,
        { status: 'OPEN', OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] },
        { OR: [{ score: { lt: 500 } }, { score: 500, id: { gt: 'b' } }] },
      ] },
      take: 3,
    }))
  })

  it('caps page size before querying', async () => {
    const { req, res } = createMocks({ method: 'GET', query: { limit: '999' } })
    await handler(req as never, res as never)
    expect(prisma.intelligenceFinding.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: FINDING_PAGE_LIMIT_MAX + 1,
    }))
  })

  it.each([
    ['tampered', (cursor: string) => `${cursor.slice(0, -1)}x`, context, 'OPEN'],
    ['other status', (cursor: string) => cursor, context, 'RESOLVED'],
    ['other tenant', (cursor: string) => cursor, {
      ...context, tenant: { ...context.tenant, ownerId: 'owner-2', teamId: 'team-2' },
    }, 'OPEN'],
  ])('rejects a %s cursor before any finding query', async (_name, transform, nextContext, status) => {
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockResolvedValue([row('a', 500), row('b', 490)])
    const first = createMocks({ method: 'GET', query: { limit: '1', status: 'OPEN' } })
    await handler(first.req as never, first.res as never)
    const cursor = first.res._getJSONData().pagination.nextCursor
    ;(prisma.intelligenceFinding.findMany as jest.Mock).mockClear()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(nextContext)
    const second = createMocks({ method: 'GET', query: { cursor: transform(cursor), status } })
    await handler(second.req as never, second.res as never)
    expect(second.res._getStatusCode()).toBe(400)
    expect(second.res._getJSONData()).toEqual({ error: 'Invalid cursor' })
    expect(prisma.intelligenceFinding.findMany).not.toHaveBeenCalled()
  })

  it('rejects malformed and repeated cursor parameters before querying', async () => {
    for (const cursor of ['not-signed', ['one', 'two']]) {
      const { req, res } = createMocks({ method: 'GET', query: { cursor } })
      await handler(req as never, res as never)
      expect(res._getStatusCode()).toBe(400)
    }
    expect(prisma.intelligenceFinding.findMany).not.toHaveBeenCalled()
  })
})
