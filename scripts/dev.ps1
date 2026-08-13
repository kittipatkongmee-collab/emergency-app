$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
if (-not (Test-Path '.env')) { throw 'ไม่พบไฟล์ .env กรุณารัน pnpm env:configure ก่อน' }
Get-Content '.env' | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
docker compose up -d --wait --wait-timeout 120 mysql
if ($LASTEXITCODE -ne 0) { throw 'MySQL container failed to start' }
pnpm dev
