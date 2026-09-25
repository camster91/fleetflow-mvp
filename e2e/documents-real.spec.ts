import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { access } from 'fs/promises'
import path from 'path'

const db = new PrismaClient(); const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const ownerId = `doc-owner-${suffix}`, managerId = `doc-manager-${suffix}`, outsiderId = `doc-outsider-${suffix}`, teamId = `doc-team-${suffix}`, outsiderTeamId = `doc-other-team-${suffix}`, vehicleId = `doc-vehicle-${suffix}`
let documentId: string | undefined

async function token(id: string, role: string) { return new SignJWT({ sub: id, email: `${id}@test.invalid`, role, purpose: 'session' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!)) }

test.afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId: { in: [ownerId, managerId, outsiderId] } } })
  if (documentId) await db.documentExecution.deleteMany({ where: { documentId } })
  await db.expenseRecord.deleteMany({ where: { ownerId } }); await db.maintenanceTask.deleteMany({ where: { ownerId } }); await db.documentUpload.deleteMany({ where: { ownerId } })
  await db.vehicle.deleteMany({ where: { ownerId } }); await db.teamMember.deleteMany({ where: { teamId } }); await db.team.deleteMany({ where: { id: { in: [teamId, outsiderTeamId] } } }); await db.user.deleteMany({ where: { id: { in: [ownerId, managerId, outsiderId] } } }); await db.$disconnect()
})

