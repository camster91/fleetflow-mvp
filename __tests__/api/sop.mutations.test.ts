import { createMocks } from 'node-mocks-http'
import { readFileSync } from 'fs'
import { join } from 'path'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    sOPCategory: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/fleet', () => ({
  dbToSOPCategory: (category: unknown) => category,
  sopCategoryToDb: jest.fn((category) => category),
  logActivity: jest.fn(),
}))

import collectionHandler from '@/pages/api/sop/index'
import itemHandler from '@/pages/api/sop/[id]'
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

describe('SOP category mutation security and integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(tenantContext)
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
  })

  it('stops cross-origin creation before writing', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks({ method: 'POST', body: { name: 'Safety' } })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    { name: '' },
    { name: 'Safety', count: -1 },
    { name: 'Safety', count: 1.5 },
    { name: 'Safety', count: 1_000_001 },
    { name: 'x'.repeat(121) },
  ])('rejects malformed or unbounded category payloads', async (body) => {
    const { req, res } = createMocks({ method: 'POST', body })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stops cross-origin deletion before lookup or write', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'sop-1' } })

    await itemHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.sOPCategory.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('keeps category changes and activity records transactional', () => {
    const collection = readFileSync(join(process.cwd(), 'pages/api/sop/index.ts'), 'utf8')
    const item = readFileSync(join(process.cwd(), 'pages/api/sop/[id].ts'), 'utf8')

    expect(collection).toContain('const cat = await prisma.$transaction(async (tx) => {')
    expect(collection).toContain('const created = await tx.sOPCategory.create({ data })')
    expect(item).toContain('const result = await tx.sOPCategory.updateMany({')
    expect(item).toContain('const result = await tx.sOPCategory.deleteMany({ where: scopedWhere })')
    expect(collection.match(/await logActivity\(tx, \{/g)).toHaveLength(1)
    expect(item.match(/await logActivity\(tx, \{/g)).toHaveLength(2)
  })
})
