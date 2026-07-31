# Database design

Prisma is the canonical schema and MySQL 8 is the database engine. UUID values use `CHAR(36)` to avoid exposing sequential identifiers. Latitude uses `Decimal(10,7)` and longitude uses `Decimal(11,7)`. Text uses `utf8mb4` with `utf8mb4_unicode_ci`; all timestamps are stored in UTC.

## Core relationships
- `CitizenUser 1—N Incident`
- `Incident 1—N IncidentImage`, `IncidentStatusHistory`, `IncidentNote`, `IncidentAssignment`, `Notification`
- `AdminUser` optionally owns assignments, notes, status changes, notifications, settings and audit entries.
- `RefreshToken` uses polymorphic `ownerType/ownerId` because citizen and admin identity stores are intentionally separate.

## Integrity and indexes
- Unique: Facebook ID, admin username/email, incident case code and device token.
- Indexed filters: status, type, priority, reported date, citizen, assignee, province and created date.
- Incident mutations that create history/audit/notification run in one transaction.
- Binary images never enter MySQL; only validated metadata and storage keys are stored.

## Environment isolation
- Development: `police_incident_system`
- Prisma migration shadow database: `police_incident_shadow`
- Automated tests: `police_incident_test`
- Test cleanup/reset scripts reject URLs that do not resolve to the configured `_test` database.
- Production reset operations are prohibited.

## Retention
Operational retention and legal holds remain owner-configurable. Refresh tokens are revoked rather than deleted immediately; audit logs are append-only to application roles.
