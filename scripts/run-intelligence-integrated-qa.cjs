#!/usr/bin/env node
/*
 * Final pre-release intelligence check against a disposable PostgreSQL
 * container: rehearses the 20260808030000 in-place upgrade and a clean
 * install, then runs the integrated and mocked intelligence Playwright specs
 * against a locally started production build. Never targets a user or
 * production database.
 *
 * Usage: node scripts/run-intelligence-integrated-qa.cjs [--port 3110] [--postgres-port 55439]
 */
const { cpSync, mkdirSync } = require('fs')
const os = require('os')
const path = require('path')
const {
  container,
  main,
  npx,
  parseFlags,
  psql,
  removeContainers,
  removeTempDir,
  run,
  startNpm,
  startPostgres,
  stopProcessTree,
  waitForHttp,
  waitPostgres,
} = require('./qa-harness-lib.cjs')

const PRE_RUNS_MIGRATIONS = [
  '20260807000000_postgresql_baseline',
  '20260808000000_stripe_webhook_idempotency',
  '20260808010000_api_key_scopes',
  '20260808020000_intelligence_findings',
]
const UPGRADE_SEED_SQL =
  'INSERT INTO "User" ("id","email","updatedAt") VALUES (\'upgrade-user\',\'upgrade@fleetvera.test\',CURRENT_TIMESTAMP); INSERT INTO "Team" ("id","name","ownerId","updatedAt") VALUES (\'upgrade-team\',\'Upgrade fixture\',\'upgrade-user\',CURRENT_TIMESTAMP); INSERT INTO "IntelligenceFinding" ("id","ownerId","teamId","type","severity","confidence","score","ruleVersion","title","explanation","evidence","generatedAt") VALUES (\'upgrade-finding\',\'upgrade-user\',\'upgrade-team\',\'qa\',\'low\',1,1,\'qa\',\'Upgrade finding\',\'Preserved across migration\',\'{"items":[],"total":0,"truncated":false}\',CURRENT_TIMESTAMP);'
const RUN_TABLE_EXISTS =
  "EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'IntelligenceRun')"

main(async () => {
  const { port, 'postgres-port': postgresPort } = parseFlags(process.argv.slice(2), {
    defaults: { port: 3110, 'postgres-port': 55439 },
    types: { port: 'port', 'postgres-port': 'port' },
  })
  const containerName = `fleetvera-intelligence-qa-${process.pid}`
  const fixturePrefix = 'fleetvera-intelligence-migrations-'
  const migrationFixture = path.join(os.tmpdir(), `${fixturePrefix}${process.pid}`)
  const upgradeDatabaseUrl = `postgresql://fleetvera@127.0.0.1:${postgresPort}/fleetvera_qa`
  let serverProcess = null

  const env = {
    ...process.env,
    DATABASE_URL: upgradeDatabaseUrl,
    JWT_SECRET: 'fleetvera-integrated-qa-secret-at-least-32-characters',
    API_CURSOR_SECRET: 'fleetvera-integrated-cursor-secret-at-least-32-characters',
    NEXTAUTH_URL: `http://127.0.0.1:${port}`,
    PLAYWRIGHT_TEST_BASE_URL: `http://127.0.0.1:${port}`,
    PLAYWRIGHT_INTEGRATED_DB: '1',
  }
  const query = (database, sql) =>
    psql(containerName, { user: 'fleetvera', database, sql, extraArgs: ['-tA'] }).stdout.trim()

  try {
    startPostgres({ name: containerName, port: postgresPort, user: 'fleetvera', database: 'fleetvera_qa' })
    try {
      waitPostgres(containerName, { user: 'fleetvera', database: 'fleetvera_qa', attempts: 60 })
    } catch {
      throw new Error('Disposable PostgreSQL did not become ready')
    }

    // Rehearse an in-place upgrade from the last shipped findings migration.
    mkdirSync(path.join(migrationFixture, 'migrations'), { recursive: true })
    cpSync('prisma/schema.prisma', path.join(migrationFixture, 'schema.prisma'))
    cpSync('prisma/migrations/migration_lock.toml', path.join(migrationFixture, 'migrations', 'migration_lock.toml'))
    for (const migration of PRE_RUNS_MIGRATIONS) {
      cpSync(path.join('prisma/migrations', migration), path.join(migrationFixture, 'migrations', migration), {
        recursive: true,
      })
    }
    npx(
      ['prisma', 'migrate', 'deploy', '--schema', path.join(migrationFixture, 'schema.prisma')],
      'Pre-030000 fixture migration failed',
      env
    )
    if (query('fleetvera_qa', `SELECT NOT ${RUN_TABLE_EXISTS}`) !== 't') {
      throw new Error('Upgrade fixture unexpectedly contains IntelligenceRun before 030000')
    }
    const seed = psql(containerName, {
      user: 'fleetvera',
      database: 'fleetvera_qa',
      sql: UPGRADE_SEED_SQL,
      extraArgs: ['-v', 'ON_ERROR_STOP=1'],
    })
    if (seed.status !== 0) throw new Error('Could not seed the pre-030000 upgrade fixture')
    npx(['prisma', 'migrate', 'deploy'], 'Upgrade migration failed', env)
    const upgradeCheck = query(
      'fleetvera_qa',
      `SELECT ${RUN_TABLE_EXISTS} AND EXISTS (SELECT 1 FROM "IntelligenceFinding" WHERE id = 'upgrade-finding')`
    )
    if (upgradeCheck !== 't')
      throw new Error('030000 upgrade did not create IntelligenceRun or preserve seeded findings')

    // Rehearse a clean install independently in the same disposable server.
    if (container(['exec', containerName, 'createdb', '-U', 'fleetvera', 'fleetvera_fresh']).status !== 0) {
      throw new Error('Could not create the fresh-install database')
    }
    const freshEnv = { ...env, DATABASE_URL: `postgresql://fleetvera@127.0.0.1:${postgresPort}/fleetvera_fresh` }
    npx(['prisma', 'migrate', 'deploy'], 'Fresh migration failed', freshEnv)
    if (query('fleetvera_fresh', `SELECT ${RUN_TABLE_EXISTS}`) !== 't')
      throw new Error('Fresh migration path did not create IntelligenceRun')

    // Prisma Client was generated before this harness; avoid replacing its
    // native engine while test workers may have it loaded on Windows.
    npx(['next', 'build'], 'Production Next build failed', env)
    serverProcess = startNpm(['start', '--', '-p', String(port)], env)
    await waitForHttp(env.NEXTAUTH_URL, 60)
    if (
      run(
        'npx',
        ['playwright', 'test', 'e2e/intelligence-integrated.spec.ts', '--project=chromium', '--reporter=line'],
        { env }
      ).status !== 0
    ) {
      throw new Error('Integrated Playwright failed')
    }
    if (
      run('npx', ['playwright', 'test', 'e2e/intelligence-brief.spec.ts', '--project=chromium', '--reporter=line'], {
        env,
      }).status !== 0
    ) {
      throw new Error('Mocked intelligence UI contract Playwright failed')
    }
  } finally {
    stopProcessTree(serverProcess)
    removeContainers(containerName)
    removeTempDir(migrationFixture, fixturePrefix)
  }
})
