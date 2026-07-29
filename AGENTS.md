# Police Incident System – Engineering Rules

## Architecture
- Keep the mandated stack: Flutter, Angular standalone components, NestJS, Prisma, PostgreSQL, Socket.IO and pnpm workspaces.
- Organize backend features as NestJS modules, Angular by feature, and Flutter by feature with presentation/data/domain boundaries only where useful.
- API responses must use the shared success/error envelope. All user-facing copy is Thai; identifiers and database fields are English.
- External services (Facebook, FCM, maps, storage, smart card and PDF export) must be behind interfaces. Development substitutes must fail closed in production.

## Coding standards
- Enable strict TypeScript and Dart analysis. Avoid `any`; validate untrusted input at every boundary.
- Do not embed URLs, credentials, passwords or secrets in source code.
- Preserve existing behavior unless removal is explicitly justified.
- Use accessible labels, keyboard focus, responsive layouts, loading/empty/error states and Thai validation messages.

## Naming
- TypeScript/Dart: PascalCase types and camelCase members.
- Database: PascalCase Prisma models and camelCase fields; enums use uppercase values.
- Files and routes: kebab-case.

## Testing
- Add unit tests for business rules and validation, integration tests for persistence/authorization, and at least one end-to-end happy path.
- Run formatting, lint, tests and builds before completing a phase. Never disable a failing test to make CI pass.

## Security
- Hash passwords and refresh tokens, rotate refresh tokens, enforce ownership/RBAC server-side, redact secrets and personal data from logs, and audit privileged changes.
- Validate upload MIME, extension, count and size; generate storage keys server-side.
- `DEV_AUTH_BYPASS` is allowed only when `NODE_ENV=development` and must abort startup otherwise.

## UI
- Follow `docs/ui-reference`: formal maroon/white palette, generous spacing, rounded cards, subtle shadows and Sarabun/Noto Sans Thai.
- Do not use screenshots as UI backgrounds or extract logos from them. Replace the explicit logo placeholder only with an approved original asset.
