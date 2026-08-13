# Police Incident System – Engineering Rules

## Architecture
- On `develop-php`, use Flutter, Angular standalone components, modular PHP 5.6, FastRoute, PDO, MariaDB 10.6, Firebase RTDB and FCM. Keep NestJS in parallel only for parity comparison until migration acceptance.
- Organize PHP by controllers, services and repositories, Angular by feature, and Flutter by feature with presentation/data/domain boundaries only where useful.
- API responses must use the shared success/error envelope. All user-facing copy is Thai; identifiers and database fields are English.
- External services (LINE, Facebook, Firebase, maps, storage, smart card and PDF export) must be behind interfaces. Development substitutes must fail closed in production.

## Coding standards
- Enable strict TypeScript and Dart analysis. Avoid `any`; validate untrusted input at every boundary.
- Do not embed URLs, credentials, passwords or secrets in source code.
- Preserve existing behavior unless removal is explicitly justified.
- Use accessible labels, keyboard focus, responsive layouts, loading/empty/error states and Thai validation messages.

## Naming
- TypeScript/Dart: PascalCase types and camelCase members.
- Database: PascalCase Prisma models and camelCase fields; enums use uppercase values.
- Files and routes: kebab-case.

## Git workflow
- Treat `develop` as the integration branch and `main` as the production branch.
- Before modifying or adding project files while on `develop`, infer a concise English kebab-case branch name from the requested task and create the branch automatically before making changes.
- Use `feature/` for new behavior, `fix/` for defects, `chore/` for configuration or maintenance, `docs/` for documentation-only work, `refactor/` for behavior-preserving restructuring, and `test/` for test-only work.
- When `develop` is clean, update it with `git pull --ff-only origin develop` before creating the task branch. If `develop` already has uncommitted user changes, create the task branch without pulling, stashing, discarding or rewriting those changes.
- Do not create a new branch for read-only inspection, explanations or status reports. If already on the appropriate task branch, continue using it.
- Never commit or push automatically. Leave all changes uncommitted for the user unless the user explicitly requests a commit or push.
- Never merge a task branch directly into `main`. Task branches must target `develop`; merge `develop` into `main` only when the user explicitly requests a production release.
- Never merge, rebase, force-push, delete a branch or discard working-tree changes without the user's explicit request.

## Testing
- Add unit tests for business rules and validation, integration tests for persistence/authorization, and at least one end-to-end happy path.
- Run formatting, lint, tests and builds before completing a phase. Never disable a failing test to make CI pass.

## Security
- Hash passwords and refresh tokens, rotate refresh tokens, enforce ownership/RBAC server-side, redact secrets and personal data from logs, and audit privileged changes.
- Validate upload MIME, extension, count and size; generate storage keys server-side.
- `DEV_AUTH_BYPASS` is allowed only when `APP_ENV=development` or `test` and must abort startup in production.

## Database
- MariaDB 10.6 is the supported database for `apps/api-php`; PDO prepared statements are the only PHP database client.
- Never reintroduce PostgreSQL, PostgreSQL-specific SQL, native UUID columns, arrays, JSONB, sequences, casts or operators.
- Store UUID values as `CHAR(36)`, use `utf8mb4`/`utf8mb4_unicode_ci`, and store timestamps in UTC.
- Development and test databases must remain separate. Automated tests, cleanup and reset operations must verify that they target the dedicated `_test` database.
- Never reset, truncate or otherwise destroy a production database.

## UI
- Follow `docs/ui-reference`: formal maroon/white palette, generous spacing, rounded cards, subtle shadows and Sarabun/Noto Sans Thai.
- Do not use screenshots as UI backgrounds or extract logos from them. Replace the explicit logo placeholder only with an approved original asset.
