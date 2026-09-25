import { createMocks } from 'node-mocks-http'
import { readFileSync } from 'fs'
import type { NextApiRequest, NextApiResponse } from 'next'

// In-memory stand-in for Postgres: writes made inside a transaction are staged
// and only committed when the callback resolves. The (scope, key) unique index
// is enforced at commit, so a losing concurrent transaction rolls back all of
// its writes (including the created client) with P2002, as Postgres would.
type Row = Record<string, any>
const mockDb: { clients: Row[]; keys: Row[] } = { clients: [], keys: [] }
const mockBarrier: { waiting: number; size: number; release: (() => void)[] } = { waiting: 0, size: 1, release: [] }

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/fleet', () => ({
  dbToClient: (client: Row) => ({ ...client }),
  clientToDb: (client: Row) => ({ name: client.name, email: client.email }),
  logActivity: jest.fn(),
}))
jest.mock('@/lib/prisma', () => {
  const clone = (row: Row) => JSON.parse(JSON.stringify(row))
  const matches = (row: Row, where: Row) =>
    where.scope_key
      ? row.scope === where.scope_key.scope && row.key === where.scope_key.key
      : Object.entries(where).every(([field, value]) => {
          if (value && typeof value === 'object' && 'lte' in value) return new Date(row[field]) <= value.lte
          if (value && typeof value === 'object' && 'lt' in value) return new Date(row[field]) < value.lt
          return row[field] === value
        })
  let ids = 0
  const prisma = {
    idempotencyKey: {
      findUnique: jest.fn(async ({ where }: Row) => {
        const row = mockDb.keys.find((item) => matches(item, where))
        return row ? { ...clone(row), expiresAt: new Date(row.expiresAt) } : null
      }),
      deleteMany: jest.fn(async ({ where }: Row) => {
        const before = mockDb.keys.length
        mockDb.keys = mockDb.keys.filter((item) => !matches(item, where))
        return { count: before - mockDb.keys.length }
      }),
    },
    $transaction: jest.fn(async (fn: (tx: Row) => Promise<unknown>) => {
      const staged: { clients: Row[]; keys: Row[] } = { clients: [], keys: [] }
      const tx = {
        client: {
          create: jest.fn(async ({ data }: Row) => {
            const row = { id: `client-${++ids}`, ...data }
            staged.clients.push(row)
            return row
          }),
        },
        idempotencyKey: {
          create: jest.fn(async ({ data }: Row) => {
            staged.keys.push(data)
            return data
          }),
        },
      }
      const result = await fn(tx)
      // Hold every transaction until `size` of them are ready so concurrent
      // requests interleave deterministically.
      mockBarrier.waiting++
      if (mockBarrier.waiting < mockBarrier.size)
        await new Promise<void>((resolve) => mockBarrier.release.push(resolve))
      else mockBarrier.release.splice(0).forEach((resolve) => resolve())
      for (const key of staged.keys) {
        if (mockDb.keys.some((item) => item.scope === key.scope && item.key === key.key)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        }
      }
      mockDb.clients.push(...staged.clients)
      mockDb.keys.push(...staged.keys.map(clone))
      return result
    }),
  }
  return { prisma }
})

import handler from '@/pages/api/clients/index'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const tenant = { ownerId: 'owner-1', teamId: 'team-1', role: 'OWNER', resourceWhere: { teamId: 'team-1' } }
const asUser = (id: string) =>
  (requireTenantContext as jest.Mock).mockResolvedValue({ session: { user: { id, name: 'User' } }, tenant })

async function post(body: Row, headers: Record<string, string> = {}) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', body, headers })
  await handler(req, res)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.clients = []
  mockDb.keys = []
  mockBarrier.waiting = 0
  mockBarrier.size = 1
  mockBarrier.release = []
  asUser('owner-1')
})

