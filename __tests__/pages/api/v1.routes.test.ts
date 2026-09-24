import { createMocks } from 'node-mocks-http'

jest.mock('../../../lib/apiAuth', () => ({
  requireApiKey: jest.fn(),
  apiError: (res: any, status: number, code: string, message: string) =>
    res.status(status).json({ error: { code, message } }),
}))

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    vehicle: { findMany: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
    delivery: { findMany: jest.fn() },
  },
}))

import { requireApiKey } from '../../../lib/apiAuth'
import { prisma } from '../../../lib/prisma'
import vehicles from '../../../pages/api/v1/vehicles/index'
import maintenance from '../../../pages/api/v1/maintenance/index'
import deliveries from '../../../pages/api/v1/deliveries/index'
import me from '../../../pages/api/v1/me'
import docs from '../../../pages/api/docs'
import { createPublicApiCursor, readPublicApiCursor } from '../../../lib/publicApi'

const tenant = { ownerId: 'owner-1', teamId: 'team-1', role: 'OWNER', resourceWhere: { OR: [{ teamId: 'team-1' }, { ownerId: 'owner-1', teamId: null }] } }
const context = { apiKeyId: 'key-1', user: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' }, scopes: ['read'], tenant, apiResourceWhere: { teamId: 'team-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireApiKey as jest.Mock).mockResolvedValue(context)
})

