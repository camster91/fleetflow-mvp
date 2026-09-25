import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn(), assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documentUpload: { findFirst: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    documentExecution: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/documents/storage', () => ({
  ...jest.requireActual('@/lib/documents/storage'),
  storageFromEnv: jest.fn(() => ({ read: jest.fn(async () => Buffer.from('%PDF-1.7\n%%EOF')), delete: jest.fn() })),
}))

import extractHandler from '@/pages/api/documents/[id]/extract'
import uploadHandler from '@/pages/api/documents/upload'
import { requireTenantContext } from '@/lib/apiAuth'
import { assertSameOrigin } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
import { storageFromEnv } from '@/lib/documents/storage'

const context = {
  session: { user: { id: 'u1', name: 'Manager', email: 'manager@example.test' } },
  tenant: { ownerId: 'o1', teamId: 't1', role: 'MANAGER', resourceWhere: { teamId: 't1' } },
}
const document = {
  id: 'd1',
  ownerId: 'o1',
  teamId: 't1',
  scopeKey: 'team:t1',
  contentSha256: 'secret-hash',
  storageKey: `ab/${'a'.repeat(32)}`,
  uploadedById: 'u1',
  originalName: 'invoice.pdf',
  mimeType: 'application/pdf',
  byteSize: 20,
  status: 'UPLOADED',
  scanStatus: 'CLEAN',
  extraction: null,
  reviewDraft: null,
  revision: 1,
  deletedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
}

