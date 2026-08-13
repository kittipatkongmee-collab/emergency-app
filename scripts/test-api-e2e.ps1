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

if (-not $env:TEST_DATABASE_URL) {
  throw 'ไม่พบ TEST_DATABASE_URL'
}

$uri = [Uri]$env:TEST_DATABASE_URL
$databaseName = $uri.AbsolutePath.TrimStart('/')
if (
  $uri.Scheme -ne 'mysql' -or
  $databaseName -ne $env:TEST_DATABASE_NAME -or
  $databaseName -notmatch '_test$'
) {
  throw 'ปฏิเสธการทดสอบ: URL ไม่ใช่ฐานข้อมูล Test ที่กำหนด'
}

pnpm db:test:reset
if ($LASTEXITCODE -ne 0) { throw 'Test database reset failed' }

$env:NODE_ENV = 'test'
$env:DEV_AUTH_BYPASS = 'true'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
pnpm --filter @police/api prisma:seed
if ($LASTEXITCODE -ne 0) { throw 'Test database seed failed' }

pnpm --filter @police/api exec jest --config ./test/jest-e2e.json --runInBand
if ($LASTEXITCODE -ne 0) { throw 'API end-to-end tests failed' }
