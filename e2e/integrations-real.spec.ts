import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import http from 'http'
import { decryptCredentialEnvelope } from '../lib/integrations/oauth'
import { rateBucket } from '../lib/integrations/rateLimit'
import { syncIdempotencyKey } from '../lib/integrations/sync'

test.setTimeout(90_000)

const db = new PrismaClient(); const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const ownerId = `integration-owner-${suffix}`, viewerId = `integration-viewer-${suffix}`, otherId = `integration-other-${suffix}`
const teamId = `integration-team-${suffix}`, otherTeamId = `integration-other-team-${suffix}`, vehicleId = `integration-vehicle-${suffix}`, deliveryId = `integration-delivery-${suffix}`
let purchaseTotal = 50; let providerMode: 'ok' | 'down' | 'invalid_grant' | 'token_delay' | 'geocode_delay' | 'geocode_mixed' | 'geocode_quota' = 'ok'; let mockServer: http.Server
let releaseProvider: (() => void) | null = null, providerStarted: (() => void) | null = null

async function token(id: string) { return new SignJWT({ sub: id, email: `${id}@test.invalid`, role: 'fleet_manager', purpose: 'session' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!)) }
async function body(req: http.IncomingMessage) { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks).toString('utf8') }

test.beforeAll(async () => {
  mockServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1:3330')
    res.setHeader('content-type', 'application/json')
    if (url.pathname.includes('/maps/api/geocode/json')) {
      if (providerMode === 'geocode_delay') { providerStarted?.(); await new Promise<void>((resolve) => { releaseProvider = resolve }) }
      if (providerMode === 'geocode_mixed' && url.searchParams.get('address')?.includes('No Result')) return res.end(JSON.stringify({ status: 'ZERO_RESULTS', results: [] }))
      if (providerMode === 'geocode_quota') return res.end(JSON.stringify({ status: 'OVER_QUERY_LIMIT', results: [] }))
      return res.end(JSON.stringify({ status: 'OK', results: [{ geometry: { location: { lat: 43.6532, lng: -79.3832 } } }] }))
    }
    if (url.pathname === '/token') {
      if (providerMode === 'token_delay') { providerStarted?.(); await new Promise<void>((resolve) => { releaseProvider = resolve }) }
      const requestBody = await body(req)
      if (providerMode === 'invalid_grant') { res.statusCode = 400; return res.end('{"error":"invalid_grant"}') }
      const refresh = requestBody.includes('grant_type=refresh_token')
      return res.end(JSON.stringify({ access_token: refresh ? 'rotated-access' : 'initial-access', refresh_token: refresh ? 'rotated-refresh' : 'initial-refresh', expires_in: 3600, x_refresh_token_expires_in: 7200, scope: 'com.intuit.quickbooks.accounting' }))
    }
    if (url.pathname.startsWith('/v3/company/')) {
      if (providerMode === 'down') { res.statusCode = 503; return res.end('{}') }
      return res.end(JSON.stringify({ QueryResponse: { Purchase: [{ Id: 'purchase-qa', TxnDate: '2026-08-08', TotalAmt: purchaseTotal, EntityRef: { value: 'garage-qa' }, MetaData: { LastUpdatedTime: '2026-08-08T12:00:00Z' } }] } }))
    }
    if (url.pathname === '/revoke') { res.statusCode = 500; return res.end('{}') }
    res.statusCode = 404; res.end('{}')
  })
  await new Promise<void>((resolve) => mockServer.listen(3330, '127.0.0.1', resolve))
})

