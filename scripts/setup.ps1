$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
pnpm install
Push-Location 'apps/mobile'
try { flutter pub get } finally { Pop-Location }
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
Write-Host 'ติดตั้งสำเร็จ: ใช้ .\scripts\dev.ps1 เพื่อเปิดระบบ'
