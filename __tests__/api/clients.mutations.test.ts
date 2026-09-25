import { createMocks } from 'node-mocks-http'
import { readFileSync } from 'fs'
import { join } from 'path'

// Compare structure, not layout: collapse whitespace and rejoin method chains Prettier splits across lines.
const normalizeSource = (source: string) => source.replace(/\s+/g, ' ').replace(/ \./g, '.')

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/fleet', () => ({
  dbToClient: (client: unknown) => client,
  clientToDb: jest.fn((client) => client),
  logActivity: jest.fn(),
}))

import collectionHandler from '@/pages/api/clients/index'
import itemHandler from '@/pages/api/clients/[id]'
import { requireTenantContext, assertSameOrigin } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const tenantContext = {
  session: { user: { id: 'owner-1', name: 'Owner' } },
  tenant: {
    ownerId: 'owner-1',
    teamId: 'team-1',
    role: 'OWNER',
    resourceWhere: { OR: [{ teamId: 'team-1' }] },
  },
}

describe('client mutation security and integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(tenantContext)
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
  })

  it('stops cross-origin client creation before writing', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { name: 'Acme' } })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.client.create).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each(['PUT', 'DELETE'] as const)('stops cross-origin client %s before writing', async (method) => {
    const { req, res } = createMocks({ method, query: { id: 'client-1' }, body: { name: 'Acme' } })

    await itemHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.client.updateMany).not.toHaveBeenCalled()
    expect(prisma.client.deleteMany).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('keeps client changes and audit records in the same transaction', () => {
    const collection = normalizeSource(readFileSync(join(process.cwd(), 'pages/api/clients/index.ts'), 'utf8'))
    const item = normalizeSource(readFileSync(join(process.cwd(), 'pages/api/clients/[id].ts'), 'utf8'))

    expect(collection).toContain('const client = await prisma.$transaction(async (tx) => {')
    expect(collection).toContain('const created = await tx.client.create({ data })')
    expect(collection).toContain('await logActivity(tx, {')
    expect(item).toContain('const client = await prisma.$transaction(async (tx) => {')
    expect(item).toContain('const result = await tx.client.updateMany(')
    expect(item).toContain('await tx.client.deleteMany({ where: scopedWhere })')
    expect(item.match(/await logActivity\(tx, \{/g)).toHaveLength(2)
  })
})
