import fs from 'fs'
import path from 'path'

describe('API key scope migration', () => {
  it('keeps historical keys inert and creates the durable quota table', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20260808010000_api_key_scopes/migration.sql'), 'utf8')
    expect(sql).toMatch(/ADD COLUMN "scopes" TEXT NOT NULL DEFAULT ''/)
    expect(sql).toContain('CREATE TABLE "ApiRateLimit"')
    expect(sql).toContain('PRIMARY KEY ("keyId", "bucketStart")')
  })
})
