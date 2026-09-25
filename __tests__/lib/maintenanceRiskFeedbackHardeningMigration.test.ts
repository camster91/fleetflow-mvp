import fs from 'fs'
it('adds durable idempotency and retention fields', () => {
  const sql = fs.readFileSync(
    'prisma/migrations/20260808071000_maintenance_risk_feedback_hardening/migration.sql',
    'utf8'
  )
  for (const field of ['scopeKey', 'idempotencyKey', 'expiresAt'])
    expect(sql).toContain(`ALTER COLUMN "${field}" SET NOT NULL`)
  expect(sql).toContain('CREATE UNIQUE INDEX "MaintenanceRiskFeedback_submit_scope_idem_key"')
  expect(sql).toContain('CREATE INDEX "MaintenanceRiskFeedback_expiresAt_idx"')
})
