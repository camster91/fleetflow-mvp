import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { IntegrationConnection, Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { decryptCredentialEnvelope, encryptCredentialEnvelope, sanitizeProviderError } from '../../../../lib/integrations/oauth'
import { payloadHash, providerEndpoint, providerFromRequest, requireIntegrationAdmin } from '../../../../lib/integrations/runtime'
import { fetchJsonBounded, ProviderHttpError, safeRemoteId, syncIdempotencyKey } from '../../../../lib/integrations/sync'
import { stageIntegrationRecord } from '../../../../lib/integrations/staging'
import { enforceIntegrationRateLimit } from '../../../../lib/integrations/rateLimit'
import { SyncLeaseLostError, isReclaimableJob } from '../../../../lib/integrations/lease'
import { classifyGoogleGeocode } from '../../../../lib/integrations/googleStatus'

const BATCH_SIZE = 25, LEASE_MS = 30_000
class ReconnectHandledError extends Error {}

async function renewLease(tx: Prisma.TransactionClient, connection: IntegrationConnection, lockToken: string) {
  const now = new Date()
  const renewed = await tx.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, lockToken, lockExpiresAt: { gt: now } }, data: { lockExpiresAt: new Date(now.getTime() + LEASE_MS) } })
  if (renewed.count !== 1) throw new SyncLeaseLostError()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = providerFromRequest(req, res); if (!provider) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireIntegrationAdmin(req, res, true); if (!context) return
  if (!await enforceIntegrationRateLimit(context.session.user.id, context.scopeKey, provider.id, 'sync', res)) return
  const readiness = provider.readiness(); if (!readiness.ready) return res.status(503).json({ error: readiness.reason })
  const requestIdRaw = req.headers['idempotency-key']; const requestId = Array.isArray(requestIdRaw) ? requestIdRaw[0] : requestIdRaw
  if (!requestId || !/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) return res.status(400).json({ error: 'A valid Idempotency-Key header is required' })
  const connection = await prisma.integrationConnection.findUnique({ where: { scopeKey_provider: { scopeKey: context.scopeKey, provider: provider.id } } })
  if (!connection || connection.status !== 'CONNECTED' || connection.revokedAt) return res.status(409).json({ error: 'Integration is not connected' })
  const idempotencyKey = syncIdempotencyKey(provider.id, connection.syncCursor, requestId)
  const existing = await prisma.integrationSyncJob.findUnique({ where: { connectionId_idempotencyKey: { connectionId: connection.id, idempotencyKey } } })
  if (existing?.status === 'COMPLETED') return res.status(200).json({ job: existing, replayed: true })
  const now = new Date()
  if (existing?.status === 'RUNNING' && !isReclaimableJob(existing, now)) return res.status(202).json({ job: existing, replayed: true })

  const lockToken = crypto.randomUUID(), lockExpiresAt = new Date(now.getTime() + LEASE_MS)
  const locked = await prisma.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lte: now } }] }, data: { lockToken, lockExpiresAt } })
  if (locked.count !== 1) return res.status(409).json({ error: 'A sync is already in progress' })
  const job = await prisma.$transaction(async (tx) => {
    const value = existing
      ? await tx.integrationSyncJob.update({ where: { id: existing.id }, data: { generation: connection.generation, lockToken, lockExpiresAt, status: 'RUNNING', errorCode: null, completedAt: null, startedAt: now, attemptCount: { increment: 1 } } })
      : await tx.integrationSyncJob.create({ data: { connectionId: connection.id, idempotencyKey, generation: connection.generation, lockToken, lockExpiresAt, status: 'RUNNING', cursorBefore: connection.syncCursor, startedAt: now, attemptCount: 1 } })
    await tx.auditLog.create({ data: { userId: context.session.user.id, teamId: context.tenant.teamId, userName: context.session.user.name, userRole: context.tenant.role, action: 'integration_sync_started', entityType: 'integration_sync', entityId: value.id, entityName: provider.id, description: `${provider.name} sync started`, metadata: JSON.stringify({ provider: provider.id, generation: connection.generation, attempt: value.attemptCount }) } })
    return value
  })
  try {
    const result = provider.id === 'google-maps'
      ? await syncGoogleMaps(connection, lockToken, context.tenant.resourceWhere, context.session.user.id, context.tenant.teamId)
      : await syncQuickBooks(connection, lockToken, context.scopeKey, job.id, context.session.user.id, context.tenant.teamId, context.session.user.name, context.tenant.role)
    const completedAt = new Date()
    const allFailed = result.processed > 0 && result.applied === 0
    const outcomeError = allFailed ? 'GOOGLE_BATCH_FAILED' : result.failed > 0 || result.deferred > 0 || result.conflicts > 0 ? 'GOOGLE_PARTIAL_FAILURE' : null
    const completed = await prisma.$transaction(async (tx) => {
      const fenced = await tx.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, lockToken, lockExpiresAt: { gt: completedAt } }, data: { lockToken: null, lockExpiresAt: null, lastSyncAt: completedAt, nextSyncAt: new Date(completedAt.getTime() + (outcomeError ? 15 : 60) * 60_000), syncCursor: result.cursor, lastErrorCode: outcomeError } })
      if (fenced.count !== 1) throw new SyncLeaseLostError()
      const updated = await tx.integrationSyncJob.updateMany({ where: { id: job.id, generation: connection.generation, lockToken, status: 'RUNNING' }, data: { status: allFailed ? 'FAILED' : 'COMPLETED', errorCode: outcomeError, processedCount: result.processed, cursorAfter: result.cursor, completedAt } })
      if (updated.count !== 1) throw new SyncLeaseLostError()
      await tx.auditLog.create({ data: { userId: context.session.user.id, teamId: context.tenant.teamId, userName: context.session.user.name, userRole: context.tenant.role, action: allFailed ? 'integration_sync_failed' : 'integration_sync_completed', entityType: 'integration_sync', entityId: job.id, entityName: provider.id, description: allFailed ? `${provider.name} sync failed` : `${provider.name} sync completed`, metadata: JSON.stringify({ provider: provider.id, generation: connection.generation, processed: result.processed, applied: result.applied, conflicts: result.conflicts, failed: result.failed, deferred: result.deferred, errorCode: outcomeError }) } })
      return tx.integrationSyncJob.findUnique({ where: { id: job.id } })
    })
    return res.status(allFailed ? 503 : 200).json({ job: completed, outcomes: { applied: result.applied, conflicts: result.conflicts, failed: result.failed, deferred: result.deferred }, replayed: false, ...(allFailed ? { error: 'No records in this batch could be applied. Review integration outcomes.' } : {}) })
  } catch (error) {
    if (error instanceof ReconnectHandledError) return res.status(409).json({ error: 'Reconnect QuickBooks Online to continue syncing.', code: 'OAUTH_RECONNECT_REQUIRED' })
    const safe = sanitizeProviderError(error), errorCode = error instanceof SyncLeaseLostError ? 'SYNC_LEASE_LOST' : safe.code
    await prisma.$transaction(async (tx) => {
      const fenced = await tx.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, lockToken }, data: { lockToken: null, lockExpiresAt: null, lastErrorCode: errorCode, nextSyncAt: new Date(Date.now() + 15 * 60_000) } })
      if (fenced.count !== 1) return
      const failed = await tx.integrationSyncJob.updateMany({ where: { id: job.id, generation: connection.generation, lockToken, status: 'RUNNING' }, data: { status: 'FAILED', errorCode, completedAt: new Date() } })
      if (failed.count === 1) await tx.auditLog.create({ data: { userId: context.session.user.id, teamId: context.tenant.teamId, userName: context.session.user.name, userRole: context.tenant.role, action: 'integration_sync_failed', entityType: 'integration_sync', entityId: job.id, entityName: provider.id, description: `${provider.name} sync failed`, metadata: JSON.stringify({ provider: provider.id, generation: connection.generation, errorCode }) } })
    })
    return res.status(error instanceof SyncLeaseLostError ? 409 : 503).json({ error: error instanceof SyncLeaseLostError ? 'Sync ownership changed; retry safely.' : safe.message, code: errorCode })
  }
}

