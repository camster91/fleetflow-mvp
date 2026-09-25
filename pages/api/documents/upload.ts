import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, createHmac, randomUUID } from 'crypto'
import path from 'path'
import { Prisma } from '@prisma/client'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { canManageMaintenance, canViewMaintenance } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_RETENTION_DAYS,
  inspectDocument,
  sanitizeDocumentName,
} from '@/lib/documents/extraction'
import { extractionResultSchema } from '@/lib/documents/extraction'
import { runMalwareScan, scannerFromEnv, storageFromEnv } from '@/lib/documents/storage'

export const config = { api: { bodyParser: false } }
const root = () => {
  if (process.env.DOCUMENT_STORAGE_PATH) return process.env.DOCUMENT_STORAGE_PATH
  if (process.env.NODE_ENV === 'production') throw new Error('DOCUMENT_STORAGE_PATH is not configured')
  return path.join(process.cwd(), '.private-documents')
}
const storage = () => storageFromEnv({ ...process.env, DOCUMENT_STORAGE_PATH: root() })
const scope = (ownerId: string, teamId: string | null) => (teamId ? `team:${teamId}` : `owner:${ownerId}`)
const whereScope = (ownerId: string, teamId: string | null) => ({ ownerId, teamId })
const READY_DOCUMENT_STATES = new Set(['UPLOADED', 'EXTRACTED', 'REVIEWED', 'CONFIRMED'])
const STORING_STALE_MS = 2 * 60_000
function safeExtraction(raw: string | null | undefined) {
  if (!raw) return null
  try {
    const parsed = extractionResultSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
function documentDto(row: {
  id: string
  originalName: string
  mimeType: string
  byteSize: number
  status: string
  scanStatus: string
  extraction?: string | null
  revision: number
  expiresAt: Date
  createdAt: Date
}) {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    status: row.status,
    scanStatus: row.scanStatus,
    extraction: safeExtraction(row.extraction),
    revision: row.revision,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }
}

async function body(req: NextApiRequest): Promise<Buffer> {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > DOCUMENT_MAX_BYTES)
    throw Object.assign(new Error('Document is too large'), { statusCode: 413 })
  const chunks: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const chunk = Buffer.from(part)
    size += chunk.length
    if (size > DOCUMENT_MAX_BYTES) throw Object.assign(new Error('Document is too large'), { statusCode: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function storageKey(contentHash: string, scopeKey: string) {
  const secret =
    process.env.DOCUMENT_STORAGE_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'development-only-document-storage-key')
  if (secret.length < 32) throw new Error('DOCUMENT_STORAGE_SECRET is not configured')
  const opaque = createHmac('sha256', secret).update(`${scopeKey}:${contentHash}`).digest('hex')
  return `${opaque.slice(0, 2)}/${opaque}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  const { tenant, session } = context
  if (!canViewMaintenance(tenant.role)) return res.status(403).json({ error: 'Forbidden' })
  if (!(await rateLimitMiddleware(req, res, 'api', `documents:${session.user.id}`))) return

  if (req.method === 'GET') {
    const id = typeof req.query.id === 'string' ? req.query.id : null
    if (id) {
      const row = await prisma.documentUpload.findFirst({
        where: { id, ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null },
      })
      if (!row || row.expiresAt <= new Date()) return res.status(404).json({ error: 'Document not found' })
      const bytes = await storage().read(row.storageKey)
      res.setHeader('Content-Type', row.mimeType)
      res.setHeader('Content-Disposition', `inline; filename="${row.originalName.replace(/["\\]/g, '')}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
      return res.status(200).send(bytes)
    }
    const rows = await prisma.documentUpload.findMany({
      where: { ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        byteSize: true,
        status: true,
        scanStatus: true,
        extraction: true,
        revision: true,
        expiresAt: true,
        createdAt: true,
      },
    })
    return res.status(200).json({ documents: rows.map(documentDto) })
  }
  if (!canManageMaintenance(tenant.role)) return res.status(403).json({ error: 'Insufficient role' })
  if (req.method === 'DELETE') {
    const id = typeof req.query.id === 'string' ? req.query.id : ''
    const token = randomUUID()
    const now = new Date()
    const claim = await prisma
      .$transaction(
        async (tx) => {
          const initial = await tx.documentUpload.findFirst({
            where: { id, ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null },
          })
          if (!initial) return null
          await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${initial.scopeKey}, 0))) AS document_lock`
          const row = await tx.documentUpload.findFirst({
            where: { id, ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null },
          })
          if (!row) return null
          if (row.status === 'DELETING') return { busy: true as const }
          const claimed = await tx.documentUpload.updateMany({
            where: { id: row.id, revision: row.revision, storageKey: row.storageKey, deletedAt: null },
            data: {
              status: 'DELETING',
              cleanupToken: token,
              cleanupClaimedAt: now,
              processingToken: null,
              processingLeaseUntil: null,
              revision: { increment: 1 },
            },
          })
          return claimed.count === 1 ? { ...row, revision: row.revision + 1 } : null
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
          return { busy: true as const }
        throw error
      })
    if (!claim) return res.status(404).json({ error: 'Document not found or changed' })
    if ('busy' in claim) return res.status(409).json({ error: 'Document deletion is already in progress' })
    const owned = await prisma.documentUpload.findFirst({
      where: {
        id: claim.id,
        status: 'DELETING',
        cleanupToken: token,
        revision: claim.revision,
        storageKey: claim.storageKey,
        deletedAt: null,
      },
    })
    if (!owned) return res.status(409).json({ error: 'Deletion ownership changed; retry safely' })
    try {
      await storage().delete(owned.storageKey)
    } catch {
      return res.status(503).json({ error: 'Private document storage is unavailable; deletion will be retried' })
    }
    const finalized = await prisma.documentUpload.updateMany({
      where: {
        id: owned.id,
        status: 'DELETING',
        cleanupToken: token,
        revision: owned.revision,
        storageKey: owned.storageKey,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
        status: 'DELETED',
        extraction: null,
        reviewDraft: null,
        cleanupToken: null,
        cleanupClaimedAt: null,
        revision: { increment: 1 },
      },
    })
    if (finalized.count !== 1) return res.status(409).json({ error: 'Deletion ownership changed after object removal' })
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        teamId: tenant.teamId,
        userName: session.user.name,
        userRole: tenant.role,
        action: 'deleted',
        entityType: 'document',
        entityId: owned.id,
        entityName: owned.originalName,
        description: 'Deleted private document and extracted data',
      },
    })
    return res.status(204).end()
  }

  let bytes: Buffer
  try {
    bytes = await body(req)
  } catch (error) {
    return res
      .status(Number((error as { statusCode?: number }).statusCode) || 400)
      .json({ error: (error as Error).message })
  }
  const mime = Array.isArray(req.headers['content-type'])
    ? req.headers['content-type'][0]
    : (req.headers['content-type'] || '').split(';')[0].trim()
  let decodedName = String(req.headers['x-file-name'] || 'document')
  try {
    decodedName = decodeURIComponent(decodedName)
  } catch {
    return res.status(400).json({ error: 'Invalid file name' })
  }
  const originalName = sanitizeDocumentName(decodedName)
  let inspected: ReturnType<typeof inspectDocument>
  try {
    inspected = inspectDocument(bytes, mime, { authoritativeComplexPdf: true })
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }
  let scan: { status: 'CLEAN' | 'SKIPPED'; authoritativeDocumentSafety?: true }
  try {
    scan = await runMalwareScan(scannerFromEnv(process.env), bytes, {
      production: process.env.NODE_ENV === 'production',
      timeoutMs: 15_000,
    })
  } catch {
    return res.status(503).json({ error: 'Document scanning is unavailable' })
  }
  if (inspected.kind === 'pdf' && inspected.complex && !scan.authoritativeDocumentSafety)
    return res.status(400).json({ error: 'Complex or compressed PDF requires an authoritative safety adapter' })
  const scanStatus = scan.authoritativeDocumentSafety ? 'CLEAN_AUTHORITATIVE' : scan.status
  const contentSha256 = createHash('sha256').update(bytes).digest('hex')
  const scopeKey = scope(tenant.ownerId, tenant.teamId)
  const key = storageKey(contentSha256, scopeKey)
  let reservation: { row: Awaited<ReturnType<typeof prisma.documentUpload.create>>; duplicate: boolean }
  try {
    reservation = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS acquired FROM (SELECT pg_advisory_xact_lock(hashtextextended(${scopeKey}, 0))) AS document_lock`
        const existing = await tx.documentUpload.findUnique({
          where: { scopeKey_contentSha256: { scopeKey, contentSha256 } },
        })
        if (
          existing &&
          !existing.deletedAt &&
          existing.expiresAt > new Date() &&
          READY_DOCUMENT_STATES.has(existing.status)
        )
          return { row: existing, duplicate: true }
        if (
          existing &&
          !existing.deletedAt &&
          existing.expiresAt > new Date() &&
          existing.status === 'STORING' &&
          Date.now() - existing.updatedAt.getTime() <= STORING_STALE_MS
        )
          throw Object.assign(new Error('Duplicate upload is still being stored; retry shortly'), { statusCode: 409 })
        if (existing && existing.status === 'DELETING')
          throw Object.assign(new Error('A prior copy is being securely deleted; retry later'), { statusCode: 409 })
        const [count, totals] = await Promise.all([
          tx.documentUpload.count({
            where: { ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null, expiresAt: { gt: new Date() } },
          }),
          tx.documentUpload.aggregate({
            where: { ...whereScope(tenant.ownerId, tenant.teamId), deletedAt: null, expiresAt: { gt: new Date() } },
            _sum: { byteSize: true },
          }),
        ])
        if (count >= 200 || (totals._sum.byteSize || 0) + bytes.length > 500 * 1024 * 1024)
          throw Object.assign(new Error('Document storage quota exceeded'), { statusCode: 429 })
        const expiresAt = new Date(Date.now() + DOCUMENT_RETENTION_DAYS * 86_400_000)
        const row = existing
          ? await tx.documentUpload.update({
              where: { id: existing.id },
              data: {
                uploadedById: session.user.id,
                uploadedBySnapshot: session.user.email || session.user.id,
                originalName,
                mimeType: mime,
                byteSize: bytes.length,
                storageKey: key,
                scanStatus,
                status: 'STORING',
                extraction: null,
                reviewDraft: null,
                extractedAt: null,
                deletedAt: null,
                cleanupToken: null,
                cleanupClaimedAt: null,
                processingToken: null,
                processingLeaseUntil: null,
                revision: { increment: 1 },
                expiresAt,
              },
            })
          : await tx.documentUpload.create({
              data: {
                ownerId: tenant.ownerId,
                teamId: tenant.teamId,
                scopeKey,
                uploadedById: session.user.id,
                uploadedBySnapshot: session.user.email || session.user.id,
                originalName,
                mimeType: mime,
                byteSize: bytes.length,
                contentSha256,
                storageKey: key,
                scanStatus,
                status: 'STORING',
                expiresAt,
              },
            })
        return { row, duplicate: false }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    if (reservation.duplicate) return res.status(200).json({ document: documentDto(reservation.row), duplicate: true })
    try {
      await storage().put(key, bytes)
    } catch {
      await prisma.documentUpload.updateMany({
        where: { id: reservation.row.id, status: 'STORING', revision: reservation.row.revision },
        data: { status: 'FAILED', deletedAt: new Date() },
      })
      return res.status(503).json({ error: 'Private document storage is unavailable' })
    }
    const finalized = await prisma.documentUpload.updateMany({
      where: { id: reservation.row.id, status: 'STORING', revision: reservation.row.revision },
      data: { status: 'UPLOADED' },
    })
    if (finalized.count !== 1) return res.status(409).json({ error: 'Upload ownership changed; retry safely' })
    const row = await prisma.documentUpload.findUniqueOrThrow({ where: { id: reservation.row.id } })
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        teamId: tenant.teamId,
        userName: session.user.name,
        userRole: tenant.role,
        action: 'created',
        entityType: 'document',
        entityId: row.id,
        entityName: originalName,
        description: 'Uploaded private document for reviewed extraction',
      },
    })
    return res.status(201).json({ document: documentDto(row), duplicate: false })
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode)
    if (status) return res.status(status).json({ error: (error as Error).message })
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
      return res.status(409).json({ error: 'Concurrent upload changed the quota reservation; retry safely' })
    return res.status(503).json({ error: 'Document upload is temporarily unavailable' })
  }
}
