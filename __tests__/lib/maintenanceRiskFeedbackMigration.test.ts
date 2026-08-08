import fs from 'fs'

const path = 'prisma/migrations/20260808070000_maintenance_risk_feedback/migration.sql'

it('adds an outcome-observation table without changing historical migrations', () => {
  expect(fs.existsSync(path)).toBe(true)
  const sql = fs.readFileSync(path, 'utf8')
  for (const field of ['"ownerId" TEXT NOT NULL', '"teamId" TEXT', '"vehicleId" TEXT NOT NULL', '"rubricVersion" TEXT NOT NULL', '"scoreSnapshot" INTEGER NOT NULL', '"bandSnapshot" TEXT NOT NULL', '"sourceComplete" BOOLEAN NOT NULL', '"completenessPercent" INTEGER NOT NULL', '"helpful" BOOLEAN NOT NULL', '"actionTaken" BOOLEAN NOT NULL', '"outcomeCategory" TEXT', '"notes" TEXT', '"consentedAt" TIMESTAMP(3) NOT NULL', '"submittedById" TEXT NOT NULL']) expect(sql).toContain(field)
  expect(sql).toContain('CREATE INDEX "MaintenanceRiskFeedback_ownerId_teamId_vehicleId_createdAt_idx"')
  expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(4)
  expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER COLUMN/i)
})
