param([switch]$Focused, [switch]$AuditOnly, [switch]$RealOnly)
$ErrorActionPreference = 'Stop'
$containerName = "fleetvera-task16-$PID"
$serverProcess = $null
$documentStorage = Join-Path ([IO.Path]::GetTempPath()) "fleetvera-task16-documents-$PID"
function Stop-AppProcess {
  if (-not $script:serverProcess) { return }
  $allProcesses = Get-CimInstance Win32_Process
  $targets = [System.Collections.Generic.HashSet[int]]::new()
  function Add-Descendants([int]$parent) {
    foreach ($child in $allProcesses | Where-Object ParentProcessId -eq $parent) { Add-Descendants $child.ProcessId }
    [void]$targets.Add($parent)
  }
  Add-Descendants $script:serverProcess.Id
  foreach ($processId in $targets) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
  $script:serverProcess = $null
}
function Start-AppProcess([switch]$Development) {
  $serverArgs = if ($Development) { @('run', 'dev', '--', '-p', '3116') } else { @('start', '--', '-p', '3116') }
  $script:serverProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList $serverArgs -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    try { Invoke-WebRequest -Uri $env:NEXTAUTH_URL -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { Start-Sleep -Milliseconds 500 }
  }
  throw 'Fleetvera test server did not become ready'
}
try {
  docker run --name $containerName -e POSTGRES_USER=fleetvera -e POSTGRES_PASSWORD=fleetvera_qa -e POSTGRES_DB=fleetvera_qa -p '127.0.0.1:55461:5432' -d postgres:16-alpine | Out-Null
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    docker exec $containerName pg_isready -U fleetvera -d fleetvera_qa *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL did not become ready' }
  $env:DATABASE_URL = 'postgresql://fleetvera:fleetvera_qa@127.0.0.1:55461/fleetvera_qa'
  $env:JWT_SECRET = 'fleetvera-task16-local-jwt-secret-at-least-32-characters'
  $env:API_CURSOR_SECRET = 'fleetvera-task16-local-cursor-secret-32-characters'
  $env:NEXTAUTH_URL = 'http://127.0.0.1:3116'
  $env:PLAYWRIGHT_TEST_BASE_URL = $env:NEXTAUTH_URL
  $env:PLAYWRIGHT_INTEGRATED_DB = '1'
  $env:ACTION_PREVIEW_KEYS = '{"current":"fleetvera-task16-action-preview-secret-at-least-32-bytes"}'
  $env:ACTION_PREVIEW_CURRENT_KID = 'current'
  $env:DOCUMENT_STORAGE_PATH = $documentStorage
  $env:DOCUMENT_STORAGE_SECRET = 'fleetvera-task16-document-storage-secret-32-bytes'
  $env:DOCUMENT_SCANNER_PROVIDER = 'disabled'
  $env:CRON_SECRET = 'fleetvera-task16-cron-secret-at-least-32-bytes'
  $env:INTEGRATION_ENCRYPTION_KEYS = 'task16:MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI='
  $env:INTEGRATION_ALLOW_TEST_PROVIDERS = '1'
  $env:GOOGLE_MAPS_SERVER_API_KEY = 'task16-local-key'
  $env:GOOGLE_MAPS_BASE_URL = 'http://127.0.0.1:3330'
  $env:QUICKBOOKS_CLIENT_ID = 'task16-local-client'
  $env:QUICKBOOKS_CLIENT_SECRET = 'task16-local-secret'
  $env:QUICKBOOKS_REDIRECT_URI = 'http://127.0.0.1:3116/api/integrations/quickbooks/callback'
  $env:QUICKBOOKS_API_BASE_URL = 'http://127.0.0.1:3330'
  $env:QUICKBOOKS_TOKEN_URL = 'http://127.0.0.1:3330/token'
  $env:QUICKBOOKS_REVOKE_URL = 'http://127.0.0.1:3330/revoke'
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
  npx next build
  if ($LASTEXITCODE -ne 0) { throw 'Production Next build failed' }
  Start-AppProcess -Development:$RealOnly
  if ($RealOnly) {
    npm run test:e2e:release:real -- --reporter=line
  } elseif ($AuditOnly) {
    npx playwright test e2e/ai-health.spec.ts e2e/documents.spec.ts e2e/intelligence-brief.spec.ts e2e/maintenance-risk.spec.ts e2e/release-audit.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --reporter=line
  } elseif ($Focused) {
    npx playwright test e2e/assistant-actions.spec.ts e2e/documents.spec.ts e2e/intelligence-brief.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --reporter=line
  } else {
    npm run test:e2e:release:mock -- --reporter=line
  }
  if ($LASTEXITCODE -ne 0) { throw "Mocked cross-browser Playwright failed with exit $LASTEXITCODE" }
  if (-not $Focused -and -not $AuditOnly -and -not $RealOnly) {
    Stop-AppProcess
    Start-AppProcess -Development
    npm run test:e2e:release:real -- --reporter=line
    if ($LASTEXITCODE -ne 0) { throw "Serial disposable-database Playwright failed with exit $LASTEXITCODE" }
  }
} finally {
  Stop-AppProcess
  docker rm -f $containerName *> $null
  $resolvedStorage = [IO.Path]::GetFullPath($documentStorage)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if ($resolvedStorage.StartsWith($tempRoot) -and (Split-Path $resolvedStorage -Leaf) -like 'fleetvera-task16-documents-*') {
    Remove-Item -LiteralPath $resolvedStorage -Recurse -Force -ErrorAction SilentlyContinue
  }
}
