# Database design

Prisma is the canonical schema and MySQL 8 is the database engine. UUID values use `CHAR(36)` to avoid exposing sequential identifiers. Latitude uses `Decimal(10,7)` and longitude uses `Decimal(11,7)`. Text uses `utf8mb4` with `utf8mb4_unicode_ci`; all timestamps are stored in UTC.

## Core relationships

- `CitizenUser 1—N ExternalIdentity`, `Incident`, `Notification`, `DeviceToken`
- `Incident 1—N IncidentImage`, `IncidentStatusHistory`, `IncidentNote`, `IncidentAssignment`, `Notification`
- `AdminUser` owns assignments, notes, status changes, notifications, settings and audit entries when applicable
- `RefreshToken` uses `ownerType/ownerId` for citizen/admin and self-relation for rotation
- `CaseCounter` provides one atomic annual incident sequence

## Integrity and indexes

- Unique: external provider/user ID, admin username/email, incident case code, client request ID and device token.
- Indexed filters: status, type, priority, reported date, citizen, assignee, province and created date.
- Incident mutations that create history/audit/notification run in one transaction.
- Incident type is constrained in MySQL to `AIRCRAFT_ACCIDENT` (อากาศยานประสบภัย) or `DISASTER_RELIEF` (ช่วยเหลือบรรเทาสาธารณภัย).
- Case code allocation uses a Serializable transaction and unique constraint, not `COUNT + 1`.
- Binary images never enter MySQL; only validated metadata and storage keys are stored.

## Environment isolation

- Development: `police_incident_system`
- Prisma migration shadow database: `police_incident_shadow`
- Automated tests: `police_incident_test`
- Test cleanup/reset scripts reject URLs that do not resolve to the configured `_test` database.
- Production reset operations are prohibited.

## Retention

Operational retention and legal holds remain owner-configurable. Refresh tokens are revoked rather than deleted immediately; audit logs are append-only to application roles.
