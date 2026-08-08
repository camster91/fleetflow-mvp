import fs from 'fs'
import path from 'path'

describe('intelligence finding persistence migration', () => {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260808020000_intelligence_findings/migration.sql'
  )
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma')

  it('creates the stable finding store with lifecycle, feedback, evidence, and ranking fields', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('CREATE TABLE "IntelligenceFinding"')
    for (const required of [
      '"id" TEXT NOT NULL',
      '"ownerId" TEXT NOT NULL',
      '"teamId" TEXT',
      '"evidence" TEXT NOT NULL',
      '"score" INTEGER NOT NULL',
      '"ruleVersion" TEXT NOT NULL',
      '"actionUrl" TEXT',
      '"status" TEXT NOT NULL DEFAULT \'OPEN\'',
      '"feedback" TEXT',
      '"expiresAt" TIMESTAMP(3)',
      '"resolvedAt" TIMESTAMP(3)',
      'CONSTRAINT "IntelligenceFinding_pkey" PRIMARY KEY ("id")',
    ]) expect(sql).toContain(required)
  })

  it('indexes exact workspace lifecycle and stable ranking access paths', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    expect(sql).toContain('ON "IntelligenceFinding"("ownerId", "teamId", "status", "severity")')
    expect(sql).toContain('ON "IntelligenceFinding"("ownerId", "teamId", "score" DESC, "id" ASC)')
    expect(sql).toContain('ON "IntelligenceFinding"("ownerId", "teamId", "status", "score" DESC, "id" ASC)')
    expect(sql).toContain('ON "IntelligenceFinding"("expiresAt")')
    expect(sql).toMatch(/"IntelligenceFinding_ownerId_fkey"[\s\S]*REFERENCES "User"\("id"\) ON DELETE CASCADE/)
    expect(sql).toMatch(/"IntelligenceFinding_teamId_fkey"[\s\S]*REFERENCES "Team"\("id"\) ON DELETE CASCADE/)
  })

  it('keeps the Prisma model aligned with the migration tenant contract', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8')
    const model = schema.match(/model IntelligenceFinding \{[\s\S]*?\n\}/)?.[0]
    expect(model).toBeDefined()
    expect(model).toMatch(/id\s+String\s+@id/)
    expect(model).toMatch(/ownerId\s+String\s*\n/)
    expect(model).toMatch(/teamId\s+String\?\s*\n/)
    expect(model).toMatch(/status\s+String\s+@default\("OPEN"\)/)
    expect(model).toContain('@@index([ownerId, teamId, status, severity])')
    expect(model).toContain('owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)')
    expect(model).toContain('team        Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)')
    expect(model).toContain('@@index([ownerId, teamId, score(sort: Desc), id])')
    expect(model).toContain('@@index([ownerId, teamId, status, score(sort: Desc), id])')
  })
})
