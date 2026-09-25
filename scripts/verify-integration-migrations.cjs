#!/usr/bin/env node
/*
 * Proves the integration migrations on disposable PostgreSQL containers:
 * a fresh install, an in-place upgrade from before 20260808060000 with the
 * stable-driver backfill fixture, and no schema drift in either database.
 *
 * Usage: node scripts/verify-integration-migrations.cjs [--fresh-port 55451] [--upgrade-port 55452]
 */
const { cpSync, mkdirSync, readdirSync } = require('fs')
const { randomUUID } = require('crypto')
const os = require('os')
const path = require('path')
const {
  main,
  npx,
  parseFlags,
  psql,
  removeContainers,
  removeTempDir,
  startPostgres,
  waitPostgres,
} = require('./qa-harness-lib.cjs')

const SKIPPED_FOR_UPGRADE = ['20260808060000_provider_integrations', '20260808073000_stable_driver_assignments']
const EXPECTED_BACKFILL = 'fixture-sam|NULL|fixture-sam|NULL|NULL|NULL'

const FIXTURE_SQL = `
INSERT INTO "User" (id,email,name,"updatedAt") VALUES
('fixture-owner','owner@fixture.test','Owner',NOW()),
('fixture-sam','sam@fixture.test','  Sam Driver  ',NOW()),
('fixture-alex-a','alex-a@fixture.test','Alex Driver',NOW()),
('fixture-alex-b','alex-b@fixture.test',' alex driver ',NOW()),
('fixture-tech','tech@fixture.test','Taylor Tech',NOW());
INSERT INTO "Team" (id,name,"ownerId","updatedAt") VALUES ('fixture-team','Fixture Team','fixture-owner',NOW());
INSERT INTO "TeamMember" (id,"teamId","userId",role,status) VALUES
('fixture-member-sam','fixture-team','fixture-sam','DRIVER','ACCEPTED'),
('fixture-member-alex-a','fixture-team','fixture-alex-a','DRIVER','ACCEPTED'),
('fixture-member-alex-b','fixture-team','fixture-alex-b','DRIVER','ACCEPTED');
INSERT INTO "TeamMember" (id,"teamId","userId",role,status) VALUES ('fixture-member-tech','fixture-team','fixture-tech','TECHNICIAN','ACCEPTED');
INSERT INTO "Vehicle" (id,name,driver,"ownerId","teamId","updatedAt") VALUES
('fixture-vehicle-unique','Unique Vehicle','sam driver','fixture-owner','fixture-team',NOW()),
('fixture-vehicle-ambiguous','Ambiguous Vehicle','Alex Driver','fixture-owner','fixture-team',NOW()),
('fixture-vehicle-nondriver','Non-driver Vehicle','Taylor Tech','fixture-owner','fixture-team',NOW());
INSERT INTO "Delivery" (id,address,customer,driver,"ownerId","teamId","updatedAt") VALUES
('fixture-delivery-unique','1 Fixture Road','Unique Delivery',' SAM DRIVER ','fixture-owner','fixture-team',NOW()),
('fixture-delivery-ambiguous','2 Fixture Road','Ambiguous Delivery','alex driver','fixture-owner','fixture-team',NOW()),
('fixture-delivery-nondriver','3 Fixture Road','Non-driver Delivery','Taylor Tech','fixture-owner','fixture-team',NOW());
`

const BACKFILL_SQL = `
SELECT concat_ws('|',
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-unique'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-ambiguous'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-unique'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-ambiguous'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-nondriver'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-nondriver'));
`

main(async () => {
  const { 'fresh-port': freshPort, 'upgrade-port': upgradePort } = parseFlags(process.argv.slice(2), {
    defaults: { 'fresh-port': 55451, 'upgrade-port': 55452 },
    types: { 'fresh-port': 'port', 'upgrade-port': 'port' },
  })
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10)
  const freshName = `fleetvera-integrations-fresh-${suffix}`
  const upgradeName = `fleetvera-integrations-upgrade-${suffix}`
  const tempPrefix = 'fleetvera-integrations-'
  const tempRoot = path.join(os.tmpdir(), `${tempPrefix}${suffix}`)
  const db = { user: 'postgres', database: 'fleetvera' }

  const upgradeSql = (sql) => {
    const result = psql(upgradeName, { ...db, sql, extraArgs: ['-v', 'ON_ERROR_STOP=1', '-At'] })
    if (result.status !== 0) throw new Error('Upgrade fixture SQL failed')
    return result.stdout
  }

  try {
    startPostgres({ name: freshName, port: freshPort, database: db.database })
    startPostgres({ name: upgradeName, port: upgradePort, database: db.database })
    waitPostgres(freshName, { ...db, attempts: 40 })
    waitPostgres(upgradeName, { ...db, attempts: 40 })

    const freshUrl = `postgresql://postgres@127.0.0.1:${freshPort}/fleetvera?schema=public`
    const freshEnv = { ...process.env, DATABASE_URL: freshUrl }
    npx(['prisma', 'migrate', 'deploy'], null, freshEnv)
    npx(
      [
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        freshUrl,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      null,
      freshEnv
    )

    mkdirSync(path.join(tempRoot, 'migrations'), { recursive: true })
    cpSync('prisma/schema.prisma', path.join(tempRoot, 'schema.prisma'))
    cpSync('prisma/migrations/migration_lock.toml', path.join(tempRoot, 'migrations', 'migration_lock.toml'))
    for (const entry of readdirSync('prisma/migrations', { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIPPED_FOR_UPGRADE.includes(entry.name)) continue
      cpSync(path.join('prisma/migrations', entry.name), path.join(tempRoot, 'migrations', entry.name), {
        recursive: true,
      })
    }

    const upgradeUrl = `postgresql://postgres@127.0.0.1:${upgradePort}/fleetvera?schema=public`
    const upgradeEnv = { ...process.env, DATABASE_URL: upgradeUrl }
    npx(['prisma', 'migrate', 'deploy', '--schema', path.join(tempRoot, 'schema.prisma')], null, upgradeEnv)
    process.stdout.write(upgradeSql(FIXTURE_SQL))
    npx(['prisma', 'migrate', 'deploy'], null, upgradeEnv)
    const backfillResult = upgradeSql(BACKFILL_SQL)
    const lastLine = backfillResult.trim().split(/\r?\n/).pop().trim()
    if (lastLine !== EXPECTED_BACKFILL)
      throw new Error(`Stable driver backfill fixture failed: ${backfillResult.trim()}`)
    npx(
      [
        'prisma',
        'migrate',
        'diff',
        '--from-url',
        upgradeUrl,
        '--to-schema-datamodel',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      null,
      upgradeEnv
    )
    console.log('Integration migration verification passed: fresh, upgrade, and no-diff.')
  } finally {
    removeContainers(freshName, upgradeName)
    removeTempDir(tempRoot, tempPrefix)
  }
})
