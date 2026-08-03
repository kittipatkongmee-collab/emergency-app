# E2E system verification

วันที่ตรวจ: 31 กรกฎาคม 2026  
Environment: Windows, Docker Desktop, MySQL 8, isolated database `police_incident_test`

## Automated acceptance

คำสั่ง:

```powershell
pnpm test:api:e2e
```

สคริปต์ตรวจว่า URL เป็น MySQL และชื่อฐานลงท้าย `_test` ก่อน reset จากนั้น deploy migrations, seed และทดสอบ:

- development citizen/admin/viewer login
- citizen creation และ ExternalIdentity persistence
- incident create แบบ idempotent และ image metadata
- citizen ownership ป้องกันอ่าน incident ของผู้อื่น
- admin list/detail/assignment/status flow จน completed
- status history, notes, notifications และ audit log
- viewer ถูกห้ามแก้สถานะ
- refresh-token rotation และ logout revocation

ผลล่าสุด: 1 suite, 6 E2E tests ผ่านทั้งหมด

## Database verification

`pnpm db:check` และ `pnpm db:verify:mysql` ผ่าน การทดสอบยืนยันชื่อฐาน, MySQL version, utf8mb4/collation, UTC, ตารางจาก migration, ภาษาไทยและ emoji

Docker images ของ API และ Admin Web build ผ่าน จากนั้นเปิดผ่าน Nginx preview แล้วตรวจ `GET /api/v1/health` ได้ `status=ok` และหน้า Angular ตอบ HTTP 200 พร้อม `<app-root>` ก่อนหยุด preview services

## Persistence

MySQL ใช้ named volume `mysql_data` และไฟล์ local upload ใช้ volume `uploads` ใน Docker preview ตรวจด้วย `pnpm db:check` ก่อนและหลัง `pnpm db:stop` → `pnpm db:start` แล้ว จำนวนยังเท่ากันที่ citizens 6, admins 6, incidents 16 และ schema/collation/timezone ไม่เปลี่ยน การเชื่อมต่อระหว่าง startup จะรอจน healthcheck เป็น `healthy` ห้ามใช้ `docker compose down -v`

## Manual UI acceptance

หลังเปิด API, Angular และ Flutter ให้ตรวจ flow เดียวกับ automated E2E ผ่านหน้าจอจริง: development login → ส่งเหตุพร้อมรูป/พิกัด → admin มอบหมายและเปลี่ยนสถานะ → Flutter timeline/notification อัปเดต ข้อนี้ต้องทำซ้ำบนอุปกรณ์เป้าหมายจริงก่อน production release

รายงานนี้ไม่มี password, token หรือ secret
