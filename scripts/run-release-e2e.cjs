#!/usr/bin/env node
/*
 * Release Playwright gate against a disposable PostgreSQL container and a
 * locally started app on :3116. Never targets a user or production database.
 *
 * Usage: node scripts/run-release-e2e.cjs [--focused | --audit-only | --real-only]
 *   (default) mocked cross-browser suite, then the serial real-database suite
 */
const os = require('os')
const path = require('path')
const { main, npx, parseFlags, removeContainers, removeTempDir, run, startNpm, startPostgres, stopProcessTree, waitForHttp, waitPostgres } = require('./qa-harness-lib.cjs')

main(async () => {
  const flags = parseFlags(process.argv.slice(2), {
    defaults: { focused: false, 'audit-only': false, 'real-only': false },
    types: { focused: 'boolean', 'audit-only': 'boolean', 'real-only': 'boolean' },
  })
  const focused = flags.focused, auditOnly = flags['audit-only'], realOnly = flags['real-only']
  const containerName = `fleetvera-task16-${process.pid}`
  const documentPrefix = 'fleetvera-task16-documents-'
  const documentStorage = path.join(os.tmpdir(), `${documentPrefix}${process.pid}`)
  let serverProcess = null

  const env = {
    ...process.env,
    DATABASE_URL: 'postgresql://fleetvera:fleetvera_qa@127.0.0.1:55461/fleetvera_qa',
    JWT_SECRET: 'fleetvera-task16-local-jwt-secret-at-least-32-characters',
    API_CURSOR_SECRET: 'fleetvera-task16-local-cursor-secret-32-characters',
    NEXTAUTH_URL: 'http://127.0.0.1:3116',
    PLAYWRIGHT_TEST_BASE_URL: 'http://127.0.0.1:3116',
    PLAYWRIGHT_INTEGRATED_DB: '1',
    ACTION_PREVIEW_KEYS: '{"current":"fleetvera-task16-action-preview-secret-at-least-32-bytes"}',
    ACTION_PREVIEW_CURRENT_KID: 'current',
    DOCUMENT_STORAGE_PATH: documentStorage,
    DOCUMENT_STORAGE_SECRET: 'fleetvera-task16-document-storage-secret-32-bytes',
    DOCUMENT_SCANNER_PROVIDER: 'disabled',
    CRON_SECRET: 'fleetvera-task16-cron-secret-at-least-32-bytes',
    INTEGRATION_ENCRYPTION_KEYS: 'task16:MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',
    INTEGRATION_ALLOW_TEST_PROVIDERS: '1',
    GOOGLE_MAPS_SERVER_API_KEY: 'task16-local-key',
    GOOGLE_MAPS_BASE_URL: 'http://127.0.0.1:3330',
    QUICKBOOKS_CLIENT_ID: 'task16-local-client',
    QUICKBOOKS_CLIENT_SECRET: 'task16-local-secret',
    QUICKBOOKS_REDIRECT_URI: 'http://127.0.0.1:3116/api/integrations/quickbooks/callback',
    QUICKBOOKS_API_BASE_URL: 'http://127.0.0.1:3330',
    QUICKBOOKS_TOKEN_URL: 'http://127.0.0.1:3330/token',
    QUICKBOOKS_REVOKE_URL: 'http://127.0.0.1:3330/revoke',
  }

  const startApp = async (development) => {
    serverProcess = startNpm(development ? ['run', 'dev', '--', '-p', '3116'] : ['start', '--', '-p', '3116'], env)
    if (!await waitForHttp(env.NEXTAUTH_URL, 90)) throw new Error('Fleetvera test server did not become ready')
  }
  const stopApp = () => { stopProcessTree(serverProcess); serverProcess = null }
  const playwright = (args) => run('npx', ['playwright', 'test', ...args], { env }).status
  const npmRun = (args) => run('npm', ['run', ...args], { env }).status

  try {
    startPostgres({ name: containerName, port: 55461, user: 'fleetvera', password: 'fleetvera_qa', database: 'fleetvera_qa' })
    try {
      waitPostgres(containerName, { user: 'fleetvera', database: 'fleetvera_qa', attempts: 60 })
    } catch {
      throw new Error('Disposable PostgreSQL did not become ready')
    }
    npx(['prisma', 'migrate', 'deploy'], 'Migration failed', env)
    npx(['next', 'build'], 'Production Next build failed', env)
    await startApp(realOnly)

    const browsers = ['--project=chromium', '--project=firefox', '--project=webkit', '--workers=1', '--reporter=line']
    let status
    if (realOnly) {
      status = npmRun(['test:e2e:release:real', '--', '--reporter=line'])
    } else if (auditOnly) {
      status = playwright(['e2e/ai-health.spec.ts', 'e2e/documents.spec.ts', 'e2e/intelligence-brief.spec.ts', 'e2e/maintenance-risk.spec.ts', 'e2e/release-audit.spec.ts', ...browsers])
    } else if (focused) {
      status = playwright(['e2e/assistant-actions.spec.ts', 'e2e/documents.spec.ts', 'e2e/intelligence-brief.spec.ts', ...browsers])
    } else {
      status = npmRun(['test:e2e:release:mock', '--', '--reporter=line'])
    }
    if (status !== 0) throw new Error(`Mocked cross-browser Playwright failed with exit ${status}`)

    if (!focused && !auditOnly && !realOnly) {
      stopApp()
      await startApp(true)
      const realStatus = npmRun(['test:e2e:release:real', '--', '--reporter=line'])
      if (realStatus !== 0) throw new Error(`Serial disposable-database Playwright failed with exit ${realStatus}`)
    }
  } finally {
    stopApp()
    removeContainers(containerName)
    removeTempDir(documentStorage, documentPrefix)
  }
})
