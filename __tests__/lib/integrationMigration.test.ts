import fs from 'fs'
import path from 'path'

describe('integration persistence migration', () => {
  it('is additive, tenant-scoped, idempotent, and stores no plaintext credential columns', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20260808060000_provider_integrations/migration.sql'),
      'utf8'
    )
    expect(sql).toContain('"IntegrationConnection"')
    expect(sql).toContain('"credentialEnvelope" TEXT')
    expect(sql).toContain('CREATE UNIQUE INDEX "IntegrationConnection_scopeKey_provider_key"')
    expect(sql).toContain('CREATE UNIQUE INDEX "IntegrationRecord_connectionId_remoteType_remoteId_key"')
    expect(sql).toContain('"reviewPayload" TEXT')
    expect(sql).toContain('"revision" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toContain('"IntegrationRecordReview"')
    expect(sql).toContain('"generation" INTEGER NOT NULL DEFAULT 1')
    expect(sql).toContain('"IntegrationRateLimit"')
    expect(sql).toContain('"attemptCount" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('"nextRetryAt" TIMESTAMP(3)')
    expect(sql).toContain('CREATE UNIQUE INDEX "IntegrationRecordReview_recordId_revision_decision_key"')
    expect(sql).toContain('CREATE UNIQUE INDEX "IntegrationSyncJob_connectionId_idempotencyKey_key"')
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN/)
    expect(sql).not.toMatch(/"(?:accessToken|refreshToken)"\s+TEXT/)
  })
})