describe('Idempotency-Key on POST /api/clients', () => {
  it('creates one row for the same key sent twice and replays the stored response', async () => {
    const headers = { 'idempotency-key': 'submit-0001' }
    const first = await post({ name: 'Acme', email: 'ops@acme.test' }, headers)
    // Same logical body with keys in a different order hashes the same.
    const second = await post({ email: 'ops@acme.test', name: 'Acme' }, headers)

    expect(first._getStatusCode()).toBe(201)
    expect(first.getHeader('Idempotent-Replayed')).toBeUndefined()
    expect(second._getStatusCode()).toBe(201)
    expect(second.getHeader('Idempotent-Replayed')).toBe('true')
    expect(second._getJSONData()).toEqual(first._getJSONData())
    expect(mockDb.clients).toHaveLength(1)
    expect(mockDb.keys).toHaveLength(1)
    expect(mockDb.keys[0]).toMatchObject({
      scope: 'team:team-1',
      key: 'submit-0001',
      userId: 'owner-1',
      route: 'POST /api/clients',
      statusCode: 201,
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(new Date(mockDb.keys[0].expiresAt).getTime() - new Date(mockDb.keys[0].createdAt).getTime()).toBe(
      24 * 60 * 60 * 1000
    )
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rejects the same key with a different body with 422 and creates nothing', async () => {
    const headers = { 'idempotency-key': 'submit-0002' }
    await post({ name: 'Acme' }, headers)
    const conflict = await post({ name: 'Other' }, headers)

    expect(conflict._getStatusCode()).toBe(422)
    expect(conflict._getJSONData()).toEqual({ error: expect.stringMatching(/different request/) })
    expect(mockDb.clients).toHaveLength(1)
  })

  it("does not replay another user's response for a reused key", async () => {
    const headers = { 'idempotency-key': 'submit-0003' }
    await post({ name: 'Acme' }, headers)
    asUser('member-2')
    const other = await post({ name: 'Acme' }, headers)

    expect(other._getStatusCode()).toBe(422)
    expect(mockDb.clients).toHaveLength(1)
  })

  it('keeps the existing behavior without a key', async () => {
    const first = await post({ name: 'Acme' })
    const second = await post({ name: 'Acme' })

    expect(first._getStatusCode()).toBe(201)
    expect(second._getStatusCode()).toBe(201)
    expect(second.getHeader('Idempotent-Replayed')).toBeUndefined()
    expect(mockDb.clients).toHaveLength(2)
    expect(mockDb.keys).toHaveLength(0)
    expect(prisma.idempotencyKey.findUnique).not.toHaveBeenCalled()
  })

  it.each(['short', 'has spaces in it', 'x'.repeat(129), 'dots.are.not.ok'])(
    'rejects malformed key %p before writing',
    async (key) => {
      const res = await post({ name: 'Acme' }, { 'idempotency-key': key })

      expect(res._getStatusCode()).toBe(400)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    }
  )

  it('does not store failed (non-2xx) responses, so a corrected retry can succeed', async () => {
    const headers = { 'idempotency-key': 'submit-0004' }
    const invalid = await post({ name: '' }, headers)
    expect(invalid._getStatusCode()).toBe(400)
    expect(mockDb.keys).toHaveLength(0)

    const valid = await post({ name: 'Acme' }, headers)
    expect(valid._getStatusCode()).toBe(201)
    expect(mockDb.clients).toHaveLength(1)
  })

  it('handles a concurrent duplicate by rolling back the loser and replaying the winner', async () => {
    mockBarrier.size = 2
    const headers = { 'idempotency-key': 'submit-0005' }
    const [a, b] = await Promise.all([post({ name: 'Acme' }, headers), post({ name: 'Acme' }, headers)])

    // Both requests passed the initial lookup before either committed.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    expect(mockDb.clients).toHaveLength(1)
    expect(mockDb.keys).toHaveLength(1)
    expect([a._getStatusCode(), b._getStatusCode()]).toEqual([201, 201])
    expect([a.getHeader('Idempotent-Replayed'), b.getHeader('Idempotent-Replayed')].filter(Boolean)).toEqual(['true'])
    expect(a._getJSONData()).toEqual(b._getJSONData())
    expect((a._getJSONData() as Row).id).toBe(mockDb.clients[0].id)
  })

  it('treats an expired key as unused', async () => {
    mockDb.keys.push({
      scope: 'team:team-1',
      key: 'submit-0006',
      userId: 'owner-1',
      route: 'POST /api/clients',
      requestHash: 'stale',
      statusCode: 201,
      responseBody: { id: 'old' },
      createdAt: new Date(0).toISOString(),
      expiresAt: new Date(1).toISOString(),
    })
    const res = await post({ name: 'Acme' }, { 'idempotency-key': 'submit-0006' })

    expect(res._getStatusCode()).toBe(201)
    expect((res._getJSONData() as Row).id).not.toBe('old')
    expect(mockDb.keys).toHaveLength(1)
    expect(mockDb.clients).toHaveLength(1)
  })
})

describe('Idempotency-Key wiring on create routes', () => {
  it.each([
    ['deliveries', 'delivery', 'dbToDelivery'],
    ['vehicles', 'vehicle', 'dbToVehicle'],
    ['maintenance', 'task', 'dbToMaintenanceTask'],
    ['clients', 'client', 'dbToClient'],
  ])('POST /api/%s stores the response in the create transaction and replays conflicts', (route, variable, dto) => {
    // Compare structure, not layout: collapse whitespace and rejoin method chains Prettier splits across lines.
    const source = readFileSync(`${process.cwd()}/pages/api/${route}/index.ts`, 'utf8')
      .replace(/\s+/g, ' ')
      .replace(/ \./g, '.')
    const post = source.indexOf("if (req.method === 'POST')")
    const begin = source.indexOf(`beginIdempotentRequest(req, res, { tenant, userId, route: 'POST /api/${route}' })`)
    const transaction = source.indexOf(`const ${variable} = await prisma.$transaction(async (tx) => {`)
    const store = source.indexOf(`await idempotency.store(tx, 201, ${dto}(created))`)
    const conflict = source.indexOf('}).catch(idempotency.replayOnConflict)')
    expect(post).toBeGreaterThan(-1)
    expect(begin).toBeGreaterThan(post)
    expect(transaction).toBeGreaterThan(begin)
    expect(store).toBeGreaterThan(transaction)
    expect(conflict).toBeGreaterThan(store)
    expect(source).toContain(`return res.status(201).json(${dto}(${variable}))`)
  })
})