type GeocodeResponse = { status?: string; results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }> }
type QuickBooksResponse = { QueryResponse?: { Purchase?: unknown[] } }
type RefreshResponse = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown; x_refresh_token_expires_in?: unknown }

async function googleOutcome(connection: IntegrationConnection, lockToken: string, delivery: { id: string; address: string }, outcome: 'RETRY' | 'DEAD_LETTER', errorCode: string, reviewerId: string, teamId: string | null) {
  await prisma.$transaction(async (tx) => {
    await renewLease(tx, connection, lockToken)
    const existing = await tx.integrationRecord.findUnique({ where: { connectionId_remoteType_remoteId: { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: delivery.id } } })
    const attemptCount = (existing?.attemptCount || 0) + 1, now = new Date()
    await tx.integrationRecord.upsert({ where: { connectionId_remoteType_remoteId: { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: delivery.id } }, create: { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: delivery.id, payloadHash: payloadHash({ address: delivery.address }), reviewPayload: JSON.stringify({ address: delivery.address }), provenance: JSON.stringify({ provider: 'google-maps', capability: 'geocode', attemptedAt: now.toISOString() }), reviewStatus: outcome, outcome, attemptCount, nextRetryAt: outcome === 'RETRY' ? new Date(now.getTime() + Math.min(24 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(attemptCount - 1, 8))) : null, lastErrorCode: errorCode, conflictReason: errorCode }, update: { outcome, attemptCount, nextRetryAt: outcome === 'RETRY' ? new Date(now.getTime() + Math.min(24 * 60 * 60_000, 5 * 60_000 * 2 ** Math.min(attemptCount - 1, 8))) : null, lastErrorCode: errorCode, conflictReason: errorCode, lastSeenAt: now } })
    await tx.auditLog.create({ data: { userId: reviewerId, teamId, action: 'integration_geocode_outcome', entityType: 'delivery', entityId: delivery.id, entityName: delivery.id, description: `Google geocode ${outcome.toLowerCase()}`, metadata: JSON.stringify({ provider: 'google-maps', outcome, errorCode, generation: connection.generation }) } })
  })
}

