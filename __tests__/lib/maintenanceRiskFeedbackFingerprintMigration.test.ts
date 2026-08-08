import fs from 'fs'
it('adds a required request fingerprint for durable idempotency', () => {
  const sql = fs.readFileSync('prisma/migrations/20260808072000_maintenance_risk_feedback_fingerprint/migration.sql', 'utf8')
  expect(sql).toContain('"requestHash" TEXT')
  expect(sql).toContain('ALTER COLUMN "requestHash" SET NOT NULL')
})
