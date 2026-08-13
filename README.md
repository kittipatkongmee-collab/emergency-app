# ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน

Monorepo สำหรับแอปประชาชน (Flutter), เว็บเจ้าหน้าที่ (Angular) และ PHP API ที่ใช้ FastRoute, PDO และ MariaDB 10.6 โดยเก็บ NestJS API ไว้คู่ขนานสำหรับตรวจสอบความเท่าเทียมระหว่างการย้ายระบบ

## สิ่งที่ต้องติดตั้ง

- Node.js 22 ขึ้นไป และ pnpm 11
- Composer 2
- Docker Desktop (Linux containers)
- FVM 3.2 ขึ้นไป, Flutter 3.41.0 ที่ติดตั้งผ่าน FVM และ Android Studio สำหรับรัน Android emulator
- PowerShell 7 แนะนำสำหรับ Windows

## ติดตั้งและสร้างฐานข้อมูลครั้งแรก

เปิด Docker Desktop และรอจนขึ้น `Engine running` จากนั้นเปิด PowerShell ที่โฟลเดอร์โปรเจกต์:

```powershell
fvm install
pnpm install
composer install --working-dir=apps/api-php
pnpm env:configure
```

`pnpm env:configure` สร้างไฟล์ `.env` พร้อมรหัสแบบสุ่มสำหรับ development ห้าม commit ไฟล์นี้

เมื่อใช้ `pnpm start` ระบบจะสร้าง MariaDB และนำเข้าโครงสร้างฐานข้อมูลจาก `apps/api-php/database/schema.sql` ให้อัตโนมัติ

## เปิดระบบ

เปิดระบบทั้งหมดด้วยคำสั่งเดียวจากโฟลเดอร์หลัก:

```powershell
pnpm start
```

คำสั่งนี้จะ build และสร้าง PHP API container ใหม่ เปิด MariaDB, เว็บหลังบ้านในเบราว์เซอร์ และแอป Android พร้อมกัน โดยเลือกอุปกรณ์ Android ที่เชื่อมต่ออยู่ หรือเปิด emulator ตัวแรกให้อัตโนมัติ กด `Ctrl+C` เพื่อปิดเว็บและแอป

หากต้องการระบุอุปกรณ์เอง ให้ตั้งค่า `MOBILE_DEVICE_ID` หรือระบุ emulator ด้วย `ANDROID_EMULATOR_ID` ก่อนรันคำสั่ง เช่น:

```powershell
$env:ANDROID_EMULATOR_ID='Pixel_9'
pnpm start
```

หากต้องการเปิดแยกแต่ละส่วน ให้ใช้ PowerShell คนละหน้าต่าง:

```powershell
pnpm php:compose:up
pnpm dev:web
$env:MOBILE_API_PORT='8085'
pnpm mobile:run:android
```

- PHP API: `http://localhost:8085/api/v1`
- PHP API readiness: `http://localhost:8085/api/v1/ready`
- Angular: `http://localhost:4200`
- Flutter Android ใช้ `adb reverse` เพื่อเข้าถึง API ผ่าน `127.0.0.1` และใช้ `10.0.2.2` เป็น fallback สำหรับ emulator

คำสั่งลัด:

- `pnpm start` หรือ `pnpm start:all` เปิด MariaDB, PHP API, Angular และ Flutter Android พร้อมกัน
- `pnpm start:nest` เปิดระบบ NestJS เดิมสำหรับตรวจสอบ parity
- `pnpm start:services` เปิด MySQL, API และ Angular
- `pnpm start:backend` เปิด MySQL และ API
- `pnpm start:web` เปิด Angular
- `pnpm start:app` เปิด Flutter บน emulator
- `pnpm start:app:web` เปิด Flutter บน Chrome
- `pnpm start:docker` build และเปิด production preview ที่ `http://localhost:8080`

## Development accounts

รหัสผ่านของเจ้าหน้าที่ทุกบัญชีอ่านจาก `ADMIN_SEED_PASSWORD` ใน `.env`

