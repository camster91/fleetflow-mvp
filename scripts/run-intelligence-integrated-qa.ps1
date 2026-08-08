param([int]$Port = 3110, [int]$PostgresPort = 55439)
$ErrorActionPreference = 'Stop'
$containerName = "fleetvera-intelligence-qa-$PID"
$serverProcess = $null
$migrationFixture = Join-Path ([IO.Path]::GetTempPath()) "fleetvera-intelligence-migrations-$PID"
try {
  docker run --name $containerName -e POSTGRES_USER=fleetvera -e POSTGRES_PASSWORD=fleetvera_qa -e POSTGRES_DB=fleetvera_qa -p "${PostgresPort}:5432" -d postgres:16-alpine | Out-Null
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    docker exec $containerName pg_isready -U fleetvera -d fleetvera_qa 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL did not become ready' }
  $env:DATABASE_URL = "postgresql://fleetvera:fleetvera_qa@127.0.0.1:${PostgresPort}/fleetvera_qa"
  $env:JWT_SECRET = 'fleetvera-integrated-qa-secret-at-least-32-characters'
  $env:API_CURSOR_SECRET = 'fleetvera-integrated-cursor-secret-at-least-32-characters'
  $env:NEXTAUTH_URL = "http://127.0.0.1:${Port}"
  $env:PLAYWRIGHT_TEST_BASE_URL = $env:NEXTAUTH_URL
  $env:PLAYWRIGHT_INTEGRATED_DB = '1'

  # Rehearse an in-place upgrade from the last shipped findings migration.
  New-Item -ItemType Directory -Path (Join-Path $migrationFixture 'migrations') -Force | Out-Null
  Copy-Item prisma/schema.prisma (Join-Path $migrationFixture 'schema.prisma')
  Copy-Item prisma/migrations/migration_lock.toml (Join-Path $migrationFixture 'migrations/migration_lock.toml')
  foreach ($migration in @('20260807000000_postgresql_baseline', '20260808000000_stripe_webhook_idempotency', '20260808010000_api_key_scopes', '20260808020000_intelligence_findings')) {
    Copy-Item (Join-Path 'prisma/migrations' $migration) (Join-Path $migrationFixture 'migrations') -Recurse
  }
  npx prisma migrate deploy --schema (Join-Path $migrationFixture 'schema.prisma')
  $beforeUpgradeSql = "SELECT count(*) = 0 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'IntelligenceRun'"
  $runBeforeUpgrade = $beforeUpgradeSql | docker exec -i $containerName psql -U fleetvera -d fleetvera_qa -tA
  if ($runBeforeUpgrade.Trim() -ne 't') { throw 'Upgrade fixture unexpectedly contains IntelligenceRun before 030000' }
  $upgradeSeedSql = 'INSERT INTO "User" ("id","email","updatedAt") VALUES (''upgrade-user'',''upgrade@fleetvera.test'',CURRENT_TIMESTAMP); INSERT INTO "Team" ("id","name","ownerId","updatedAt") VALUES (''upgrade-team'',''Upgrade fixture'',''upgrade-user'',CURRENT_TIMESTAMP); INSERT INTO "IntelligenceFinding" ("id","ownerId","teamId","type","severity","confidence","score","ruleVersion","title","explanation","evidence","generatedAt") VALUES (''upgrade-finding'',''upgrade-user'',''upgrade-team'',''qa'',''low'',1,1,''qa'',''Upgrade finding'',''Preserved across migration'',''{"items":[],"total":0,"truncated":false}'',CURRENT_TIMESTAMP);'
  $upgradeSeedSql | docker exec -i $containerName psql -U fleetvera -d fleetvera_qa -v ON_ERROR_STOP=1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not seed the pre-030000 upgrade fixture' }
  npx prisma migrate deploy
  $upgradeSql = "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'IntelligenceRun') AND EXISTS (SELECT 1 FROM `"IntelligenceFinding`" WHERE id = 'upgrade-finding')"
  $upgradeCheck = $upgradeSql | docker exec -i $containerName psql -U fleetvera -d fleetvera_qa -tA
  if ($upgradeCheck.Trim() -ne 't') { throw '030000 upgrade did not create IntelligenceRun or preserve seeded findings' }

  # Rehearse a clean install independently in the same disposable server.
  docker exec $containerName createdb -U fleetvera fleetvera_fresh
  $upgradeDatabaseUrl = $env:DATABASE_URL
  $env:DATABASE_URL = "postgresql://fleetvera:fleetvera_qa@127.0.0.1:${PostgresPort}/fleetvera_fresh"
  npx prisma migrate deploy
  $freshSql = "SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'IntelligenceRun')"
  $freshCheck = $freshSql | docker exec -i $containerName psql -U fleetvera -d fleetvera_fresh -tA
  if ($freshCheck.Trim() -ne 't') { throw 'Fresh migration path did not create IntelligenceRun' }
  $env:DATABASE_URL = $upgradeDatabaseUrl
  # Prisma Client was generated before this harness; avoid replacing its native
  # engine while test workers may have it loaded on Windows.
  npx next build
  if ($LASTEXITCODE -ne 0) { throw 'Production Next build failed' }
  $serverProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('start', '--', '-p', "$Port") -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try { Invoke-WebRequest -Uri $env:NEXTAUTH_URL -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Milliseconds 500 }
  }
  npx playwright test e2e/intelligence-integrated.spec.ts --project=chromium --reporter=line
  if ($LASTEXITCODE -ne 0) { throw 'Integrated Playwright failed' }
  npx playwright test e2e/intelligence-brief.spec.ts --project=chromium --reporter=line
  if ($LASTEXITCODE -ne 0) { throw 'Mocked intelligence UI contract Playwright failed' }
} finally {
  if ($serverProcess) {
    $all = Get-CimInstance Win32_Process
    $targets = [System.Collections.Generic.HashSet[int]]::new()
    function Add-Descendants([int]$parent) { foreach ($child in $all | Where-Object ParentProcessId -eq $parent) { Add-Descendants $child.ProcessId }; [void]$targets.Add($parent) }
    Add-Descendants $serverProcess.Id
    foreach ($processId in $targets) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
  }
  docker rm -f $containerName 2>$null | Out-Null
  $resolvedFixture = [IO.Path]::GetFullPath($migrationFixture)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedFixture.StartsWith($tempRoot) -and (Split-Path $resolvedFixture -Leaf) -like 'fleetvera-intelligence-migrations-*') {
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force -ErrorAction SilentlyContinue
  }
}
