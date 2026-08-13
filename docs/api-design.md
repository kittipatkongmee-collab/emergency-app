# API design

Base path คือ `/api/v1` และ Swagger อยู่ที่ `/docs` เมื่อเปิด `SWAGGER_ENABLED=true`

## Envelope

Success:

```json
{ "success": true, "data": {}, "meta": {} }
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "INCIDENT_NOT_FOUND",
    "message": "ไม่พบข้อมูลเหตุการณ์",
    "details": []
  },
  "requestId": "uuid"
}
```

## Authentication

- `POST /auth/development-login` เฉพาะ development
- `POST /auth/facebook`
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`
- `POST /admin/auth/login`, `POST /admin/auth/refresh`, `POST /admin/auth/logout`
- `GET /admin/auth/me`, `PATCH /admin/auth/change-password`

Access token แยก actor เป็น citizen/admin และ refresh token ถูก hash, rotate, revoke และเชื่อม token ตัวแทนด้วย `replacedByTokenId`

## Incidents

- `type` รับเฉพาะ `AIRCRAFT_ACCIDENT` หรือ `DISASTER_RELIEF`
- Citizen: `POST /incidents` accepts inline JSON Base64 images and creates the incident plus `IncidentImage` rows in one transaction; `GET /incidents/me`, `GET /incidents/me/:id`
- Citizen: `GET /incidents/code/:caseCode`, `GET /incidents/:id`
- Citizen: `POST /incidents/:id/images` accepts JSON Base64 (`images[].fileName`, `images[].contentBase64`) and legacy multipart uploads.
- Admin: `GET /admin/incidents`, `GET /admin/incidents/:id`
- ผู้ดูแลระดับ `SUPER_ADMIN` หรือ `SUPERVISOR`: `DELETE /admin/incidents/:id` ลบเหตุการณ์ รูปภาพ การแจ้งเตือน และข้อมูลลูกที่เกี่ยวข้อง โดยคง Audit Log ไว้
- Admin: `PATCH /admin/incidents/:id/accept`
- ผู้รับผิดชอบเหตุ: `PATCH /admin/incidents/:id/complete`
- Admin: `POST /admin/incidents/:id/notes`

การสร้าง incident รับ `Idempotency-Key` และ case code มาจาก `CaseCounter` ใน Serializable transaction รูปที่รองรับคือ JPG/JPEG/PNG/WEBP ไม่เกิน 10 MB ต่อไฟล์ สูงสุด 5 รูป ตรวจทั้ง MIME, extension และ file signature

## Operations

- Dashboard: summary, recent-incidents, incidents-by-status, incidents-by-type, incidents-by-date
- Users: list, create, detail, update, status, reset-password
- Notifications: list, unread-count, read, read-all, delete
- Devices: register, delete
- Audit: `GET /admin/audit-logs`
- Settings: `GET/PATCH /admin/settings`
- Health: `GET /health`, `GET /ready`

รายการรองรับ `page`, `limit`, `keyword`, enum filters, date boundaries และ sort ที่ endpoint กำหนด ผลลัพธ์มี `pagination.page`, `limit`, `total`, `totalPages`

## Authorization

- `SUPER_ADMIN`: ทุกงานรวมจัดการผู้ดูแลระบบ
- `SUPERVISOR`: dashboard, incidents, assignment และจัดการ officer
- `OFFICER`: เห็นและอัปเดตเฉพาะงานที่มอบหมาย
- `VIEWER`: อ่านอย่างเดียว
- Citizen อ่าน/แก้เฉพาะ resource ของตนเอง

## Realtime

Socket.IO handshake ใช้ access JWT และเข้าห้อง `admin:all`, `admin:{id}`, `citizen:{id}` ผู้ใช้ subscribe `incident:{id}` ได้เมื่อ backend ตรวจ ownership/RBAC แล้ว

Events: `incident.created`, `incident.updated`, `incident.assigned`, `incident.status.changed`, `notification.created`, `dashboard.summary.changed`
