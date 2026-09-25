import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
    client: { findMany: jest.fn() },
  },
}))

import handler from '@/pages/api/intelligence/data-quality'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const models = [prisma.vehicle, prisma.delivery, prisma.maintenanceTask, prisma.client] as unknown as Array<{
  findMany: jest.Mock
}>

describe('GET /api/intelligence/data-quality', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const model of models) model.findMany.mockResolvedValue([])
  })

  it('rejects unsupported methods before authentication', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
    expect(requireTenantContext).not.toHaveBeenCalled()
  })

  it('includes a selected team owner’s legacy null-team rows through the internal compatibility scope', async () => {
    const resourceWhere = { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] }
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'member-1' } },
      tenant: { ownerId: 'owner-1', teamId: 'team-1', role: 'MEMBER', resourceWhere },
    })
    const { req, res } = createMocks({ method: 'GET' })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    for (const model of models) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: resourceWhere,
          orderBy: { id: 'asc' },
          take: 501,
        })
      )
      expect(model.findMany.mock.calls[0][0].select).toBeDefined()
      expect(model.findMany.mock.calls[0][0].include).toBeUndefined()
    }
    expect(res._getJSONData()).toEqual(
      expect.objectContaining({
        issues: [],
        summary: {
          total: 0,
          bySeverity: { high: 0, medium: 0, low: 0 },
          byEntity: { vehicle: 0, delivery: 0, maintenance: 0, client: 0 },
          countsComplete: true,
        },
        coverage: expect.objectContaining({ complete: true, sourceLimitPerEntity: 500, issueLimit: 100 }),
        generatedAt: expect.any(String),
      })
    )
  })

  it('keeps personal data owner-scoped and excludes all team rows', async () => {
    const resourceWhere = { ownerId: 'owner-1', teamId: null }
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere },
    })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    for (const model of models) {
      expect(model.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: resourceWhere,
        })
      )
    }
  })

  it('reports incomplete source coverage instead of claiming complete counts', async () => {
    const resourceWhere = { ownerId: 'owner-1', teamId: null }
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere },
    })
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 501 }, (_, index) => ({
        id: `v-${index}`,
        status: 'inactive',
        mileage: null,
        driver: null,
        lastService: null,
        nextService: null,
        updatedAt: new Date(),
        lastUpdated: new Date(),
      }))
    )
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    const body = res._getJSONData()
    expect(body.coverage).toEqual(expect.objectContaining({ complete: false, sourceTruncated: true }))
    expect(body.coverage.recordsScannedByEntity.vehicle).toBe(500)
    expect(body.summary.countsComplete).toBe(false)
  })

  it('returns the stable top 100 while keeping complete counts for a fully scanned source', async () => {
    const resourceWhere = { ownerId: 'owner-1', teamId: null }
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere },
    })
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        id: `v-${String(index).padStart(2, '0')}`,
        status: 'active',
        mileage: 0,
        driver: null,
        lastService: null,
        nextService: null,
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
        lastUpdated: new Date('2020-01-01'),
      }))
    )
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    const body = res._getJSONData()

    expect(body.issues).toHaveLength(100)
    expect(body.summary).toEqual(expect.objectContaining({ total: 125, countsComplete: true }))
    expect(body.summary.bySeverity).toEqual({ high: 25, medium: 75, low: 25 })
    expect(body.coverage).toEqual(
      expect.objectContaining({
        complete: false,
        sourceTruncated: false,
        issuesTruncated: true,
        issuesReturned: 100,
      })
    )
    expect(body.issues.map((issue: { id: string }) => issue.id)).toEqual(
      [...body.issues.map((issue: { id: string }) => issue.id)].sort((a: string, b: string) => {
        const issueA = body.issues.find((issue: { id: string }) => issue.id === a)
        const issueB = body.issues.find((issue: { id: string }) => issue.id === b)
        const rank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return rank[issueA.severity] - rank[issueB.severity] || a.localeCompare(b)
      })
    )
  })

  it('returns a safe error without exposing database details', async () => {
    const resourceWhere = { ownerId: 'owner-1', teamId: null }
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'owner-1' } },
      tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere },
    })
    ;(prisma.vehicle.findMany as jest.Mock).mockRejectedValue(new Error('postgres password secret'))
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Unable to assess data quality' })
    expect(res._getData()).not.toContain('secret')
    consoleSpy.mockRestore()
  })
})