describe('document APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.documentUpload.findFirst as jest.Mock).mockReset()
    ;(prisma.documentUpload.updateMany as jest.Mock).mockReset()
    ;(prisma.$transaction as jest.Mock).mockReset()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) =>
      callback({ documentUpload: prisma.documentUpload, $queryRaw: jest.fn() })
    )
  })

  test('same-origin and rate gates stop processing before tenant data access', async () => {
    ;(assertSameOrigin as jest.Mock).mockReturnValueOnce(false)
    let mocks = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      body: { action: 'extract' },
      headers: { host: 'fleetvera.test' },
    })
    await extractHandler(mocks.req as never, mocks.res as never)
    expect(requireTenantContext).not.toHaveBeenCalled()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValueOnce(false)
    mocks = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      body: { action: 'extract' },
      headers: { host: 'fleetvera.test' },
    })
    await extractHandler(mocks.req as never, mocks.res as never)
    expect(prisma.documentUpload.findFirst).not.toHaveBeenCalled()
  })

  test('returns 404 instead of leaking a cross-tenant document', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'foreign' },
      body: { action: 'extract' },
      headers: { host: 'fleetvera.test' },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(404)
  })

  test('viewer cannot upload, extract, edit, preview, or confirm', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      ...context,
      tenant: { ...context.tenant, role: 'VIEWER' },
    })
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      body: { action: 'extract' },
      headers: { host: 'fleetvera.test' },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.documentUpload.findFirst).not.toHaveBeenCalled()
  })

  test('authenticated source response is private and never exposes a storage URL', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(document)
    const { req, res } = createMocks({ method: 'GET', query: { id: 'd1' }, headers: { host: 'fleetvera.test' } })
    await uploadHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
    expect(res.getHeader('X-Content-Type-Options')).toBe('nosniff')
    expect(res.getHeader('Content-Security-Policy')).toContain('sandbox')
    expect(res._getData()).not.toContain(document.storageKey)
  })

  test('list emits an explicit DTO without tenant, hash, uploader, or storage internals', async () => {
    ;(prisma.documentUpload.findMany as jest.Mock).mockResolvedValue([document])
    const { req, res } = createMocks({ method: 'GET', headers: { host: 'fleetvera.test' } })
    await uploadHandler(req as never, res as never)
    const raw = JSON.stringify(res._getJSONData())
    expect(res._getStatusCode()).toBe(200)
    for (const secret of [
      'storageKey',
      'contentSha256',
      'scopeKey',
      'ownerId',
      'teamId',
      'uploadedById',
      'secret-hash',
    ])
      expect(raw).not.toContain(secret)
  })

  test('preview is read-only and requires a current tenant vehicle', async () => {
    const extraction = {
      documentType: 'service_invoice',
      fields: {},
      services: [],
      parts: [],
      citations: [],
      warnings: [],
    }
    const draft = {
      kind: 'maintenance',
      vehicleId: 'v1',
      values: { vehicle: 'Van', type: 'Review invoice', dueDate: '2026-08-08', priority: 'medium' },
    }
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue({
      ...document,
      status: 'REVIEWED',
      extraction: JSON.stringify(extraction),
      reviewDraft: JSON.stringify(draft),
    })
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1', name: 'Van' })
    process.env.ACTION_PREVIEW_KEYS = JSON.stringify({ current: 'x'.repeat(32) })
    process.env.ACTION_PREVIEW_CURRENT_KID = 'current'
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      headers: { host: 'fleetvera.test' },
      body: { action: 'preview', revision: 1, draft },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toMatchObject({ before: null, warning: expect.stringMatching(/No fleet record/) })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test('stale editable draft is rejected without mutation', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(document)
    ;(prisma.documentUpload.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const extraction = { documentType: 'unknown', fields: {}, services: [], parts: [], citations: [], warnings: [] }
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      headers: { host: 'fleetvera.test' },
      body: { action: 'save_draft', revision: 4, extraction },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(409)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test('concurrent extraction claim is rejected without invoking a provider', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue({
      ...document,
      status: 'EXTRACTING',
      processingLeaseUntil: new Date(Date.now() + 60_000),
    })
    ;(prisma.documentUpload.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      headers: { host: 'fleetvera.test' },
      body: { action: 'extract' },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(409)
    expect(prisma.documentUpload.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: 'EXTRACTING',
              processingLeaseUntil: expect.objectContaining({ lte: expect.any(Date) }),
            }),
          ]),
        }),
      })
    )
  })

  test('takes over an expired extraction lease with a new revision and discards the old worker result', async () => {
    const stale = {
      ...document,
      status: 'EXTRACTING',
      processingToken: 'old-token',
      processingLeaseUntil: new Date(Date.now() - 60_000),
      revision: 7,
    }
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(stale)
    ;(prisma.documentUpload.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      headers: { host: 'fleetvera.test' },
      body: { action: 'extract' },
    })
    await extractHandler(req as never, res as never)
    expect((prisma.documentUpload.updateMany as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({ revision: 7, OR: expect.any(Array) }),
        data: expect.objectContaining({
          processingToken: expect.not.stringMatching(/^old-token$/),
          processingLeaseUntil: expect.any(Date),
          revision: { increment: 1 },
        }),
      })
    )
    expect(res._getStatusCode()).toBe(409)
    expect(res._getJSONData().error).toMatch(/ownership changed/i)
  })

  test('discards extraction output when deletion or retention wins the revision claim', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(document)
    ;(prisma.documentUpload.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'd1' },
      headers: { host: 'fleetvera.test' },
      body: { action: 'extract' },
    })
    await extractHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(409)
    expect(res._getJSONData().error).toMatch(/ownership changed/i)
  })

  test('does not delete bytes after a cleanup ownership recheck is lost', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock)
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce(document)
      .mockResolvedValueOnce(null)
    ;(prisma.documentUpload.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'd1' }, headers: { host: 'fleetvera.test' } })
    await uploadHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(409)
    expect(storageFromEnv).not.toHaveBeenCalled()
  })

  test('delete removes private bytes, clears extraction, and audits', async () => {
    ;(prisma.documentUpload.findFirst as jest.Mock).mockResolvedValue(document)
    ;(prisma.documentUpload.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.auditLog.create as jest.Mock).mockResolvedValue({})
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'd1' }, headers: { host: 'fleetvera.test' } })
    await uploadHandler(req as never, res as never)
    expect(res._getStatusCode()).toBe(204)
    expect(prisma.documentUpload.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELETED', extraction: null, reviewDraft: null }),
      })
    )
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entityType: 'document', entityId: 'd1' }) })
    )
  })
})
