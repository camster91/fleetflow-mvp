import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/permissions', () => ({ canExportData: jest.fn(() => true) }))
jest.mock('@/lib/prisma', () => ({ prisma: { delivery: { findMany: jest.fn() } } }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))

import handler from '@/pages/api/reports/export'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

describe('/api/reports/export CSV safety', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      tenant: { role: 'OWNER', resourceWhere: { ownerId: 'owner-1', teamId: null } },
      session: { user: { id: 'owner-1' } },
    })
  })

  it.each(['=SUM(1,1)', '+1+1', '-1+1', '@HYPERLINK("https://evil.example")', '  =1+1'])(
    'literalizes formula-leading delivery text: %s',
    async (customer) => {
      ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([{
        customer, address: 'Address', status: 'pending', driver: null, items: 'Items',
        scheduledTime: null, completedTime: null, createdAt: new Date('2026-01-01T00:00:00Z'),
      }])
      const { req, res } = createMocks({ method: 'GET', query: { type: 'deliveries' } })

      await handler(req as never, res as never)

      expect(res._getStatusCode()).toBe(200)
      expect(res._getData()).toContain(`"'${customer.replace(/"/g, '""')}"`)
    }
  )
})
