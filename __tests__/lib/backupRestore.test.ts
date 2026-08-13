const { parseArgs, validateSecret, artifactNames, restoreContainerName } = require('@/scripts/backup-restore-lib.cjs')

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
})
