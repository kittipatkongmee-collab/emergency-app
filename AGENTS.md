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
- `DEV_AUTH_BYPASS` is allowed only when `NODE_ENV=development` and must abort startup otherwise.

## UI
- Follow `docs/ui-reference`: formal maroon/white palette, generous spacing, rounded cards, subtle shadows and Sarabun/Noto Sans Thai.
- Do not use screenshots as UI backgrounds or extract logos from them. Replace the explicit logo placeholder only with an approved original asset.