| Username                                           | Role        |
| -------------------------------------------------- | ----------- |
| ค่าจาก `ADMIN_SEED_USERNAME` (ค่าเริ่มต้น `admin`) | SUPER_ADMIN |
| `supervisor1`                                      | SUPERVISOR  |
| `officer1`, `officer2`, `officer3`                 | OFFICER     |
| `viewer1`                                          | VIEWER      |

Development citizen login ใช้บัญชี `test1` และสร้างบัญชีให้อัตโนมัติเมื่อเข้าสู่ระบบ เปิดได้เฉพาะ `APP_ENV=development`, `NODE_ENV=development`, `DEV_AUTH_BYPASS=true`

## คำสั่งฐานข้อมูล

```powershell
pnpm db:status
pnpm db:validate
pnpm db:generate
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:check
pnpm db:verify:mysql
pnpm db:studio
pnpm db:stop
```

ใช้ `pnpm db:reset` เฉพาะฐาน development และ `pnpm db:test:reset` เฉพาะฐาน test สคริปต์จะตรวจชื่อฐานก่อนลบเสมอ

## ตรวจสอบคุณภาพ

```powershell
pnpm lint
pnpm test
pnpm test:api:e2e
pnpm build
pnpm mobile:analyze
pnpm mobile:test
```

## Environment ที่สำคัญ

- Database: `DATABASE_URL`, `SHADOW_DATABASE_URL`, `TEST_DATABASE_URL`
- Security: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, อายุ token และ `CORS_ORIGINS`
- Seed: `ADMIN_SEED_USERNAME`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_FULL_NAME`
- Storage: `STORAGE_DRIVER`, `STORAGE_LOCAL_PATH` หรือค่า `S3_*`
- Facebook: `FACEBOOK_LOGIN_ENABLED`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- LINE Login: `LINE_LOGIN_ENABLED`, `LINE_CHANNEL_ID`, `LINE_EMAIL_SCOPE_ENABLED`
- Firebase: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`
- Flutter: `APP_ENV`, `API_BASE_URL`, `MAP_TILE_URL`, `FCM_ENABLED`, `DEV_AUTH_BYPASS`

Production ต้องปิด `DEV_AUTH_BYPASS`, ใช้ secret ใหม่, CORS แบบระบุโดเมน และใช้ durable storage

## External services

- Facebook: [docs/facebook-integration-pending.md](docs/facebook-integration-pending.md)
- LINE Login: [docs/line-login-setup.md](docs/line-login-setup.md)
- Maps: [docs/map-setup.md](docs/map-setup.md)
- Firebase/FCM: [docs/firebase-setup.md](docs/firebase-setup.md)
- Deployment: [docs/deployment.md](docs/deployment.md)

ระบบส่วนอื่นทำงานได้โดยไม่ต้องมี credentials เหล่านี้ และ production จะไม่เปิด development provider เอง

## Windows troubleshooting

- Docker API/pipe not found: เปิด Docker Desktop รอ `Engine running` แล้วตรวจ `docker version`
- Port 3306 ถูกใช้: ตรวจ `Get-NetTCPConnection -LocalPort 3306` และหยุด MySQL ตัวอื่น หรือเปลี่ยน `DATABASE_PORT` พร้อม URL ใน `.env`
- `pnpm` ไม่พบ: รัน `corepack enable` แล้ว `corepack prepare pnpm@11.9.0 --activate`
- PowerShell บล็อก script: รัน `Set-ExecutionPolicy -Scope Process Bypass`
- Android ไม่พบ: เปิด emulator ใน Android Studio แล้วตรวจ `fvm flutter devices`
- Android เข้า localhost ไม่ได้: ใช้ `http://10.0.2.2:3000`
- Prisma authentication failed: ตรวจให้รหัสใน `.env` ตรงกับ volume ปัจจุบัน หากเป็น development ที่ลบได้ให้ใช้ `pnpm db:reset`

## Backup และ restore

```powershell
docker compose exec -T mysql sh -c 'mysqldump --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' |
  Set-Content -Encoding utf8 mysql-backup.sql
```

```powershell
Get-Content -Raw mysql-backup.sql |
  docker compose exec -T mysql sh -c 'mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

รายละเอียดเพิ่มอยู่ใน `docs/architecture.md`, `docs/database-design.md`, `docs/api-design.md` และ `docs/e2e-system-verification.md`