async function syncGoogleMaps(connection: IntegrationConnection, lockToken: string, resourceWhere: Prisma.DeliveryWhereInput, actorId: string, teamId: string | null) {
  const cursorWhere = connection.syncCursor ? { id: { gt: connection.syncCursor } } : {}
  let deliveries = await prisma.delivery.findMany({ where: { AND: [resourceWhere, { dropoffLocation: null }, cursorWhere] }, select: { id: true, address: true }, orderBy: { id: 'asc' }, take: BATCH_SIZE })
  if (!deliveries.length && connection.syncCursor) deliveries = await prisma.delivery.findMany({ where: { AND: [resourceWhere, { dropoffLocation: null }] }, select: { id: true, address: true }, orderBy: { id: 'asc' }, take: BATCH_SIZE })
  const prior = deliveries.length ? await prisma.integrationRecord.findMany({ where: { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: { in: deliveries.map(({ id }) => id) } }, select: { remoteId: true, nextRetryAt: true, outcome: true } }) : []
  const priorById = new Map(prior.map((item) => [item.remoteId, item])); let processed = 0, applied = 0, conflicts = 0, failed = 0, deferred = 0
  for (const delivery of deliveries) {
    const previous = priorById.get(delivery.id)
    if (previous?.nextRetryAt && previous.nextRetryAt > new Date()) { deferred++; continue }
    const url = new URL('/maps/api/geocode/json', process.env.GOOGLE_MAPS_BASE_URL || 'https://maps.googleapis.com'); url.searchParams.set('address', delivery.address.slice(0, 500)); url.searchParams.set('key', process.env.GOOGLE_MAPS_SERVER_API_KEY!)
    let response: GeocodeResponse
    try { response = await fetchJsonBounded(url, { headers: { Accept: 'application/json' } }, 128_000) as GeocodeResponse }
    catch { await googleOutcome(connection, lockToken, delivery, 'RETRY', 'PROVIDER_UNAVAILABLE', actorId, teamId); processed++; failed++; continue }
    const location = response.results?.[0]?.geometry?.location || null
    const classification = classifyGoogleGeocode(response.status, location)
    if (classification.kind !== 'APPLY') { await googleOutcome(connection, lockToken, delivery, classification.kind, classification.errorCode, actorId, teamId); processed++; failed++; continue }
    const appliedLocation = location as { lat: number; lng: number }
    const provenance = { provider: 'google-maps', capability: 'geocode', syncedAt: new Date().toISOString(), sourceRecordId: delivery.id }
    const didApply = await prisma.$transaction(async (tx) => {
      await renewLease(tx, connection, lockToken)
      const updated = await tx.delivery.updateMany({ where: { id: delivery.id, dropoffLocation: null, ...resourceWhere }, data: { dropoffLocation: JSON.stringify({ latitude: appliedLocation.lat, longitude: appliedLocation.lng }) } })
      await stageIntegrationRecord(tx, { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: delivery.id, payloadHash: payloadHash(appliedLocation), reviewPayload: JSON.stringify(appliedLocation), provenance: JSON.stringify(provenance), localEntityType: 'delivery', localEntityId: delivery.id, initialStatus: updated.count ? 'APPLIED_MISSING_ONLY' : 'CONFLICT', initialConflictReason: updated.count ? null : 'Location already exists' })
      await tx.integrationRecord.updateMany({ where: { connectionId: connection.id, remoteType: 'delivery_geocode', remoteId: delivery.id }, data: { outcome: updated.count ? 'APPLIED' : 'CONFLICT', attemptCount: { increment: 1 }, nextRetryAt: null, lastErrorCode: null } })
      if (updated.count) await tx.auditLog.create({ data: { userId: actorId, teamId, action: 'integration_coordinate_applied', entityType: 'delivery', entityId: delivery.id, entityName: delivery.id, description: 'Applied missing delivery coordinates from Google Maps', metadata: JSON.stringify({ provider: 'google-maps', generation: connection.generation }) } })
      return updated.count === 1
    })
    processed++; if (didApply) applied++; else conflicts++
  }
  return { processed, applied, conflicts, failed, deferred, cursor: deliveries.length ? deliveries[deliveries.length - 1].id : connection.syncCursor }
}