describe('public v1 read API', () => {
  it.each([
    ['vehicles', vehicles, prisma.vehicle.findMany],
    ['maintenance', maintenance, prisma.maintenanceTask.findMany],
    ['deliveries', deliveries, prisma.delivery.findMany],
  ] as const)('%s returns only a tenant-scoped bounded cursor page', async (_name, handler, findMany) => {
    ;(findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const endpoint = `/api/v1/${_name}`
    const signedCursor = createPublicApiCursor(endpoint, context.apiResourceWhere, 'previous')
    const { req, res } = createMocks({ method: 'GET', query: { limit: '2', cursor: signedCursor } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: context.apiResourceWhere,
      orderBy: { id: 'asc' },
      cursor: { id: 'previous' },
      skip: 1,
      take: 3,
      select: expect.any(Object),
    }))
    const query = (findMany as jest.Mock).mock.calls[0][0]
    expect(query.select).not.toHaveProperty('ownerId')
    expect(query.select).not.toHaveProperty('teamId')
    expect(query.select).not.toHaveProperty('accessCodes')
    const body = JSON.parse(res._getData())
    expect(body.data).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(body.pagination.limit).toBe(2)
    expect(readPublicApiCursor(body.pagination.nextCursor, endpoint, context.apiResourceWhere)).toBe('b')
  })

  it.each([
    ['vehicles', vehicles, prisma.vehicle.findMany, 'TECHNICIAN'],
    ['deliveries', deliveries, prisma.delivery.findMany, 'TECHNICIAN'],
    ['maintenance', maintenance, prisma.maintenanceTask.findMany, 'DISPATCHER'],
  ] as const)('%s enforces the session view permission for %s', async (_name, handler, findMany, role) => {
    ;(requireApiKey as jest.Mock).mockResolvedValue({ ...context, tenant: { ...tenant, role } })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(403)
    expect(JSON.parse(res._getData()).error.code).toBe('FORBIDDEN')
    expect(findMany).not.toHaveBeenCalled()
  })

  it.each([
    ['vehicles', vehicles, prisma.vehicle.findMany, { assignedDriverId: 'driver-1' }],
    ['deliveries', deliveries, prisma.delivery.findMany, { assignedDriverId: 'driver-1' }],
    ['maintenance', maintenance, prisma.maintenanceTask.findMany, { vehicle: { assignedDriverId: 'driver-1' } }],
  ] as const)('%s scopes a driver key to assigned work with the driver field set', async (_name, handler, findMany, assignment) => {
    ;(requireApiKey as jest.Mock).mockResolvedValue({
      ...context,
      user: { id: 'driver-1', email: 'd@example.com', name: 'Driver' },
      tenant: { ...tenant, role: 'DRIVER' },
    })
    ;(findMany as jest.Mock).mockResolvedValue([])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const query = (findMany as jest.Mock).mock.calls[0][0]
    expect(query.where).toEqual({ AND: [context.apiResourceWhere, assignment] })
    expect(query.select).not.toHaveProperty('costEstimate')
    expect(query.select).not.toHaveProperty('completedTime')
    expect(query.select).not.toHaveProperty('year')
  })

  it('caps page size and rejects invalid pagination', async () => {
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([])
    const capped = createMocks({ method: 'GET', query: { limit: '500' } })
    await vehicles(capped.req as any, capped.res as any)
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 101 }))

    const invalid = createMocks({ method: 'GET', query: { limit: 'abc' } })
    await vehicles(invalid.req as any, invalid.res as any)
    expect(invalid.res._getStatusCode()).toBe(400)
    expect(JSON.parse(invalid.res._getData()).error.code).toBe('INVALID_PAGINATION')
  })

  it.each([
    ['empty', ''],
    ['malformed', 'not-a-cursor'],
    ['tampered', `${createPublicApiCursor('/api/v1/vehicles', context.apiResourceWhere, 'a').slice(0, -1)}x`],
    ['wrong endpoint', createPublicApiCursor('/api/v1/deliveries', context.apiResourceWhere, 'a')],
    ['wrong tenant', createPublicApiCursor('/api/v1/vehicles', { teamId: 'other-team' }, 'a')],
  ])('rejects a %s cursor before reading Prisma', async (_case, cursor) => {
    const { req, res } = createMocks({ method: 'GET', query: { cursor } })
    await vehicles(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
    expect(JSON.parse(res._getData()).error.code).toBe('INVALID_PAGINATION')
    expect(prisma.vehicle.findMany).not.toHaveBeenCalled()
  })

  it('returns a sanitized consistent error when a read fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(prisma.vehicle.findMany as jest.Mock).mockRejectedValue(new Error('database URL secret'))
    const { req, res } = createMocks({ method: 'GET' })
    await vehicles(req as any, res as any)
    expect(res._getStatusCode()).toBe(500)
    expect(JSON.parse(res._getData())).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed' } })
    expect(JSON.stringify(spy.mock.calls)).not.toContain('database URL secret')
    spy.mockRestore()
  })

  it('is read-only and returns a consistent method error', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await deliveries(req as any, res as any)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
    expect(JSON.parse(res._getData()).error.code).toBe('METHOD_NOT_ALLOWED')
    expect(prisma.delivery.findMany).not.toHaveBeenCalled()
    expect(requireApiKey).not.toHaveBeenCalled()
  })

  it('/me identifies the API caller, selected workspace, and scopes without a secret', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await me(req as any, res as any)
    expect(JSON.parse(res._getData())).toEqual({
      data: {
        apiKeyId: 'key-1',
        caller: { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        workspace: { id: 'team-1', ownerId: 'owner-1', role: 'OWNER', dataScope: 'team' },
        scopes: ['read'],
      },
    })
    expect(res._getData()).not.toContain('ff_')
  })

  it('/api/docs publishes truthful machine-readable documentation', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await docs(req as any, res as any)
    const body = JSON.parse(res._getData())
    expect(body.openapi).toBe('3.1.0')
    expect(body.paths).toEqual(expect.objectContaining({
      '/api/v1/me': expect.any(Object),
      '/api/v1/vehicles': expect.any(Object),
      '/api/v1/maintenance': expect.any(Object),
      '/api/v1/deliveries': expect.any(Object),
    }))
    expect(JSON.stringify(body)).toContain('x-team-id')
    expect(JSON.stringify(body)).toContain('Bearer')
    expect(JSON.stringify(body)).toContain('100 requests per minute')
    expect(JSON.stringify(body)).toContain('nextCursor')
    expect(JSON.stringify(body)).toContain('curl')
    expect(body.paths['/api/v1/vehicles'].get.security).toEqual([{ bearerAuth: [] }])
    expect(body.paths['/api/v1/vehicles'].get.responses).toEqual(expect.objectContaining({ '405': expect.any(Object), '500': expect.any(Object), '503': expect.any(Object) }))
    expect(body.paths['/api/v1/vehicles'].get.responses['503'].description).toContain('quota')
    expect(body.paths['/api/v1/vehicles'].get.responses['503'].description).toContain('cursor signing')
    for (const path of ['/api/v1/vehicles', '/api/v1/maintenance', '/api/v1/deliveries']) {
      expect(body.paths[path].get['x-codeSamples'][0].source).toContain(path)
    }
  })
})
