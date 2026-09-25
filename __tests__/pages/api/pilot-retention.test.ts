import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pilotEvent: { deleteMany: jest.fn() },
    pilotIncident: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))
import handler from '@/pages/api/cron/pilot-retention'
import { prisma } from '@/lib/prisma'

const secret = 's'.repeat(32)

async function post(headers: Record<string, string>, method = 'POST') {
  const { req, res } = createMocks({ method: method as never, headers })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/cron/pilot-retention', () => {
  const original = process.env.CRON_SECRET
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = secret
    ;(prisma.pilotEvent.deleteMany as jest.Mock).mockReturnValue('events-op')
    ;(prisma.pilotIncident.deleteMany as jest.Mock).mockReturnValue('incidents-op')
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 5 }, { count: 2 }])
  })
  afterAll(() => {
    process.env.CRON_SECRET = original
  })

  it('rejects GET', async () => {
    const res = await post({ 'x-cron-secret': secret }, 'GET')
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('POST')
  })

  it.each([[{}], [{ 'x-cron-secret': 'wrong'.repeat(8) }], [{ authorization: 'Bearer nope' }]])(
    'rejects unauthorized requests %j before data access',
    async (headers) => {
      const res = await post(headers)
      expect(res._getStatusCode()).toBe(401)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    }
  )

  it('deletes only expired pilot events and incidents', async () => {
    const res = await post({ 'x-cron-secret': secret })
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ eventsDeleted: 5, incidentsDeleted: 2 })
    expect(prisma.pilotEvent.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: expect.any(Date) } } })
    expect(prisma.pilotIncident.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: expect.any(Date) } } })
    expect(prisma.$transaction).toHaveBeenCalledWith(['events-op', 'incidents-op'])
  })

  it('accepts a bearer token', async () => {
    const res = await post({ authorization: `Bearer ${secret}` })
    expect(res._getStatusCode()).toBe(200)
  })

  it('returns a generic 500 when cleanup fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('db down: postgres://secret'))
    const res = await post({ 'x-cron-secret': secret })
    expect(res._getStatusCode()).toBe(500)
    expect(JSON.stringify(res._getJSONData())).not.toContain('postgres')
  })
})