async function syncQuickBooks(connection: IntegrationConnection, lockToken: string, scopeKey: string, jobId: string, actorId: string, teamId: string | null, actorName?: string | null, actorRole?: string | null) {
  if (!connection.credentialEnvelope) throw new Error('missing credentials')
  let credential = decryptCredentialEnvelope(connection.credentialEnvelope, scopeKey, 'quickbooks'); if (!credential.realmId) throw new Error('missing realm'); const realmId = credential.realmId
  if (!connection.tokenExpiresAt || connection.tokenExpiresAt <= new Date(Date.now() + 60_000)) {
    if (!credential.refreshToken || (connection.refreshTokenExpiresAt && connection.refreshTokenExpiresAt <= new Date())) { await reconnect(connection, lockToken, jobId, 'TOKEN_EXPIRED', actorId, teamId, actorName, actorRole); throw new ReconnectHandledError() }
    let refreshed: RefreshResponse
    try { refreshed = await fetchJsonBounded(providerEndpoint('QUICKBOOKS_TOKEN_URL', 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'), { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: credential.refreshToken }) }, 64_000, 2) as RefreshResponse }
    catch (error) { if (error instanceof ProviderHttpError && (error.status === 401 || error.providerCode === 'invalid_grant')) { await reconnect(connection, lockToken, jobId, 'OAUTH_RECONNECT_REQUIRED', actorId, teamId, actorName, actorRole); throw new ReconnectHandledError() } throw error }
    if (typeof refreshed.access_token !== 'string' || typeof refreshed.expires_in !== 'number' || !Number.isFinite(refreshed.expires_in) || refreshed.expires_in <= 0) throw new Error('invalid refresh response')
    credential = { ...credential, accessToken: refreshed.access_token, refreshToken: typeof refreshed.refresh_token === 'string' ? refreshed.refresh_token : credential.refreshToken }
    await prisma.$transaction(async (tx) => { await renewLease(tx, connection, lockToken); const changed = await tx.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, lockToken }, data: { credentialEnvelope: encryptCredentialEnvelope(credential, scopeKey, 'quickbooks'), tokenExpiresAt: new Date(Date.now() + Math.min(refreshed.expires_in as number, 86400) * 1000), refreshTokenExpiresAt: typeof refreshed.x_refresh_token_expires_in === 'number' && refreshed.x_refresh_token_expires_in > 0 ? new Date(Date.now() + Math.min(refreshed.x_refresh_token_expires_in, 10_000_000) * 1000) : connection.refreshTokenExpiresAt } }); if (changed.count !== 1) throw new SyncLeaseLostError() })
  }
  const parsedCursor = Number(connection.syncCursor || 1), start = Number.isSafeInteger(parsedCursor) && parsedCursor > 0 ? parsedCursor : 1
  const url = new URL(`/v3/company/${encodeURIComponent(realmId)}/query`, process.env.QUICKBOOKS_API_BASE_URL || 'https://quickbooks.api.intuit.com'); url.searchParams.set('query', `select * from Purchase order by MetaData.LastUpdatedTime startposition ${start} maxresults ${BATCH_SIZE}`); url.searchParams.set('minorversion', '75')
  const response = await fetchJsonBounded(url, { headers: { Authorization: `Bearer ${credential.accessToken}`, Accept: 'application/json' } }) as QuickBooksResponse
  const records = Array.isArray(response.QueryResponse?.Purchase) ? response.QueryResponse!.Purchase!.slice(0, BATCH_SIZE) : []
  for (const raw of records) {
    const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}, remoteId = safeRemoteId(record.Id)
    const entity = record.EntityRef && typeof record.EntityRef === 'object' ? record.EntityRef as Record<string, unknown> : {}, metadata = record.MetaData && typeof record.MetaData === 'object' ? record.MetaData as Record<string, unknown> : {}, currency = record.CurrencyRef && typeof record.CurrencyRef === 'object' ? record.CurrencyRef as Record<string, unknown> : {}
    const rawUpdated = typeof metadata.LastUpdatedTime === 'string' ? metadata.LastUpdatedTime : null, updatedAt = rawUpdated && Number.isFinite(new Date(rawUpdated).getTime()) ? rawUpdated : null
    const summary = { id: remoteId, date: typeof record.TxnDate === 'string' ? record.TxnDate : null, total: Number.isFinite(Number(record.TotalAmt)) ? Number(record.TotalAmt) : null, currency: typeof currency.value === 'string' ? currency.value.slice(0, 8) : null, vendorRef: typeof entity.value === 'string' ? entity.value : null, updatedAt }
    await prisma.$transaction(async (tx) => { await renewLease(tx, connection, lockToken); await stageIntegrationRecord(tx, { connectionId: connection.id, remoteType: 'purchase', remoteId, remoteUpdatedAt: updatedAt ? new Date(updatedAt) : null, payloadHash: payloadHash(summary), reviewPayload: JSON.stringify(summary), provenance: JSON.stringify({ provider: 'quickbooks', capability: 'operating_costs', syncedAt: new Date().toISOString() }), initialStatus: 'PENDING_REVIEW', initialConflictReason: 'Vehicle mapping and operator confirmation required' }) })
  }
  return { processed: records.length, applied: records.length, conflicts: 0, failed: 0, deferred: 0, cursor: records.length === BATCH_SIZE ? String(start + BATCH_SIZE) : String(start) }
}

