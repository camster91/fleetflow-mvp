import { createMocks } from 'node-mocks-http'

const SAME_ORIGIN = { host: 'app.test', origin: 'http://app.test' }
import handler from '../../../pages/api/analytics/reports'

jest.mock('../../../lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('../../../lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))

import { getServerSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

const mockSession = { user: { id: 'user-1' } }
const emptyPrefs = { notificationPreferences: null }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/analytics/reports', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(401)
  })

  it('returns empty array when no reports saved', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(emptyPrefs)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const d = JSON.parse(res._getData())
    expect(d.reports).toEqual([])
  })

  it('returns saved reports from DB', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const saved = [
      {
        id: 'rpt_1',
        name: 'Test',
        type: 'fleet',
        schedule: 'weekly',
        format: 'pdf',
        createdAt: new Date().toISOString(),
      },
    ]
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreferences: JSON.stringify({ saved_reports: saved }),
    })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const d = JSON.parse(res._getData())
    expect(d.reports).toHaveLength(1)
    expect(d.reports[0].name).toBe('Test')
  })
})

describe('POST /api/analytics/reports', () => {
  it('returns 400 when required fields missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const { req, res } = createMocks({ method: 'POST', headers: SAME_ORIGIN, body: { name: 'X' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
  })

  it('creates report and persists to DB', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(emptyPrefs)
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
    const { req, res } = createMocks({
      method: 'POST',
      headers: SAME_ORIGIN,
      body: { name: 'Fleet Report', type: 'fleet', schedule: 'weekly', format: 'pdf' },
    })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(201)
    const d = JSON.parse(res._getData())
    expect(d.report.name).toBe('Fleet Report')
    expect(d.report.id).toMatch(/^rpt_/)
    expect(prisma.user.update).toHaveBeenCalled()
  })
})

describe('DELETE /api/analytics/reports', () => {
  it('returns 400 when id missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const { req, res } = createMocks({ method: 'DELETE', headers: SAME_ORIGIN, body: {} })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
  })

  it('returns 404 when report not found', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreferences: JSON.stringify({ saved_reports: [] }),
    })
    const { req, res } = createMocks({ method: 'DELETE', headers: SAME_ORIGIN, body: { id: 'nonexistent' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(404)
  })

  it('deletes report and returns success', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const saved = [
      {
        id: 'rpt_1',
        name: 'Old',
        type: 'fleet',
        schedule: 'weekly',
        format: 'pdf',
        createdAt: new Date().toISOString(),
      },
    ]
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      notificationPreferences: JSON.stringify({ saved_reports: saved }),
    })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
    const { req, res } = createMocks({ method: 'DELETE', headers: SAME_ORIGIN, body: { id: 'rpt_1' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const d = JSON.parse(res._getData())
    expect(d.success).toBe(true)
    // Verify saved array is now empty
    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0]
    const updatedPrefs = JSON.parse(updateCall.data.notificationPreferences)
    expect(updatedPrefs.saved_reports).toHaveLength(0)
  })
  it('refuses cross-site changes to saved reports', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    const { req, res } = createMocks({
      method: 'DELETE',
      headers: { host: 'app.test', origin: 'https://evil.test' },
      body: { id: 'rpt_1' },
    })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
