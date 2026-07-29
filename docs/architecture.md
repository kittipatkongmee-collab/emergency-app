# System architecture

## Context
The platform has three clients in one repository: a Flutter citizen app, an Angular police back office and a NestJS API. PostgreSQL is the system of record. Socket.IO provides live foreground updates; FCM is the background notification adapter.

## Runtime flow
1. Flutter exchanges a Facebook token for short-lived system JWTs.
2. The citizen submits incident metadata and 1–5 validated images.
3. NestJS stores metadata transactionally in PostgreSQL and binary files through `StorageAdapter`.
4. Authorized admin users receive `incident.created`, assign work and update status.
5. Each mutation writes status/assignment history and an audit log, creates a notification, then emits scoped realtime events.
6. Flutter refreshes the timeline and receives FCM when not connected.

## Trust boundaries
- Browser/mobile input, Facebook responses, files and WebSocket handshakes are untrusted.
- RBAC and ownership are enforced in NestJS. UI guards improve navigation but are not authorization.
- Access tokens are short-lived. Rotating refresh tokens are stored hashed and can be revoked.
- Admin passwords use Argon2. Sensitive values are excluded from serialized results and logs.

## Assumptions
- The seven screenshots are visual direction, not source assets; no approved logo file exists yet.
- Local file storage is the default for development, with an S3-compatible adapter selected in production.
- Google Maps is selected when a key exists; map views show a configuration state otherwise.
- Facebook, FCM and reverse geocoding use real adapters. A citizen development login is permitted only with `NODE_ENV=development` plus `DEV_AUTH_BYPASS=true`.
- Thailand/Bangkok is the display timezone; timestamps are stored in UTC.
- Incident codes use the database-backed annual sequence pattern `CASE-YYYY-#####`.
- Smart card and PDF export are extension interfaces only in the first release.

## Environments
- Development: local PostgreSQL, local uploads, Swagger enabled, optional auth bypass.
- Staging: isolated database/storage, real external test credentials, Swagger access-controlled.
- Production: TLS proxy, managed PostgreSQL, S3-compatible storage, Swagger optional, no auth bypass.

## Required owner inputs
- Approved Police Aviation Division and Royal Thai Police logo assets.
- Facebook App ID/secret and iOS/Android bundle configuration.
- Google Maps key restricted to approved apps/domains.
- Firebase service account values and mobile configuration files.
- Production database, JWT secrets, S3 endpoint/bucket/keys and allowed origins.
- Final help-desk phone/email, privacy notice and data-retention policy.
