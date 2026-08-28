import { createMocks } from 'node-mocks-http'
import { readFileSync } from 'fs'
import { join } from 'path'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    vendingMachine: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/fleet', () => ({
  dbToVendingMachine: (machine: unknown) => machine,
  vendingMachineToDb: jest.fn((machine) => machine),
  logActivity: jest.fn(),
}))

import collectionHandler from '@/pages/api/vending-machines/index'
import itemHandler from '@/pages/api/vending-machines/[id]'
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

describe('vending-machine mutation security and integrity', () => {
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
    const { req, res } = createMocks({
      method: 'POST',
      body: { name: 'Lobby', location: 'HQ', status: 'active' },
    })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    [{ name: 'Lobby', location: 'HQ', status: 'unknown' }, 'Invalid option'],
    [{ name: 'Lobby', location: 'HQ', lastService: 'not-a-date' }, 'Invalid date'],
  ])('rejects malformed creation payloads', async (body, error) => {
    const { req, res } = createMocks({ method: 'POST', body })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().error).toContain(error)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('requires complete, valid update payloads', async () => {
    const { req, res } = createMocks({
      method: 'PUT',
      query: { id: 'machine-1' },
      body: { status: 'active' },
    })

    await itemHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('keeps vending-machine changes and activity records transactional', () => {
    const collection = readFileSync(join(process.cwd(), 'pages/api/vending-machines/index.ts'), 'utf8')
    const item = readFileSync(join(process.cwd(), 'pages/api/vending-machines/[id].ts'), 'utf8')

    expect(collection).toContain('const machine = await prisma.$transaction(async (tx) => {')
    expect(collection).toContain('const created = await tx.vendingMachine.create({ data })')
    expect(item).toContain('const result = await tx.vendingMachine.updateMany({ where: scopedWhere, data })')
    expect(item).toContain('const result = await tx.vendingMachine.deleteMany({ where: scopedWhere })')
    expect(collection.match(/await logActivity\(tx, \{/g)).toHaveLength(1)
    expect(item.match(/await logActivity\(tx, \{/g)).toHaveLength(2)
  })
})
