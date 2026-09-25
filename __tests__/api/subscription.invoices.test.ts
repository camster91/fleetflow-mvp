import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() },
  },
}))

import handler from '@/pages/api/subscription/invoices'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('GET /api/subscription/invoices', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([])
  })

  it('requires authentication', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(401)
    expect(prisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it('returns an empty tenant-scoped invoice list', async () => {
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ invoices: [] })
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner-1' }, take: 100 })
    )
  })

  it('uses the selected team owner for an authorized manager', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'manager-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'MANAGER' }] },
    ])
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      headers: { 'x-team-id': 'team-1' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner-1' } }))
  })

  it('denies a viewer access to invoice history', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'viewer-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] },
    ])
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
      headers: { 'x-team-id': 'team-1' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.invoice.findMany).not.toHaveBeenCalled()
  })

  it('returns paid and failed invoice records without Stripe identifiers', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'i1',
        amount: 4900,
        currency: 'USD',
        status: 'paid',
        invoicePdf: 'https://invoice.stripe.com/i1.pdf',
        createdAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
      {
        id: 'i2',
        amount: 0,
        currency: 'USD',
        status: 'failed',
        invoicePdf: null,
        createdAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    ])
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const body = res._getJSONData() as { invoices: Array<{ status: string }> }
    expect(body.invoices.map((invoice: { status: string }) => invoice.status)).toEqual(['paid', 'failed'])
    expect(JSON.stringify(body)).not.toContain('stripeInvoiceId')
  })

  it('omits malformed records and removes unsafe PDF links', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'safe',
        amount: -500,
        currency: 'cad',
        status: 'paid',
        invoicePdf: 'javascript:alert(1)',
        createdAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
      {
        id: 'bad-currency',
        amount: 10,
        currency: 'ZZZ',
        status: 'paid',
        invoicePdf: null,
        createdAt: new Date(),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
      {
        id: 'bad-date',
        amount: 10,
        currency: 'USD',
        status: 'paid',
        invoicePdf: null,
        createdAt: new Date('invalid'),
        periodStart: new Date(),
        periodEnd: new Date(),
      },
    ])
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({
      invoices: [expect.objectContaining({ id: 'safe', amount: -500, currency: 'CAD', invoicePdf: null })],
    })
  })

  it('returns a generic error when invoice storage is unavailable', async () => {
    ;(prisma.invoice.findMany as jest.Mock).mockRejectedValue(new Error('database connection secret'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Failed to load invoices' })
    expect(errorSpy).toHaveBeenCalledWith('Invoice history query failed')
    errorSpy.mockRestore()
  })
})

function request() {
  return createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
}
