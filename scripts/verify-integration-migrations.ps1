param([int]$FreshPort = 55451, [int]$UpgradePort = 55452)
$ErrorActionPreference = 'Stop'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
$freshName = "fleetvera-integrations-fresh-$suffix"
$upgradeName = "fleetvera-integrations-upgrade-$suffix"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "fleetvera-integrations-$suffix"

function Invoke-Prisma([string[]]$Arguments) {
  & npx.cmd prisma @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Prisma command failed: $($Arguments -join ' ')" }
}

function Wait-Postgres([string]$Name) {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    & docker exec $Name pg_isready -U postgres -d fleetvera *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "$Name did not become ready"
}

try {
  & docker run --name $freshName -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fleetvera -p "127.0.0.1:${FreshPort}:5432" -d postgres:16-alpine | Out-Null
  & docker run --name $upgradeName -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fleetvera -p "127.0.0.1:${UpgradePort}:5432" -d postgres:16-alpine | Out-Null
  Wait-Postgres $freshName; Wait-Postgres $upgradeName

  $freshUrl = "postgresql://postgres:postgres@127.0.0.1:$FreshPort/fleetvera?schema=public"
  $env:DATABASE_URL = $freshUrl
  Invoke-Prisma @('migrate', 'deploy')
  Invoke-Prisma @('migrate', 'diff', '--from-url', $freshUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code')

  New-Item -ItemType Directory -Path (Join-Path $tempRoot 'migrations') | Out-Null
  Copy-Item -LiteralPath 'prisma/schema.prisma' -Destination (Join-Path $tempRoot 'schema.prisma')
  Copy-Item -LiteralPath 'prisma/migrations/migration_lock.toml' -Destination (Join-Path $tempRoot 'migrations/migration_lock.toml')
  Get-ChildItem -LiteralPath 'prisma/migrations' -Directory | Where-Object Name -ne '20260808060000_provider_integrations' | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $tempRoot 'migrations') -Recurse
  }
  $upgradeUrl = "postgresql://postgres:postgres@127.0.0.1:$UpgradePort/fleetvera?schema=public"
  $env:DATABASE_URL = $upgradeUrl
  Invoke-Prisma @('migrate', 'deploy', '--schema', (Join-Path $tempRoot 'schema.prisma'))
  Invoke-Prisma @('migrate', 'deploy')
  Invoke-Prisma @('migrate', 'diff', '--from-url', $upgradeUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code')
  Write-Output 'Integration migration verification passed: fresh, upgrade, and no-diff.'
} finally {
  & docker rm -f $freshName $upgradeName *> $null
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
