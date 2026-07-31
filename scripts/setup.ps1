$ErrorActionPreference = 'Stop'
$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new()
if (
  -not (Test-Path '.env') -or
  -not (Select-String -Path '.env' -Pattern '^DATABASE_URL=mysql://' -Quiet)
) {
  pnpm env:configure
  if ($LASTEXITCODE -ne 0) { throw 'Unable to configure the development environment' }
}
Get-Content '.env' | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
Push-Location 'apps/mobile'
try {
  flutter pub get
  if ($LASTEXITCODE -ne 0) { throw 'flutter pub get failed' }
} finally { Pop-Location }
docker compose up -d --wait --wait-timeout 120 mysql
if ($LASTEXITCODE -ne 0) { throw 'MySQL container failed to start' }
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { throw 'MySQL migration failed' }
pnpm db:seed
if ($LASTEXITCODE -ne 0) { throw 'Database seed failed' }
Write-Host 'ติดตั้งสำเร็จ: ใช้ .\scripts\dev.ps1 เพื่อเปิดระบบ'
