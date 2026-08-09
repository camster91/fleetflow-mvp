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

function Invoke-UpgradeSql([string]$Sql) {
  $Sql | & docker exec -i $upgradeName psql -U postgres -d fleetvera -v ON_ERROR_STOP=1 -At
  if ($LASTEXITCODE -ne 0) { throw 'Upgrade fixture SQL failed' }
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
  Get-ChildItem -LiteralPath 'prisma/migrations' -Directory | Where-Object Name -NotIn @('20260808060000_provider_integrations', '20260808073000_stable_driver_assignments') | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $tempRoot 'migrations') -Recurse
  }
  $upgradeUrl = "postgresql://postgres:postgres@127.0.0.1:$UpgradePort/fleetvera?schema=public"
  $env:DATABASE_URL = $upgradeUrl
  Invoke-Prisma @('migrate', 'deploy', '--schema', (Join-Path $tempRoot 'schema.prisma'))
  Invoke-UpgradeSql @'
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
'@
  Invoke-Prisma @('migrate', 'deploy')
  $backfillResult = Invoke-UpgradeSql @'
SELECT concat_ws('|',
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-unique'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-ambiguous'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-unique'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-ambiguous'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Vehicle" WHERE id='fixture-vehicle-nondriver'),
  (SELECT COALESCE("assignedDriverId", 'NULL') FROM "Delivery" WHERE id='fixture-delivery-nondriver'));
'@
  if (($backfillResult | Select-Object -Last 1).Trim() -ne 'fixture-sam|NULL|fixture-sam|NULL|NULL|NULL') {
    throw "Stable driver backfill fixture failed: $backfillResult"
  }
  Invoke-Prisma @('migrate', 'diff', '--from-url', $upgradeUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code')
  Write-Output 'Integration migration verification passed: fresh, upgrade, and no-diff.'
} finally {
  & docker rm -f $freshName $upgradeName *> $null
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
