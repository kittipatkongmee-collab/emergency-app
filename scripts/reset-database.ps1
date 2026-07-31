[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet('Development', 'Test')]
  [string]$Target = 'Test',
  [switch]$Seed
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()

if (-not (Test-Path '.env')) {
  throw 'ไม่พบไฟล์ .env'
}

Get-Content '.env' | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}

$databaseUrl = if ($Target -eq 'Test') {
  $env:TEST_DATABASE_URL
} else {
  $env:DATABASE_URL
}

if (-not $databaseUrl) {
  throw "ไม่พบ URL สำหรับฐานข้อมูล $Target"
}

$uri = [Uri]$databaseUrl
$databaseName = $uri.AbsolutePath.TrimStart('/')
if ($uri.Scheme -ne 'mysql') {
  throw 'Reset รองรับเฉพาะ mysql://'
}

if ($Target -eq 'Test') {
  if ($databaseName -ne $env:TEST_DATABASE_NAME -or $databaseName -notmatch '_test$') {
    throw 'ปฏิเสธการ Reset: URL ไม่ใช่ฐานข้อมูล Test ที่กำหนด'
  }
} else {
  if ($env:NODE_ENV -eq 'production') {
    throw 'ห้าม Reset ฐานข้อมูล Production'
  }
  if ($databaseName -ne $env:DATABASE_NAME -or $databaseName -ne 'police_incident_system') {
    throw 'ปฏิเสธการ Reset: URL ไม่ใช่ฐานข้อมูล Development ที่กำหนด'
  }
}

if ($PSCmdlet.ShouldProcess($databaseName, "reset MySQL $Target database")) {
  $env:DATABASE_URL = $databaseUrl
  pnpm --filter @police/api prisma:reset
  if ($LASTEXITCODE -ne 0) { throw 'Database reset failed' }

  if ($Seed) {
    pnpm --filter @police/api prisma:seed
    if ($LASTEXITCODE -ne 0) { throw 'Database seed failed' }
  }
}
