import fs from 'fs'
import path from 'path'

describe('action execution provenance retention migration', () => {
  it('removes owner cascade and indexes immutable snapshot identifiers', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'prisma/migrations/20260808041000_action_execution_provenance_retention/migration.sql'), 'utf8')
    expect(sql).toContain('DROP CONSTRAINT "ActionExecution_ownerId_fkey"')
    for (const column of ['proposerId', 'confirmerId', 'sourceFindingId']) expect(sql).toContain(`"${column}"`)
  })
})