async function reconnect(connection: IntegrationConnection, lockToken: string, jobId: string, errorCode: string, actorId: string, teamId: string | null, actorName?: string | null, actorRole?: string | null) {
  await prisma.$transaction(async (tx) => {
    const changed = await tx.integrationConnection.updateMany({ where: { id: connection.id, generation: connection.generation, status: 'CONNECTED', revokedAt: null, lockToken }, data: { status: 'RECONNECT_REQUIRED', credentialEnvelope: null, tokenExpiresAt: null, refreshTokenExpiresAt: null, scopes: '[]', externalAccountRef: null, lastErrorCode: errorCode, lockToken: null, lockExpiresAt: null } })
    if (changed.count !== 1) throw new SyncLeaseLostError()
    const failed = await tx.integrationSyncJob.updateMany({ where: { id: jobId, generation: connection.generation, lockToken, status: 'RUNNING' }, data: { status: 'FAILED', errorCode, completedAt: new Date() } })
    if (failed.count === 1) await tx.auditLog.create({ data: { userId: actorId, teamId, userName: actorName, userRole: actorRole, action: 'integration_sync_failed', entityType: 'integration_sync', entityId: jobId, entityName: 'quickbooks', description: 'QuickBooks Online sync requires reconnection', metadata: JSON.stringify({ provider: 'quickbooks', generation: connection.generation, errorCode }) } })
  })
}
