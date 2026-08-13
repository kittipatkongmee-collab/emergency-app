# System architecture

## Context

ระบบมี Flutter citizen app, Angular backoffice และ API สอง implementation ระหว่าง
ช่วงเปลี่ยนผ่าน: NestJS เดิมกับ PHP 5.6 ใน `apps/api-php` MariaDB 10.6 เป็น system
of record ของ PHP API ส่วน Firebase RTDB ส่งเฉพาะ realtime trigger และ FCM ส่ง
background notification

## Runtime flow

1. Client แลก LINE/Facebook credential เป็น access และ rotating refresh JWT
2. PHP ตรวจ ownership/RBAC แล้วเขียน incident, history, notification และ
   `RealtimeOutbox` ใน MariaDB transaction เดียวกัน
3. PHP พยายามส่ง event ไป RTDB ทันที; cron retry outbox ทุกหนึ่งนาที
4. Client อ่าน `/channels/admin` หรือ `/channels/users/{kind}:{userId}` ตาม Rules
5. Event มีเฉพาะ `version`, `eventId`, `type`, `entityId`, `occurredAt`; clientโหลด
   authoritative data จาก API ใหม่ทุกครั้ง รวมถึง reconnect/focus/resume
6. FCM แจ้ง background client โดย device token ที่ลงทะเบียนกับ API

## Trust boundaries

- Browser/mobile input, external identity responses, upload และ Firebase event
  เป็น untrusted input
- PHP บังคับ ownership และ RBAC 4 ระดับ; Firebase Rules ปิด client write ทั้งหมด
- Refresh token เก็บเฉพาะ SHA-256 hash, rotate ภายใต้ row lock และ revoke token
  family เมื่อพบ replay
- รหัสผ่านใหม่ใช้ bcrypt cost 12; service account และ `.env` อยู่นอก `public_html`
- UUID เป็น `CHAR(36)`, collation `utf8mb4_unicode_ci`, timestamp เก็บ UTC

## Environments

- Development/test: PHP 5.6 Apache + MariaDB 10.6 Docker, Firebase Emulator/fakes
- Staging/production: DirectAdmin HTTPS, WAF/ModSecurity, isolated MariaDB/Firebase
- `DEV_AUTH_BYPASS` ใช้ได้เฉพาะ development/test และ production ต้อง abort startup

PHP 5.6 เป็น legacy/EOL และไม่มี upstream security support การ pin dependency,
WAF, rate limit และ fail-closed config เป็นเพียงการลดความเสี่ยง ไม่ใช่การทำให้
runtime กลับมาได้รับ security support
