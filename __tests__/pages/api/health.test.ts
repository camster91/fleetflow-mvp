import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: jest.fn() } }))
import handler from '@/pages/api/health'
import { prisma } from '@/lib/prisma'

describe('/api/health', () => {
  beforeEach(() => jest.clearAllMocks())

  it('reports readiness without exposing database data', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }])
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res.getHeader('Cache-Control')).toBe('no-store')
    expect(res._getJSONData()).toEqual({ status: 'ok' })
  })

  it('returns a generic unavailable state when the database cannot be reached', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('postgres password=not-for-response'))
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(503)
    expect(res._getData()).toBe('{"status":"unavailable"}')
  })

  it('allows only GET', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
})
