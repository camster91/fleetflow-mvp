import { createMocks } from 'node-mocks-http'
import { readFileSync } from 'fs'
import { join } from 'path'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    announcement: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/fleet', () => ({
  dbToAnnouncement: (announcement: unknown) => announcement,
  announcementToDb: jest.fn((announcement) => announcement),
  logActivity: jest.fn(),
}))

import collectionHandler from '@/pages/api/announcements/index'
import itemHandler from '@/pages/api/announcements/[id]'
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

describe('announcement mutation security and integrity', () => {
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
    const { req, res } = createMocks({ method: 'POST', body: { message: 'Notice' } })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    { message: 'Notice', actionUrl: 'javascript:alert(1)' },
    { message: 'Notice', actionUrl: '//attacker.example/path' },
    { message: 'Notice', expiresAt: 'not-a-date' },
    { message: '' },
  ])('rejects unsafe or malformed announcement payloads', async (body) => {
    const { req, res } = createMocks({ method: 'POST', body })

    await collectionHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ error: expect.any(String) })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('stops cross-origin deletion before lookup or write', async () => {
    ;(assertSameOrigin as jest.Mock).mockImplementation((_req, res) => {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    })
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'announcement-1' } })

    await itemHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.announcement.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('keeps announcement changes and activity records transactional', () => {
    const collection = readFileSync(join(process.cwd(), 'pages/api/announcements/index.ts'), 'utf8')
    const item = readFileSync(join(process.cwd(), 'pages/api/announcements/[id].ts'), 'utf8')

    expect(collection).toContain('const ann = await prisma.$transaction(async (tx) => {')
    expect(collection).toContain('const created = await tx.announcement.create({ data })')
    expect(collection).toContain('await logActivity(tx, {')
    expect(item).toContain('await prisma.$transaction(async (tx) => {')
    expect(item).toContain('await tx.announcement.deleteMany')
    expect(item).toContain('await logActivity(tx, {')
  })
})
