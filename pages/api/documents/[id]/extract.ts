import type { NextApiRequest, NextApiResponse } from 'next'
import path from 'path'
import { createHash, randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { canManageMaintenance } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
import { extractionResultSchema, extractorFromEnv, inspectDocument, runDocumentExtraction, signDocumentConfirmation, verifyDocumentConfirmation } from '@/lib/documents/extraction'
import { storageFromEnv } from '@/lib/documents/storage'
import { expenseCreateValuesSchema, maintenanceCreateValuesSchema } from '@/lib/validation'
import { parseActionPreviewKeyRing } from '@/lib/ai/actionRegistry'

const extractRequest = z.object({ action: z.literal('extract') }).strict()
const draftSchema = z.union([
  z.object({ kind: z.literal('maintenance'), vehicleId: z.string().min(1).max(64), values: maintenanceCreateValuesSchema }).strict(),
  z.object({ kind: z.literal('expense'), vehicleId: z.string().min(1).max(64), values: expenseCreateValuesSchema }).strict(),
])
const previewRequest = z.object({ action: z.literal('preview'), revision: z.number().int().positive(), draft: draftSchema }).strict()
const confirmRequest = z.object({ action: z.literal('confirm'), confirm: z.literal(true), previewToken: z.string().min(20).max(12_000) }).strict()
const editRequest = z.object({ action: z.literal('save_draft'), revision: z.number().int().positive(), extraction: extractionResultSchema, draft: draftSchema.nullable().optional() }).strict()
const requestSchema = z.union([extractRequest, previewRequest, confirmRequest, editRequest])
const keys = () => parseActionPreviewKeyRing(process.env)
const storage = () => { const configured = process.env.DOCUMENT_STORAGE_PATH; if (!configured && process.env.NODE_ENV === 'production') throw new Error('DOCUMENT_STORAGE_PATH is not configured'); return storageFromEnv({ ...process.env, DOCUMENT_STORAGE_PATH: configured || path.join(process.cwd(), '.private-documents') }) }
const extractor = () => extractorFromEnv(process.env)

async function load(id: string, ownerId: string, teamId: string | null) {
  return prisma.documentUpload.findFirst({ where: { id, ownerId, teamId, deletedAt: null, expiresAt: { gt: new Date() } } })
}

async function confirmWrite(payload: ReturnType<typeof verifyDocumentConfirmation>, user: { id: string; name?: string | null }, role: string) {
  try { return await prisma.$transaction(async tx => {
    const prior = await tx.documentExecution.findUnique({ where: { nonce: payload.nonce } })
    if (prior) return JSON.parse(prior.result)
    const doc = await tx.documentUpload.findFirst({ where: { id: payload.documentId, ownerId: payload.ownerId, teamId: payload.teamId, deletedAt: null, expiresAt: { gt: new Date() } } })
    if (!doc) throw Object.assign(new Error('Document not found'), { statusCode: 404 })
    if (doc.revision !== payload.revision || doc.status !== 'REVIEWED' || !doc.extraction || !doc.reviewDraft || createHash('sha256').update(doc.extraction).digest('hex') !== payload.extractionDigest || doc.reviewDraft !== JSON.stringify(payload.draft)) throw Object.assign(new Error('Reviewed draft changed since preview'), { statusCode: 409 })
    const vehicle = await tx.vehicle.findFirst({ where: { id: payload.draft.vehicleId, ...(payload.teamId ? { teamId: payload.teamId } : { ownerId: payload.ownerId, teamId: null }) } })
    if (!vehicle) throw Object.assign(new Error('Vehicle not found'), { statusCode: 404 })
    let result: { entityType: string; entityId: string }
    if (payload.draft.kind === 'maintenance') {
      const values = maintenanceCreateValuesSchema.parse(payload.draft.values)
      const row = await tx.maintenanceTask.create({ data: { title: values.type, type: values.type, vehicleId: vehicle.id, vehicleName: vehicle.name, dueDate: new Date(`${values.dueDate}T00:00:00.000Z`), priority: values.priority, notes: values.notes ?? null, estimatedDuration: values.estimatedDuration ?? null, partsNeeded: values.partsNeeded ? JSON.stringify(values.partsNeeded) : null, serviceProvider: values.serviceProvider ?? null, costEstimate: values.costEstimate ?? null, ownerId: payload.ownerId, teamId: payload.teamId } })
      result = { entityType: 'maintenance', entityId: row.id }
    } else {
      const values = expenseCreateValuesSchema.parse(payload.draft.values)
      const row = await tx.expenseRecord.create({ data: { ...values, date: new Date(`${values.date}T00:00:00.000Z`), ownerId: payload.ownerId, teamId: payload.teamId, sourceDocumentId: doc.id } })
      result = { entityType: 'expense', entityId: row.id }
    }
    const serialized = JSON.stringify(result)
    await tx.documentExecution.create({ data: { documentId: doc.id, nonce: payload.nonce, confirmerId: user.id, confirmerSnapshot: user.name || user.id, entityId: result.entityId, result: serialized } })
    await tx.documentUpload.update({ where: { id: doc.id }, data: { status: 'CONFIRMED' } })
    await tx.auditLog.create({ data: { userId: user.id, teamId: payload.teamId, userName: user.name ?? null, userRole: role, action: 'document_draft_confirmed', entityType: result.entityType, entityId: result.entityId, description: `Confirmed reviewed document ${payload.draft.kind} draft`, metadata: JSON.stringify({ documentId: doc.id, nonce: payload.nonce }) } })
    return result
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      const prior = await prisma.documentExecution.findUnique({ where: { nonce: payload.nonce } })
      if (prior) return JSON.parse(prior.result)
      throw Object.assign(new Error('Confirmation is being processed; retry safely'), { statusCode: 409 })
    }
    throw error
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res); if (!context) return
  if (!canManageMaintenance(context.tenant.role)) return res.status(403).json({ error: 'Insufficient role' })
  if (!await rateLimitMiddleware(req, res, 'api', `document-extract:${context.session.user.id}`)) return
  const parsed = requestSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Invalid document operation' })
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id
  if (!id) return res.status(400).json({ error: 'Document ID is required' })
  const doc = await load(id, context.tenant.ownerId, context.tenant.teamId)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  try {
    if (parsed.data.action === 'extract') {
      const claimNow = new Date(); const processingToken = randomBytes(18).toString('base64url')
      const claimed = await prisma.documentUpload.updateMany({ where: { id: doc.id, revision: doc.revision, OR: [{ status: { in: ['UPLOADED', 'FAILED', 'EXTRACTED'] } }, { status: 'EXTRACTING', processingLeaseUntil: { lte: claimNow } }], deletedAt: null, expiresAt: { gt: claimNow } }, data: { status: 'EXTRACTING', processingToken, processingLeaseUntil: new Date(claimNow.getTime() + 5_000), revision: { increment: 1 } } })
      if (claimed.count !== 1) return res.status(409).json({ error: 'Extraction is already running' })
      const claimRevision = doc.revision + 1
      const controller = new AbortController()
      const renewal = setInterval(() => { void prisma.documentUpload.updateMany({ where: { id: doc.id, status: 'EXTRACTING', revision: claimRevision, processingToken, storageKey: doc.storageKey, deletedAt: null, expiresAt: { gt: new Date() } }, data: { processingLeaseUntil: new Date(Date.now() + 5_000) } }).then(result => { if (result.count !== 1) controller.abort() }).catch(() => controller.abort()) }, 1_000)
      try {
        const bytes = await storage().read(doc.storageKey); const inspected = inspectDocument(bytes, doc.mimeType, { authoritativeComplexPdf: doc.scanStatus === 'CLEAN_AUTHORITATIVE' })
        const extraction = await runDocumentExtraction(extractor(), { bytes, mime: doc.mimeType, pages: inspected.pages }, { timeoutMs: 20_000, signal: controller.signal })
        const finalizeNow = new Date()
        const updated = await prisma.documentUpload.updateMany({ where: { id: doc.id, status: 'EXTRACTING', revision: claimRevision, processingToken, storageKey: doc.storageKey, deletedAt: null, expiresAt: { gt: finalizeNow } }, data: { extraction: JSON.stringify(extraction), status: 'EXTRACTED', extractedAt: finalizeNow, processingToken: null, processingLeaseUntil: null, revision: { increment: 1 } } })
        if (updated.count !== 1) { controller.abort(); return res.status(409).json({ error: 'Extraction ownership changed; result was discarded' }) }
        return res.status(200).json({ extraction, revision: claimRevision + 1 })
      } catch (error) {
        const failed = await prisma.documentUpload.updateMany({ where: { id: doc.id, status: 'EXTRACTING', revision: claimRevision, processingToken, storageKey: doc.storageKey, deletedAt: null, expiresAt: { gt: new Date() } }, data: { status: 'FAILED', processingToken: null, processingLeaseUntil: null, revision: { increment: 1 } } })
        if (failed.count !== 1) { controller.abort(); return res.status(409).json({ error: 'Extraction ownership changed; failure was discarded' }) }
        throw error
      } finally { clearInterval(renewal) }
    }
    if (parsed.data.action === 'save_draft') {
      const updated = await prisma.documentUpload.updateMany({ where: { id: doc.id, revision: parsed.data.revision, status: { in: ['EXTRACTED', 'REVIEWED'] }, deletedAt: null, expiresAt: { gt: new Date() } }, data: { extraction: JSON.stringify(parsed.data.extraction), reviewDraft: parsed.data.draft ? JSON.stringify(parsed.data.draft) : null, status: 'REVIEWED', revision: { increment: 1 } } })
      if (updated.count !== 1) return res.status(409).json({ error: 'Draft changed since it was loaded' })
      return res.status(200).json({ revision: parsed.data.revision + 1 })
    }
    if (parsed.data.action === 'preview') {
      if (doc.revision !== parsed.data.revision || doc.status !== 'REVIEWED' || !doc.extraction || !doc.reviewDraft || doc.reviewDraft !== JSON.stringify(parsed.data.draft)) return res.status(409).json({ error: 'Save this exact reviewed draft before previewing it' })
      const vehicle = await prisma.vehicle.findFirst({ where: { id: parsed.data.draft.vehicleId, AND: [context.tenant.resourceWhere] }, select: { id: true, name: true } })
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' })
      const ring = keys()
      const token = signDocumentConfirmation({ documentId: doc.id, ownerId: context.tenant.ownerId, teamId: context.tenant.teamId, proposerId: context.session.user.id, extractionDigest: createHash('sha256').update(doc.extraction).digest('hex'), revision: doc.revision, draft: parsed.data.draft }, { secret: ring.currentSecret, kid: ring.currentKid, nonce: randomBytes(18).toString('base64url') })
      return res.status(200).json({ previewToken: token, before: null, after: parsed.data.draft, warning: 'No fleet record changes until you confirm.' })
    }
    const payload = verifyDocumentConfirmation(parsed.data.previewToken, { secrets: keys().secrets })
    if (payload.documentId !== doc.id || payload.ownerId !== context.tenant.ownerId || payload.teamId !== context.tenant.teamId || payload.proposerId !== context.session.user.id) return res.status(403).json({ error: 'Confirmation does not belong to this reviewer and workspace' })
    const result = await confirmWrite(payload, context.session.user, context.tenant.role)
    return res.status(200).json({ result })
  } catch (error) {
    const status = Number((error as { statusCode?: number }).statusCode) || (error instanceof z.ZodError ? 422 : 503)
    return res.status(status).json({ error: status === 503 ? 'Document processing is unavailable' : (error as Error).message })
  }
}
