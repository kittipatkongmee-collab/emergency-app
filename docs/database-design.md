# Database design

Prisma is the canonical schema. UUID primary keys avoid exposing sequential identifiers. Coordinates use `Decimal(10,7)`. All mutable records use UTC timestamps.

## Core relationships
- `CitizenUser 1—N Incident`
- `Incident 1—N IncidentImage`, `IncidentStatusHistory`, `IncidentNote`, `IncidentAssignment`, `Notification`
- `AdminUser` optionally owns assignments, notes, status changes, notifications, settings and audit entries.
- `RefreshToken` uses polymorphic `ownerType/ownerId` because citizen and admin identity stores are intentionally separate.

## Integrity and indexes
- Unique: Facebook ID, admin username/email, incident case code and device token.
- Indexed filters: status, type, priority, reported date, citizen, assignee, province and created date.
- Incident mutations that create history/audit/notification run in one transaction.
- Binary images never enter PostgreSQL; only validated metadata and storage keys are stored.

## Retention
Operational retention and legal holds remain owner-configurable. Refresh tokens are revoked rather than deleted immediately; audit logs are append-only to application roles.
