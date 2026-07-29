# API design

Base path: `/api/v1`. Swagger is available at `/docs` when enabled.

## Envelope
Success: `{"success":true,"data":{},"meta":{}}`

Error: `{"success":false,"error":{"code":"INCIDENT_NOT_FOUND","message":"ไม่พบข้อมูลเหตุการณ์","details":[]},"requestId":"uuid"}`

## Endpoint groups
- Citizen auth: `POST auth/facebook`, `POST auth/refresh`, `POST auth/logout`, `GET auth/me`
- Admin auth: `POST admin/auth/login`, refresh, logout, me and change-password
- Citizen incidents: create, own list, lookup by case code, detail and image upload
- Admin incidents: filtered list/detail, status, assignment and notes
- Dashboard: summary, recent, by-status and by-type
- Admin users, notifications/devices, settings, audit logs, health and readiness

List endpoints accept `page`, `limit`, `keyword`, applicable enum filters and ISO date boundaries. Pagination metadata contains `page`, `limit`, `total` and `totalPages`.

## Realtime
Socket.IO authenticates with the system access token. Admin rooms are role-scoped; citizens join only `citizen:{userId}`. Events: `incident.created`, `incident.updated`, `incident.assigned`, `incident.status.changed`, `notification.created`, `dashboard.summary.changed`.

## Idempotency
Incident creation accepts `Idempotency-Key`. The app also disables duplicate submission while the request is active.
