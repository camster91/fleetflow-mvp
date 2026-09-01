const { REQUIRED_RESTORE_TABLES, parseArgs, validateSecret, artifactNames, restoreContainerName, restoreReadinessArgs, validateRestoreSummary } = require('@/scripts/backup-restore-lib.cjs')

describe('backup and isolated restore verifier safety contract', () => {
  test('requires explicit safe source and absolute backup directory', () => {
    expect(() => parseArgs([])).toThrow(/Usage/)
    expect(() => parseArgs(['--source-container', 'fleetflow-postgres', '--backup-dir', 'relative'])).toThrow(/absolute/)
    expect(() => parseArgs(['--source-container', 'fleetflow;rm', '--backup-dir', '/secure/backups'])).toThrow(/unsupported/)
    expect(parseArgs(['--source-container', 'fleetflow-postgres', '--backup-dir', '/secure/backups'])).toEqual({ sourceContainer: 'fleetflow-postgres', backupDir: expect.stringMatching(/secure[\\/]backups$/) })
  })
  test('refuses a weak backup encryption key', () => {
    expect(() => validateSecret('short')).toThrow(/at least 32/)
    expect(() => validateSecret('k'.repeat(32))).not.toThrow()
  })
  test('uses unpredictable encrypted artifact and disposable restore names', () => {
    const artifact = artifactNames(new Date('2026-08-13T12:00:00.000Z'))
    expect(artifact.baseName).toMatch(/^fleetvera-postgres-20260813T120000000Z-[a-f0-9]{12}\.dump\.enc$/)
    expect(artifact.metadataName).toBe(`${artifact.baseName}.json`)
    expect(restoreContainerName()).toMatch(/^fleetvera-restore-[a-f0-9]{16}$/)
  })
  test('waits for the exact restore database to accept a query', () => {
    expect(restoreReadinessArgs('fleetvera-restore-deadbeef')).toEqual([
      'exec', 'fleetvera-restore-deadbeef', 'psql', '-v', 'ON_ERROR_STOP=1',
      '-U', 'restore', '-d', 'restore', '-At', '-c', 'SELECT 1',
    ])
    expect(() => restoreReadinessArgs('restore;rm')).toThrow(/unsupported/)
  })
  test('requires migration, core-record, and ownership integrity evidence', () => {
    const valid = {
      publicTableCount: 47,
      criticalRowCounts: Object.fromEntries(REQUIRED_RESTORE_TABLES.map((table: string) => [table, table === 'User' ? 1 : 0])),
      migrations: { applied: 17, failed: 0 },
      integrity: {
        orphanedTeamOwners: 0,
        orphanedTeamMembers: 0,
        orphanedMemberUsers: 0,
        noncanonicalOwnerMemberships: 0,
      },
    }
    valid.criticalRowCounts._prisma_migrations = 17
    expect(validateRestoreSummary(valid)).toEqual([])

    expect(validateRestoreSummary({
      ...valid,
      criticalRowCounts: { ...valid.criticalRowCounts, User: 0 },
      migrations: { applied: 16, failed: 1 },
      integrity: { ...valid.integrity, noncanonicalOwnerMemberships: 1 },
    })).toEqual(expect.arrayContaining([
      'Restore contains no application users',
      'Restore contains failed or unfinished Prisma migrations',
      'Restore integrity check failed: noncanonicalOwnerMemberships',
    ]))
  })
})