test.afterAll(async () => {
  await db.integrationRateLimit.deleteMany({ where: { actorId: { in: [ownerId, viewerId, otherId] } } })
  await db.auditLog.deleteMany({ where: { userId: { in: [ownerId, viewerId, otherId] } } })
  await db.integrationConnection.deleteMany({ where: { ownerId: { in: [ownerId, otherId] } } })
  await db.delivery.deleteMany({ where: { id: deliveryId } }); await db.vehicle.deleteMany({ where: { id: vehicleId } })
  await db.teamMember.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } }); await db.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } }); await db.user.deleteMany({ where: { id: { in: [ownerId, viewerId, otherId] } } })
  await db.$disconnect(); await new Promise<void>((resolve) => mockServer.close(() => resolve()))
})

test('real DB, mocked outbound providers, review conflicts, reconnect, cleanup, and mobile states', async ({ page, baseURL }) => {
  test.skip(!baseURL || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL), 'Disposable local database only')
  await db.user.createMany({ data: [ownerId, viewerId, otherId].map((id) => ({ id, email: `${id}@test.invalid`, name: id, onboardingCompleted: true })) })
  await db.team.createMany({ data: [{ id: teamId, name: 'Integration QA', ownerId }, { id: otherTeamId, name: 'Other tenant', ownerId: otherId }] })
  await db.teamMember.create({ data: { teamId, userId: viewerId, role: 'VIEWER', status: 'ACCEPTED', joinedAt: new Date() } })
  await db.vehicle.create({ data: { id: vehicleId, name: 'QA Van', ownerId, teamId } })
  await db.delivery.create({ data: { id: deliveryId, customer: 'QA customer', address: '100 Queen St W, Toronto', ownerId, teamId } })
  const origin = new URL(baseURL!), ownerToken = await token(ownerId)
  await page.context().addCookies([{ name: 'token', value: ownerToken, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }, { name: 'fleetflow_team', value: teamId, domain: origin.hostname, path: '/', sameSite: 'Lax' }])
  const headers = { origin: origin.origin, cookie: `token=${ownerToken}; fleetflow_team=${teamId}` }

  expect((await page.request.post('/api/integrations/google-maps/connect', { headers })).status()).toBe(200)
  expect((await page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_sync_0001' } })).status()).toBe(200)
  expect(JSON.parse((await db.delivery.findUniqueOrThrow({ where: { id: deliveryId } })).dropoffLocation!)).toEqual({ latitude: 43.6532, longitude: -79.3832 })
  expect(await db.integrationRecord.findFirst({ where: { remoteId: deliveryId } })).toEqual(expect.objectContaining({ reviewStatus: 'APPLIED_MISSING_ONLY', localEntityId: deliveryId }))

  const invalidDeliveryId = `${deliveryId}-a-invalid`, laterDeliveryId = `${deliveryId}-b-valid`
  await db.delivery.createMany({ data: [{ id: invalidDeliveryId, customer: 'Invalid address', address: 'No Result Address', ownerId, teamId }, { id: laterDeliveryId, customer: 'Later valid', address: '300 Queen St W, Toronto', ownerId, teamId }] })
  providerMode = 'geocode_mixed'
  const mixed = await page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_sync_mixed_1' } }); expect(mixed.status()).toBe(200)
  expect(await db.integrationRecord.findFirst({ where: { remoteId: invalidDeliveryId } })).toEqual(expect.objectContaining({ outcome: 'DEAD_LETTER', lastErrorCode: 'ZERO_RESULTS' }))
  expect((await db.delivery.findUniqueOrThrow({ where: { id: laterDeliveryId } })).dropoffLocation).not.toBeNull()
  expect(await db.integrationConnection.findFirst({ where: { scopeKey: `team:${teamId}`, provider: 'google-maps' } })).toEqual(expect.objectContaining({ lastErrorCode: 'GOOGLE_PARTIAL_FAILURE', syncCursor: laterDeliveryId }))
  await db.delivery.deleteMany({ where: { id: { in: [invalidDeliveryId, laterDeliveryId] } } }); providerMode = 'ok'

  const staleDeliveryId = `${deliveryId}-stale`; await db.delivery.create({ data: { id: staleDeliveryId, customer: 'Stale lease', address: '400 Queen St W, Toronto', ownerId, teamId } })
  const googleConnection = await db.integrationConnection.findFirstOrThrow({ where: { scopeKey: `team:${teamId}`, provider: 'google-maps' } }), staleRequest = 'google_stale_reclaim_1', staleToken = 'stale-owner-token', staleExpiry = new Date(Date.now() - 1000)
  await db.integrationConnection.update({ where: { id: googleConnection.id }, data: { lockToken: staleToken, lockExpiresAt: staleExpiry } })
  const staleJob = await db.integrationSyncJob.create({ data: { connectionId: googleConnection.id, idempotencyKey: syncIdempotencyKey('google-maps', googleConnection.syncCursor, staleRequest), generation: googleConnection.generation, lockToken: staleToken, lockExpiresAt: staleExpiry, status: 'RUNNING', attemptCount: 1, startedAt: new Date(Date.now() - 60_000) } })
  expect((await page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': staleRequest } })).status()).toBe(200)
  expect(await db.integrationSyncJob.findUniqueOrThrow({ where: { id: staleJob.id } })).toEqual(expect.objectContaining({ status: 'COMPLETED', attemptCount: 2 }))
  await db.delivery.delete({ where: { id: staleDeliveryId } })

  const quotaDeliveryId = `${deliveryId}-quota`; await db.delivery.create({ data: { id: quotaDeliveryId, customer: 'Quota retry', address: '500 Queen St W, Toronto', ownerId, teamId } }); providerMode = 'geocode_quota'
  const quotaFailure = await page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_quota_retry_1' } }); expect(quotaFailure.status()).toBe(503)
  let quotaRecord = await db.integrationRecord.findFirstOrThrow({ where: { remoteId: quotaDeliveryId } }); expect(quotaRecord).toEqual(expect.objectContaining({ outcome: 'RETRY', lastErrorCode: 'QUOTA_EXCEEDED' }))
  await db.integrationRecord.update({ where: { id: quotaRecord.id }, data: { nextRetryAt: new Date(0) } }); providerMode = 'ok'
  const quotaSuccess = await page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_quota_retry_2' } }); expect(quotaSuccess.status()).toBe(200); expect((await quotaSuccess.json()).outcomes.applied).toBe(1)
  expect((await db.delivery.findUniqueOrThrow({ where: { id: quotaDeliveryId } })).dropoffLocation).not.toBeNull(); await db.delivery.delete({ where: { id: quotaDeliveryId } })

  const conflictDeliveryId = `${deliveryId}-conflict`; await db.delivery.create({ data: { id: conflictDeliveryId, customer: 'Conflict', address: '600 Queen St W, Toronto', ownerId, teamId } }); providerMode = 'geocode_delay'; const conflictStarted = new Promise<void>((resolve) => { providerStarted = resolve })
  const conflictSync = page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_conflict_001' } }); await conflictStarted
  await db.delivery.update({ where: { id: conflictDeliveryId }, data: { dropoffLocation: JSON.stringify({ latitude: 1, longitude: 1 }) } }); releaseProvider?.(); providerMode = 'ok'
  const conflictResponse = await conflictSync; expect(conflictResponse.status()).toBe(503); expect((await conflictResponse.json()).outcomes).toEqual(expect.objectContaining({ applied: 0, conflicts: 1 }))
  expect(await db.integrationRecord.findFirst({ where: { remoteId: conflictDeliveryId } })).toEqual(expect.objectContaining({ outcome: 'CONFLICT', reviewStatus: 'CONFLICT' })); await db.delivery.delete({ where: { id: conflictDeliveryId } })

  const connect = await page.request.post('/api/integrations/quickbooks/connect', { headers }); expect(connect.status()).toBe(200)
  const state = new URL((await connect.json()).authorizationUrl).searchParams.get('state')!
  const callback = await page.request.get(`/api/integrations/quickbooks/callback?code=qa-code&state=${state}&realmId=qa-realm`, { headers, maxRedirects: 0 }); expect(callback.status()).toBe(303)
  const qbConnection = await db.integrationConnection.findFirstOrThrow({ where: { scopeKey: `team:${teamId}`, provider: 'quickbooks' } })
  await db.integrationConnection.update({ where: { id: qbConnection.id }, data: { tokenExpiresAt: new Date(0) } })
  expect((await page.request.post('/api/integrations/quickbooks/sync', { headers: { ...headers, 'idempotency-key': 'quickbooks_sync_0001' } })).status()).toBe(200)
  const rotated = await db.integrationConnection.findUniqueOrThrow({ where: { id: qbConnection.id } })
  expect(decryptCredentialEnvelope(rotated.credentialEnvelope!, `team:${teamId}`, 'quickbooks')).toEqual({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh', realmId: 'qa-realm' })
  let staged = await db.integrationRecord.findFirstOrThrow({ where: { connectionId: qbConnection.id, remoteId: 'purchase-qa' } }); expect(staged.reviewStatus).toBe('PENDING_REVIEW')

  const map = await page.request.patch('/api/integrations/records', { headers, data: { recordId: staged.id, revision: staged.revision, payloadHash: staged.payloadHash, action: 'MAP', vehicleId } }); expect(map.status()).toBe(200)
  staged = await db.integrationRecord.findUniqueOrThrow({ where: { id: staged.id } })
  const approve = await page.request.patch('/api/integrations/records', { headers, data: { recordId: staged.id, revision: staged.revision, payloadHash: staged.payloadHash, action: 'APPROVE' } }); expect(approve.status()).toBe(200)
  expect(await db.expenseRecord.count({ where: { ownerId } })).toBe(0)
  expect(await db.integrationRecordReview.count({ where: { recordId: staged.id } })).toBe(2)

  purchaseTotal = 75
  expect((await page.request.post('/api/integrations/quickbooks/sync', { headers: { ...headers, 'idempotency-key': 'quickbooks_sync_0002' } })).status()).toBe(200)
  staged = await db.integrationRecord.findUniqueOrThrow({ where: { id: staged.id } })
  expect(staged).toEqual(expect.objectContaining({ revision: 2, reviewStatus: 'NEEDS_REVIEW', localEntityId: null, conflictReason: 'Provider record changed after prior review' }))
  expect(await db.integrationRecordReview.count({ where: { recordId: staged.id } })).toBe(2)

  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings/integrations')
  await expect(page.getByText(/garage-qa/)).toBeVisible(); await expect(page.getByText('Provider record changed after prior review')).toBeVisible()
  expect((await page.getByRole('button', { name: 'Map vehicle' }).boundingBox())?.height).toBeGreaterThanOrEqual(44)

  providerMode = 'down'
  const down = await page.request.post('/api/integrations/quickbooks/sync', { headers: { ...headers, 'idempotency-key': 'quickbooks_sync_down' } }); expect(down.status()).toBe(503)
  providerMode = 'invalid_grant'; await db.integrationConnection.update({ where: { id: qbConnection.id }, data: { tokenExpiresAt: new Date(0) } })
  const invalid = await page.request.post('/api/integrations/quickbooks/sync', { headers: { ...headers, 'idempotency-key': 'quickbooks_sync_invalid' } }); expect(invalid.status()).toBe(409)
  expect(await db.integrationConnection.findUnique({ where: { id: qbConnection.id } })).toEqual(expect.objectContaining({ status: 'RECONNECT_REQUIRED', credentialEnvelope: null }))
  providerMode = 'ok'; await page.reload(); await expect(page.getByRole('button', { name: 'Reconnect QuickBooks Online' })).toBeVisible()

  const reconnect = await page.request.post('/api/integrations/quickbooks/connect', { headers }); const reconnectState = new URL((await reconnect.json()).authorizationUrl).searchParams.get('state')!
  expect((await page.request.get(`/api/integrations/quickbooks/callback?code=qa-code-2&state=${reconnectState}&realmId=qa-realm`, { headers, maxRedirects: 0 })).status()).toBe(303)
  const disconnect = await page.request.delete('/api/integrations/quickbooks/connect', { headers }); expect(disconnect.status()).toBe(200); expect((await disconnect.json()).revocationConfirmed).toBe(false)
  expect(await db.integrationConnection.findUnique({ where: { id: qbConnection.id } })).toEqual(expect.objectContaining({ status: 'DISCONNECTED', credentialEnvelope: null, lastErrorCode: 'REVOCATION_UNCONFIRMED' }))

  const raceConnect = await page.request.post('/api/integrations/quickbooks/connect', { headers }); const raceState = new URL((await raceConnect.json()).authorizationUrl).searchParams.get('state')!
  providerMode = 'token_delay'; const tokenStarted = new Promise<void>((resolve) => { providerStarted = resolve })
  const racingCallback = page.request.get(`/api/integrations/quickbooks/callback?code=race-code&state=${raceState}&realmId=qa-realm`, { headers, maxRedirects: 0 })
  await tokenStarted; expect((await page.request.delete('/api/integrations/quickbooks/connect', { headers })).status()).toBe(200); releaseProvider?.(); providerMode = 'ok'
  expect((await racingCallback).status()).toBe(303)
  expect(await db.integrationConnection.findUniqueOrThrow({ where: { id: qbConnection.id } })).toEqual(expect.objectContaining({ status: 'DISCONNECTED', credentialEnvelope: null }))

  const raceDeliveryId = `${deliveryId}-race`; await db.delivery.create({ data: { id: raceDeliveryId, customer: 'Race customer', address: '200 Queen St W, Toronto', ownerId, teamId } })
  expect((await page.request.post('/api/integrations/google-maps/connect', { headers })).status()).toBe(200)
  providerMode = 'geocode_delay'; const geocodeStarted = new Promise<void>((resolve) => { providerStarted = resolve })
  const racingSync = page.request.post('/api/integrations/google-maps/sync', { headers: { ...headers, 'idempotency-key': 'google_sync_race_01' } })
  await geocodeStarted; expect((await page.request.delete('/api/integrations/google-maps/connect', { headers })).status()).toBe(200); releaseProvider?.(); providerMode = 'ok'
  expect((await racingSync).status()).toBe(409)
  expect((await db.delivery.findUniqueOrThrow({ where: { id: raceDeliveryId } })).dropoffLocation).toBeNull()
  expect(await db.integrationRecord.count({ where: { remoteId: raceDeliveryId } })).toBe(0)
  await db.delivery.delete({ where: { id: raceDeliveryId } })

  const connectBucket = rateBucket(new Date(), 300_000)
  await db.integrationRateLimit.upsert({ where: { actorId_scopeKey_provider_action_bucketStart: { actorId: ownerId, scopeKey: `team:${teamId}`, provider: 'google-maps', action: 'connect', bucketStart: connectBucket } }, create: { actorId: ownerId, scopeKey: `team:${teamId}`, provider: 'google-maps', action: 'connect', bucketStart: connectBucket, count: 10 }, update: { count: 10 } })
  expect((await page.request.post('/api/integrations/google-maps/connect', { headers })).status()).toBe(429)

  const viewerContext = await page.context().browser()!.newContext({ baseURL }); const viewerToken = await token(viewerId)
  expect((await viewerContext.request.get('/api/integrations/records', { headers: { cookie: `token=${viewerToken}; fleetflow_team=${teamId}` } })).status()).toBe(403); await viewerContext.close()
  expect((await page.request.get('/api/integrations/records', { headers: { cookie: `token=${ownerToken}; fleetflow_team=${otherTeamId}` } })).status()).toBe(403)
})
