import { createActionPreview, parseActionPreviewKeyRing, verifyActionPreview } from '@/lib/ai/actionRegistry'
import { deliveryStatusUpdateSchema, maintenanceCreateValuesSchema, vehicleEditPrefillSchema, vehicleBodySchema } from '@/lib/validation'
import { suggestedActionSchema } from '@/lib/ai/actionRegistry'

const secret = 'test-secret-that-is-at-least-32-bytes-long'

describe('AI action registry', () => {
  it('round-trips an allowlisted action in a signed short-lived preview', () => {
    const issued = createActionPreview({
      action: { type: 'update_delivery_status', deliveryId: 'd1', values: { status: 'delivered' }, expectedUpdatedAt: '2026-08-08T12:00:00.000Z' },
      proposerId: 'u1', ownerId: 'o1', teamId: 't1', sourceFindingId: 'f1',
    }, { secret, now: new Date('2026-08-08T12:00:00.000Z'), nonce: 'nonce-1' })
    expect(issued.preview).toEqual(expect.objectContaining({ kind: 'write', before: expect.any(Object), after: expect.any(Object) }))
    expect(verifyActionPreview(issued.token, { secret, now: new Date('2026-08-08T12:04:59.000Z') })).toEqual(expect.objectContaining({ jti: 'nonce-1', proposerId: 'u1' }))
  })

  it('rejects tampering, expiry, arbitrary fields and unsafe edit targets', () => {
    const issued = createActionPreview({ action: { type: 'draft_weekly_summary' }, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, now: new Date(0), nonce: 'n' })
    expect(() => verifyActionPreview(issued.token + 'x', { secret, now: new Date(1) })).toThrow('Invalid action preview')
    expect(() => verifyActionPreview(issued.token, { secret, now: new Date(301_000) })).toThrow('Action preview expired')
    expect(() => createActionPreview({ action: { type: 'draft_weekly_summary', url: 'https://evil.test' } as never, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, now: new Date(0), nonce: 'n' })).toThrow()
    expect(() => createActionPreview({ action: { type: 'open_edit', entityType: 'user', entityId: 'u2', values: {} } as never, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, now: new Date(0), nonce: 'n' })).toThrow()
    expect(() => createActionPreview({ action: { type: 'create_maintenance_task', vehicleId: 'v1', values: { vehicle: 'Van', type: 'Oil', dueDate: '2026-99-99', priority: 'high' }, expectedVehicleUpdatedAt: '2026-08-08T12:00:00.000Z' }, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, now: new Date(0), nonce: 'n' })).toThrow()
  })

  it.each([
    [{ vehicle: 'Van', type: 'Oil', dueDate: '2026-08-09', priority: 'high' }, true],
    [{ vehicle: 'Van', type: 'Oil', dueDate: 'bad', priority: 'high' }, false],
    [{ vehicle: 'Van', type: 'Oil', dueDate: '2026-08-09', priority: 'critical' }, false],
  ])('uses the exact shared maintenance create schema: %#', (values, expected) => { expect(maintenanceCreateValuesSchema.safeParse(values).success).toBe(expected); expect(suggestedActionSchema.safeParse({ type: 'create_maintenance_task', vehicleId: 'v1', values, expectedVehicleUpdatedAt: '2026-08-08T12:00:00.000Z' }).success).toBe(expected) })

  it.each([[{ status: 'delivered' }, true], [{ status: 'failed' }, false], [{ status: 'delivered', arbitrary: 'x' }, false]])('uses the exact shared delivery status schema: %#', (values, expected) => { expect(deliveryStatusUpdateSchema.safeParse(values).success).toBe(expected); expect(suggestedActionSchema.safeParse({ type: 'update_delivery_status', deliveryId: 'd1', values, expectedUpdatedAt: '2026-08-08T12:00:00.000Z' }).success).toBe(expected) })
  it.each(['active', 'inactive', 'delayed'])('uses canonical vehicle status %s in normal and suggested edits', status => { expect(vehicleBodySchema.safeParse({ status }).success).toBe(true); expect(vehicleEditPrefillSchema.safeParse({ status }).success).toBe(true) })
  it.each(['maintenance', 'retired'])('rejects drifted vehicle status %s in normal and suggested edits', status => { expect(vehicleBodySchema.safeParse({ status }).success).toBe(false); expect(vehicleEditPrefillSchema.safeParse({ status }).success).toBe(false) })

  it('rejects weak keys and impossible token lifetimes', () => {
    expect(() => createActionPreview({ action: { type: 'draft_weekly_summary' }, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret: 'too-short' })).toThrow('not configured')
    const issued = createActionPreview({ action: { type: 'draft_weekly_summary' }, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, now: new Date(1000), nonce: 'n' })
    expect(() => verifyActionPreview(issued.token, { secret, now: new Date(0) })).toThrow('Invalid action preview')
    const [kid, body, sig] = issued.token.split('.')
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString())
    decoded.expiresAt = decoded.issuedAt + 300_001
    expect(() => verifyActionPreview(`${kid}.${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`, { secret, now: new Date(1000) })).toThrow('Invalid action preview')
  })

  it('supports key rotation and rejects unknown key IDs', () => {
    const issued = createActionPreview({ action: { type: 'draft_weekly_summary' }, proposerId: 'u1', ownerId: 'o1', teamId: null }, { secret, kid: 'current', now: new Date(0), nonce: 'n' })
    expect(verifyActionPreview(issued.token, { secrets: { current: secret, previous: 'previous-secret-that-is-at-least-32-bytes' }, now: new Date(1) }).jti).toBe('n')
    expect(() => verifyActionPreview(issued.token.replace('current.', 'unknown.'), { secrets: { current: secret }, now: new Date(1) })).toThrow('Invalid action preview')
  })

  it('round-trips the largest valid action within the confirmation bound', () => {
    const issued = createActionPreview({ action: { type: 'create_maintenance_task', vehicleId: 'v'.repeat(64), values: { vehicle: 'v'.repeat(120), type: 't'.repeat(200), dueDate: '2026-08-09', priority: 'high', notes: 'n'.repeat(2000), partsNeeded: Array(20).fill('p'.repeat(100)), serviceProvider: 's'.repeat(200), estimatedDuration: 'e'.repeat(100), costEstimate: 10_000_000 }, expectedVehicleUpdatedAt: '2026-08-08T12:00:00.000Z' }, proposerId: 'u'.repeat(64), ownerId: 'o'.repeat(64), teamId: 't'.repeat(64), sourceFindingId: 'f'.repeat(100) }, { secret, now: new Date(0), nonce: 'n'.repeat(100) })
    expect(issued.token.length).toBeLessThanOrEqual(12_000)
    expect(verifyActionPreview(issued.token, { secret, now: new Date(1) }).action.type).toBe('create_maintenance_task')
  })
  it('parses a bounded current and previous key ring and fails closed', () => {
    const ring = parseActionPreviewKeyRing({ ACTION_PREVIEW_KEYS: JSON.stringify({ current: secret, previous: 'previous-secret-that-is-at-least-32-bytes' }), ACTION_PREVIEW_CURRENT_KID: 'current' })
    expect(ring).toEqual({ currentKid: 'current', currentSecret: secret, secrets: expect.objectContaining({ current: secret, previous: expect.any(String) }) })
    for (const env of [
      {},
      { ACTION_PREVIEW_KEYS: 'bad', ACTION_PREVIEW_CURRENT_KID: 'current' },
      { ACTION_PREVIEW_KEYS: JSON.stringify({ current: 'short' }), ACTION_PREVIEW_CURRENT_KID: 'current' },
      { ACTION_PREVIEW_KEYS: JSON.stringify({ a: secret, b: secret }), ACTION_PREVIEW_CURRENT_KID: 'a' },
      { ACTION_PREVIEW_KEYS: JSON.stringify({ a: secret, b: secret + 'b', c: secret + 'c', d: secret + 'd' }), ACTION_PREVIEW_CURRENT_KID: 'a' },
    ]) expect(() => parseActionPreviewKeyRing(env)).toThrow('not configured')
  })
})
