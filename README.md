# ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน กองบินตำรวจ

Monorepo ประกอบด้วย Flutter สำหรับประชาชน, Angular Back Office, NestJS API, Prisma และ PostgreSQL พร้อม RBAC, upload, audit log, notification และ Socket.IO

## Requirements
Node.js 22+, pnpm 11+, Docker Desktop, Flutter 3.41+ และ PowerShell 7 แนะนำบน Windows

## เริ่มต้น
1. คัดลอก `.env.example` เป็น `.env` และกำหนด `ADMIN_SEED_PASSWORD`/JWT secrets
2. รัน `.\scripts\setup.ps1`
3. รัน `pnpm dev:api` และ `pnpm dev:web` หรือ `.\scripts\dev.ps1`
4. Mobile: `cd apps/mobile`, `flutter pub get`, แล้ว `flutter run --dart-define=APP_ENV=development`

PostgreSQL: `docker compose up -d postgres` (พอร์ตเริ่มต้น 5433 เพื่อไม่ชน PostgreSQL ที่ติดตั้งใน Windows)  
Migration: `pnpm db:migrate` · Seed: `pnpm db:seed` · Studio: `pnpm db:studio`

API: `http://localhost:3000/api/v1` · Swagger: `http://localhost:3000/docs` · Admin: `http://localhost:4200`

## ตรวจคุณภาพและ Build
`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm mobile:analyze`, `pnpm mobile:test`  
Production preview: `docker compose up --build` แล้วเปิด `http://localhost:8080`

## External services
ดู `docs/facebook-login-setup.md`, `docs/firebase-setup.md` และ `docs/map-setup.md` ก่อนเปิด Facebook, push หรือแผนที่จริง โลโก้ใน UI เป็น placeholder จนกว่าจะได้รับ Asset ต้นฉบับที่อนุมัติ

Build environment ของ Flutter ใช้ `APP_ENV=development|staging|production`; เปิดบริการจริงด้วย `MAPS_ENABLED=true`, `FCM_ENABLED=true`, `API_BASE_URL` และ `SOCKET_URL` ผ่าน `--dart-define` โดยห้ามฝัง Key ลงใน Dart source

## Windows troubleshooting
- หาก Docker ไม่พร้อม ให้เปิด Docker Desktop แล้วตรวจด้วย `docker version`
- หาก port 5433 ถูกใช้ ให้เปลี่ยน `POSTGRES_PORT` และ `DATABASE_URL` ให้ตรงกัน
- หาก PowerShell บล็อก script ใช้ `Set-ExecutionPolicy -Scope Process Bypass`
- หาก Android emulator เรียก localhost ให้ตั้ง API URL เป็น `http://10.0.2.2:3000/api/v1`
- ล้างฐานข้อมูล development เท่านั้นด้วย `.\scripts\reset-database.ps1 -WhatIf` เพื่อตรวจก่อน แล้วรันโดยไม่ใส่ `-WhatIf`

รายละเอียดสถาปัตยกรรม ฐานข้อมูล API และ deployment อยู่ในโฟลเดอร์ `docs/`
