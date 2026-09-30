import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/cronAuth', () => ({ isAuthorizedCronRequest: jest.fn() }))
const mockStorageDelete = jest.fn()
jest.mock('@/lib/documents/storage', () => ({ storageFromEnv: jest.fn(() => ({ delete: mockStorageDelete })) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    documentUpload: { findMany: jest.fn(), updateMany: jest.fn(), findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

import handler from '@/pages/api/cron/document-retention'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'
import { prisma } from '@/lib/prisma'

const db = prisma as unknown as { documentUpload: Record<string, jest.Mock>; $transaction: jest.Mock }
const env = process.env as Record<string, string | undefined>
const original = { NODE_ENV: env.NODE_ENV, DOCUMENT_STORAGE_PATH: env.DOCUMENT_STORAGE_PATH }
const expired = {
  id: 'd1',
  scopeKey: 'team:t1',
  revision: 3,
  storageKey: 'k1',
  expiresAt: new Date('2026-09-01T00:00:00Z'),
}

async function call(method = 'POST') {
  const { req, res } = createMocks({ method: method as never })
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  env.DOCUMENT_STORAGE_PATH = '/var/tmp/docs'
  ;(isAuthorizedCronRequest as jest.Mock).mockReturnValue(true)
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  db.documentUpload.findMany.mockResolvedValue([expired])
  db.documentUpload.updateMany.mockResolvedValue({ count: 1 })
  db.documentUpload.findFirst.mockResolvedValue({ ...expired, revision: 4, status: 'DELETING' })
  mockStorageDelete.mockResolvedValue(undefined)
})
afterAll(() => Object.assign(env, original))

describe('POST /api/cron/document-retention', () => {
  it('accepts only POST', async () => {
    expect((await call('GET'))._getStatusCode()).toBe(405)
  })

  it('requires the cron secret', async () => {
    ;(isAuthorizedCronRequest as jest.Mock).mockReturnValue(false)
    expect((await call())._getStatusCode()).toBe(401)
    expect(db.documentUpload.findMany).not.toHaveBeenCalled()
  })

  it('refuses to run in production without configured storage', async () => {
    delete env.DOCUMENT_STORAGE_PATH
    env.NODE_ENV = 'production'
    const res = await call()
    env.NODE_ENV = original.NODE_ENV
    expect(res._getStatusCode()).toBe(503)
  })

  it('claims, deletes the file, then marks the document expired', async () => {
    const res = await call()
    expect(res._getJSONData()).toEqual({ deleted: 1 })
    expect(mockStorageDelete).toHaveBeenCalledWith('k1')
    const [claim, finalize] = db.documentUpload.updateMany.mock.calls.map((c) => c[0])
    expect(claim.data.status).toBe('DELETING')
    expect(finalize.data).toMatchObject({ status: 'EXPIRED', extraction: null, reviewDraft: null })
  })

  it('skips a document another worker already claimed', async () => {
    db.documentUpload.updateMany.mockResolvedValueOnce({ count: 0 })
    const res = await call()
    expect(res._getJSONData()).toEqual({ deleted: 0 })
    expect(mockStorageDelete).not.toHaveBeenCalled()
  })

  it('leaves the record for a retry when the file cannot be deleted', async () => {
    mockStorageDelete.mockRejectedValue(new Error('disk'))
    const res = await call()
    expect(res._getJSONData()).toEqual({ deleted: 0 })
    expect(db.documentUpload.updateMany).toHaveBeenCalledTimes(1)
  })
})
