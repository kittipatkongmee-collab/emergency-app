# ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน กองบินตำรวจ

Monorepo ประกอบด้วย Flutter สำหรับประชาชน, Angular Back Office, NestJS API, Prisma และ MySQL 8 พร้อม RBAC, upload, audit log, notification และ Socket.IO

## Requirements
Node.js 22+, pnpm 11+, Docker Desktop, Flutter 3.41+ และ PowerShell 7 แนะนำบน Windows

## เริ่มต้น
1. เปิด Docker Desktop แล้วตรวจว่า Engine ทำงาน
2. รัน `pnpm env:configure` เพื่อสร้าง `.env` พร้อมรหัส development แบบสุ่ม (ไฟล์นี้ห้าม commit)
3. รัน `.\scripts\setup.ps1`
4. รัน `pnpm dev:api` และ `pnpm dev:web` หรือ `.\scripts\dev.ps1`
5. Mobile: `cd apps/mobile`, `flutter pub get`, แล้ว `flutter run --dart-define=APP_ENV=development`

MySQL 8: `pnpm db:start` (พอร์ตเริ่มต้น 3306)
Generate: `pnpm db:generate` · Validate: `pnpm db:validate` · Migration: `pnpm db:migrate` · Deploy migration: `pnpm db:migrate:deploy` · Seed: `pnpm db:seed` · Studio: `pnpm db:studio`

ฐานข้อมูล development คือ `police_incident_system` และฐานข้อมูล test คือ `police_incident_test` ทั้งสองใช้ `utf8mb4`, `utf8mb4_unicode_ci` และ UTC

## ฐานข้อมูล Development และ Test
- Reset development พร้อม seed: `pnpm db:reset`
- Migrate test database: `pnpm db:test:migrate`
- Reset test database: `pnpm db:test:reset`
- ตรวจสถานะ MySQL: `pnpm db:status`
- ตรวจภาษาไทย/Emoji: `pnpm db:verify:mysql`

สคริปต์ reset ตรวจ protocol และชื่อฐานข้อมูลก่อนทุกครั้ง ห้ามใช้กับ Production

API: `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/docs` · Admin: `http://localhost:4200`

## ตรวจคุณภาพและ Build
`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm mobile:analyze`, `pnpm mobile:test`  
Production preview: `docker compose up --build` แล้วเปิด `http://localhost:8080`

## External services
ดู `docs/facebook-login-setup.md`, `docs/firebase-setup.md` และ `docs/map-setup.md` ก่อนเปิด Facebook, push หรือแผนที่จริง โลโก้ใน UI เป็น placeholder จนกว่าจะได้รับ Asset ต้นฉบับที่อนุมัติ

Build environment ของ Flutter ใช้ `APP_ENV=development|staging|production`; เปิดบริการจริงด้วย `MAPS_ENABLED=true`, `FCM_ENABLED=true`, `API_BASE_URL` และ `SOCKET_URL` ผ่าน `--dart-define` โดยห้ามฝัง Key ลงใน Dart source

## Windows troubleshooting
- หาก Docker ไม่พร้อม ให้เปิด Docker Desktop แล้วตรวจด้วย `docker version`
- หาก port 3306 ถูกใช้ ให้ตรวจด้วย `Get-NetTCPConnection -LocalPort 3306` แล้วหยุด MySQL เดิม หรือเปลี่ยน `DATABASE_PORT` และ port ใน `DATABASE_URL` ให้ตรงกัน
- หาก PowerShell บล็อก script ใช้ `Set-ExecutionPolicy -Scope Process Bypass`
- หาก Android emulator เรียก localhost ให้ตั้ง API URL เป็น `http://10.0.2.2:3000/api/v1`
- ล้างฐานข้อมูล development เท่านั้นด้วย `.\scripts\reset-database.ps1 -WhatIf` เพื่อตรวจก่อน แล้วรันโดยไม่ใส่ `-WhatIf`

รายละเอียดสถาปัตยกรรม ฐานข้อมูล API และ deployment อยู่ในโฟลเดอร์ `docs/`

## Backup และ Restore
สำรองข้อมูล development:

```powershell
docker compose exec -T mysql sh -c 'mysqldump --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' |
  Set-Content -Encoding utf8 mysql-backup.sql
```

กู้คืนข้อมูล:

```powershell
Get-Content -Raw mysql-backup.sql |
  docker compose exec -T mysql sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```
