# MySQL conversion report

Date: 2026-07-31  
Branch: `chore/migrate-database-to-mysql`

## Scope

The existing repository was converted in place from PostgreSQL to MySQL 8. No production data existed and no data migration was requested. Flutter, Angular, NestJS, API contracts and UI source remain in place.

## Previous migration history

The following PostgreSQL migration was recorded before removal:

- `202607290001_initial/migration.sql`
- `migration_lock.toml` provider: `postgresql`

The migration contained PostgreSQL enums, native UUID columns, `JSONB`, PostgreSQL timestamp/DDL syntax and a `public` schema declaration. It was intentionally replaced rather than executed against MySQL.

## Schema conversion

- Prisma datasource provider changed to `mysql`.
- UUID primary and foreign keys changed to `String @db.Char(36)`.
- Latitude remains `Decimal(10,7)`; longitude changed to `Decimal(11,7)`.
- Long descriptions, notes, addresses, messages and user agents use MySQL `TEXT`.
- URLs and identifiers use bounded `VARCHAR` columns.
- Prisma `Json` maps to MySQL JSON.
- Search relies on the database `utf8mb4_unicode_ci` collation instead of PostgreSQL case-insensitive query mode.

## Runtime conversion

- Docker service: `mysql` using `mysql:8`.
- Development database: `police_incident_system`.
- Prisma migration shadow database: `police_incident_shadow` with database-scoped privileges.
- Test database: `police_incident_test`.
- Character set/collation: `utf8mb4` / `utf8mb4_unicode_ci`.
- Timezone: UTC.
- The API container connects to `mysql:3306`; host development connects to `localhost:3306`.
- Database passwords are generated into ignored `.env`; `.env.example` contains placeholders only.

## Verification

### Migrations

- Removed: `202607290001_initial/migration.sql` (PostgreSQL).
- Created and applied: `20260731040314_initial_mysql/migration.sql`.
- Development migration: passed.
- Test migration/reset: passed against `police_incident_test`.
- Prisma format, validate and generate: passed.

### Tables

Both development and test databases contain:

- `AdminUser`
- `AuditLog`
- `CitizenUser`
- `DeviceToken`
- `Incident`
- `IncidentAssignment`
- `IncidentImage`
- `IncidentNote`
- `IncidentStatusHistory`
- `Notification`
- `RefreshToken`
- `SystemSetting`
- `_prisma_migrations`

### Seed and connection

- Seed completed against `police_incident_system`.
- Seed สร้างเฉพาะบัญชีเจ้าหน้าที่และการตั้งค่าระบบ ข้อมูลประชาชนและเหตุการณ์เริ่มต้นเป็นข้อมูลว่าง
- MySQL connection check returned `utf8mb4`, `utf8mb4_unicode_ci` and `+00:00`.
- Backend smoke E2E created an incident, uploaded an image, authenticated admin/citizen users and changed incident status successfully.
- API running in Docker was verified to connect to `mysql:3306/police_incident_system`.
- `/api/v1/health` and `/api/v1/ready` succeeded through Nginx.

### Unicode and persistence

- Stored and read `ทดสอบแจ้งเหตุในประเทศไทย 🚨`.
- Stored and read a Thai address and special characters.
- Restarted the MySQL container and read the same record successfully.
- Removed the temporary verification record after the persistence check.

### Database isolation

- Test reset applied only to `police_incident_test`.
- Development seed counts remained unchanged after the test reset.
- Reset scripts reject non-MySQL URLs, unexpected database names and production mode.

### Quality results

- Backend lint: passed.
- Backend unit tests: 5 passed.
- Backend build: passed.
- Angular production build: passed.
- Flutter analyze: no issues found.
- Docker API/Admin image builds and full Compose startup: passed.
- `scripts/setup.ps1` completed against the MySQL environment and found the schema in sync.

### Dependencies

No direct PostgreSQL client dependency was present, so no database driver package was removed. Prisma and `@prisma/client` remain the only application database client; `mysql2` was not added.

### Cleanup and remaining considerations

- The old PostgreSQL container and `emergency-app_postgres_data` volume were removed after MySQL validation.
- Local XAMPP MySQL was stopped because it occupied port 3306. Keep it stopped while the Docker MySQL service uses that port.
- No production data was migrated, as explicitly requested.
- No application source or UI was removed. No commit or push was performed.