test('real database upload, review, concurrent confirmation, isolation, and deletion', async ({ request, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Disposable local database only')
  await db.user.createMany({ data: [{ id: ownerId, email: `${ownerId}@test.invalid`, name: 'Owner' }, { id: managerId, email: `${managerId}@test.invalid`, name: 'Manager' }, { id: outsiderId, email: `${outsiderId}@test.invalid`, name: 'Outsider' }] })
  await db.team.create({ data: { id: teamId, name: 'Document QA', ownerId } }); await db.teamMember.create({ data: { teamId, userId: managerId, role: 'MANAGER', status: 'ACCEPTED', joinedAt: new Date() } })
  await db.team.create({ data: { id: outsiderTeamId, name: 'Other QA', ownerId: outsiderId } })
  await db.vehicle.create({ data: { id: vehicleId, name: 'QA Van', ownerId, teamId } })
  const jwt = await token(managerId, 'MANAGER'); const headers = { cookie: `token=${jwt}; fleetflow_team=${teamId}`, origin: baseURL!, host: new URL(baseURL!).host }
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj <</Type /Page>> endobj\nstartxref\n1\n%%EOF')
  const uploads = await Promise.all(['QA invoice.pdf', 'duplicate.pdf'].map(name => request.post(`${baseURL}/api/documents/upload`, { headers: { ...headers, 'content-type': 'application/pdf', 'x-file-name': encodeURIComponent(name) }, data: pdf })))
  const statuses = uploads.map(response => response.status()); expect(statuses.filter(status => status === 201)).toHaveLength(1); expect(statuses.every(status => [200, 201, 409].includes(status))).toBe(true); const uploadBodies = await Promise.all(uploads.map(response => response.json())); documentId = uploadBodies[statuses.indexOf(201)].document.id
  const readyDuplicate = await request.post(`${baseURL}/api/documents/upload`, { headers: { ...headers, 'content-type': 'application/pdf', 'x-file-name': 'retry.pdf' }, data: pdf }); expect(readyDuplicate.status()).toBe(200); expect((await readyDuplicate.json()).document.id).toBe(documentId)
  await db.documentUpload.update({ where: { id: documentId }, data: { status: 'STORING', updatedAt: new Date(Date.now() - 5 * 60_000) } })
  const recovered = await request.post(`${baseURL}/api/documents/upload`, { headers: { ...headers, 'content-type': 'application/pdf', 'x-file-name': 'recovered.pdf' }, data: pdf }); expect(recovered.status()).toBe(201); expect((await recovered.json()).document.id).toBe(documentId)
  const beforeLease = await db.documentUpload.findUniqueOrThrow({ where: { id: documentId }, select: { revision: true } }); const oldToken = `old-${suffix}`
  await db.documentUpload.update({ where: { id: documentId }, data: { status: 'EXTRACTING', processingToken: oldToken, processingLeaseUntil: new Date(Date.now() + 60_000) } })
  const liveLease = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'extract' } }); expect(liveLease.status()).toBe(409)
  await db.documentUpload.update({ where: { id: documentId }, data: { processingLeaseUntil: new Date(Date.now() - 1_000) } })
  const extract = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'extract' } }); expect(extract.status()).toBe(200); const extracted = await extract.json()
  const oldWorkerFinalize = await db.documentUpload.updateMany({ where: { id: documentId, status: 'EXTRACTING', revision: beforeLease.revision, processingToken: oldToken }, data: { status: 'EXTRACTED', extraction: JSON.stringify({ overwritten: true }) } }); expect(oldWorkerFinalize.count).toBe(0)
  const reviewed = { documentType: 'service_invoice', fields: { vendor: { value: 'QA Garage', confidence: 0, citationIds: [] }, date: { value: '2026-08-08', confidence: 0, citationIds: [] }, subtotal: { value: 100, confidence: 0, citationIds: [] }, tax: { value: 25, confidence: 0, citationIds: [] }, total: { value: 125, confidence: 0, citationIds: [] } }, services: [{ description: 'Oil service', quantity: 1, amount: 80, confidence: 0, citationIds: [] }], parts: [{ description: 'Oil filter', quantity: 1, amount: 20, confidence: 0, citationIds: [] }], citations: [], warnings: ['Manually verified'] }
  const draft = { kind: 'expense', vehicleId, values: { vehicleId, vendor: 'QA Garage', date: '2026-08-08', category: 'maintenance', subtotal: 100, tax: 25, total: 125, description: 'QA service' } }
  const save = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'save_draft', revision: extracted.revision, extraction: reviewed, draft } }); expect(save.status()).toBe(200); let revision = (await save.json()).revision
  const reloaded = await request.get(`${baseURL}/api/documents/upload`, { headers }); const persisted = (await reloaded.json()).documents.find((item: { id: string }) => item.id === documentId); expect(persisted.extraction).toMatchObject({ services: [{ description: 'Oil service', quantity: 1, amount: 80 }], parts: [{ description: 'Oil filter', quantity: 1, amount: 20 }] })
  const preview = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'preview', revision, draft } }); expect(preview.status()).toBe(200); const previewToken = (await preview.json()).previewToken
  expect(await db.expenseRecord.count({ where: { ownerId } })).toBe(0)
  const confirms = await Promise.all([1, 2].map(() => request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'confirm', confirm: true, previewToken } })))
  expect(confirms.map(response => response.status()).every(status => [200, 409].includes(status))).toBe(true)
  expect(await db.expenseRecord.count({ where: { ownerId } })).toBe(1); expect(await db.expenseRecord.findFirst({ where: { ownerId }, select: { subtotal: true, tax: true, total: true } })).toEqual({ subtotal: 100, tax: 25, total: 125 }); expect(await db.documentExecution.count({ where: { documentId } })).toBe(1); expect(await db.auditLog.count({ where: { userId: managerId, action: 'document_draft_confirmed' } })).toBe(1)
  // CONFIRMED is terminal (see __tests__/api/documents.review-state.test.ts): once a reviewed draft has
  // created a fleet record, the document cannot be re-drafted into a second record.
  const maintenanceDraft = { kind: 'maintenance', vehicleId, values: { vehicle: 'QA Van', type: 'Oil service', dueDate: '2026-08-08', priority: 'medium', serviceProvider: 'QA Garage', costEstimate: 125 } }
  const maintenanceSave = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'save_draft', revision, extraction: reviewed, draft: maintenanceDraft } }); expect(maintenanceSave.status()).toBe(409)
  const maintenancePreview = await request.post(`${baseURL}/api/documents/${documentId}/extract`, { headers: { ...headers, 'content-type': 'application/json' }, data: { action: 'preview', revision, draft: maintenanceDraft } }); expect(maintenancePreview.status()).toBe(409)
  expect(await db.maintenanceTask.count({ where: { ownerId } })).toBe(0); expect((await db.documentUpload.findUniqueOrThrow({ where: { id: documentId }, select: { status: true } })).status).toBe('CONFIRMED')
  const outsiderJwt = await token(outsiderId, 'fleet_manager'); const foreign = await request.get(`${baseURL}/api/documents/upload?id=${documentId}`, { headers: { ...headers, cookie: `token=${outsiderJwt}; fleetflow_team=${outsiderTeamId}` } }); expect(foreign.status()).toBe(404)
  const stored = await db.documentUpload.findUniqueOrThrow({ where: { id: documentId }, select: { storageKey: true } })
  await db.documentUpload.update({ where: { id: documentId }, data: { expiresAt: new Date(Date.now() - 1_000) } })
  const cleanup = process.env.CRON_SECRET
    ? request.post(`${baseURL}/api/cron/document-retention`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    : Promise.resolve(null)
  const [remove, retention] = await Promise.all([request.delete(`${baseURL}/api/documents/upload?id=${documentId}`, { headers }), cleanup])
  expect([204, 404, 409]).toContain(remove.status()); if (retention) expect(retention.status()).toBe(200)
  const deleted = await db.documentUpload.findUniqueOrThrow({ where: { id: documentId } }); expect(deleted.deletedAt).not.toBeNull(); expect(deleted.status).toMatch(/DELETED|EXPIRED/)
  if (process.env.DOCUMENT_STORAGE_PATH) await expect(access(path.join(process.env.DOCUMENT_STORAGE_PATH, stored.storageKey))).rejects.toThrow()
  await db.user.delete({ where: { id: managerId } })
  const durableUpload = await db.documentUpload.findUniqueOrThrow({ where: { id: documentId }, select: { uploadedById: true, uploadedBySnapshot: true } }); expect(durableUpload).toEqual({ uploadedById: null, uploadedBySnapshot: `${managerId}@test.invalid` })
  const durableExecution = await db.documentExecution.findFirstOrThrow({ where: { documentId }, select: { confirmerId: true, confirmerSnapshot: true } }); expect(durableExecution).toEqual({ confirmerId: null, confirmerSnapshot: 'Manager' })
})
