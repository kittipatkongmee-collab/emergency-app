# Delivery plan

ทำเครื่องหมาย `[x]` เฉพาะงานที่พัฒนาและตรวจผ่านจริงใน branch ปัจจุบัน

## Phase 1 — Database, migration, seed, authentication

- [x] MySQL-compatible Prisma schema ครบ 14 models และ indexes
- [x] Migration สำหรับ workflow, external identity, refresh rotation และ case counter
- [x] Seed เจ้าหน้าที่ ประชาชน เหตุการณ์ history/notes/notifications
- [x] Development citizen auth และ admin auth
- [x] JWT access/refresh rotation, revoke, Argon2 และ environment fail-closed
- [ ] BLOCKED: Waiting for Facebook credentials

## Phase 2 — Incident workflow

- [x] Citizen create/list/detail พร้อม ownership
- [x] Idempotency-Key และ case code แบบ atomic
- [x] Upload validation, storage adapter และ image metadata
- [x] Admin filter/detail/status/assignment/notes
- [x] Status history, notifications และ audit log transaction

## Phase 3 — Operations

- [x] Dashboard aggregate จาก MySQL จริง
- [x] User management และ role restrictions
- [x] Audit log, settings, notification และ device endpoints
- [x] Health และ readiness endpoints

## Phase 4 — Angular integration

- [x] Login, token storage, refresh interceptor, auth/role guards
- [x] Dashboard, incident list/filter/detail และ realtime refresh
- [x] Assignment, status, notes, users, notifications, audit, settings, profile
- [x] Loading, empty, error, retry และ responsive existing design
- [x] Angular tests หลัก

## Phase 5 — Flutter integration

- [x] Development login และ real citizen profile
- [x] Incident form, validation, image picker, location adapter, review/submit
- [x] History, detail timeline, notifications และ profile จาก API จริง
- [x] Secure token storage, refresh rotation และ logout
- [x] Flutter tests หลัก

## Phase 6 — Realtime and external adapters

- [x] Authenticated Socket.IO rooms และ incident ownership subscription
- [x] Incident/dashboard/notification realtime events
- [x] FCM adapter และ device-token persistence
- [ ] BLOCKED: Waiting for Firebase credentials and mobile config files
- [x] OpenStreetMap tile map สำหรับเลือกและแสดงพิกัดโดยไม่ใช้ API key
- [ ] BLOCKED: Waiting for approved production logo asset

## Phase 7 — Tests, security, build, documentation

- [x] Backend unit tests และ isolated MySQL E2E
- [x] Upload/RBAC/ownership/refresh/logout security coverage
- [x] Angular tests และ production build
- [x] Flutter analyze และ tests
- [x] Prisma validation, migration, seed, Unicode/MySQL verification
- [x] README และ architecture/database/API/external/deployment/E2E docs
- [ ] Manual acceptance บนอุปกรณ์ Android จริง
- [ ] Production credentials, S3 bucket, TLS/CORS domains และ release signing
