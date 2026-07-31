# Delivery plan

## Phase 0 — Analysis and design
- [x] Inspect repository and all seven UI references
- [x] Record assumptions and architecture
- [x] Define database and API contracts
- [x] Create engineering rules and identify required credentials

## Phase 1 — Monorepo and infrastructure
- [x] Create pnpm workspace and root commands
- [x] Add Docker Compose for MySQL 8, API, Admin Web and Nginx
- [x] Add environment template and Windows PowerShell scripts
- [x] Add CI workflow and production Docker definitions

## Phase 2 — Backend
- [x] Create Prisma schema, migration and seed
- [x] Add configuration validation, response envelope, request IDs and error handling
- [x] Add admin/citizen authentication and RBAC
- [x] Add incidents, status history, assignment, notes and uploads
- [x] Add dashboard, notifications, users, settings, audit and health endpoints
- [x] Add Socket.IO authorization and domain events
- [x] Add Swagger and backend tests

## Phase 3 — Admin website
- [x] Create standalone Angular application and design tokens
- [x] Add login, route guard, interceptor and session handling
- [x] Add responsive shell, dashboard, incidents and incident detail
- [x] Add map, users, notifications, audit, settings and profile routes
- [x] Add loading, empty, error and not-found states
- [x] Add Angular tests

## Phase 4 — Flutter application
- [x] Create flavors/configuration and shared design system
- [x] Add secure login architecture and development auth adapter
- [x] Add home, report form, image picker and location flow
- [x] Add review, submit success, history and tracking timeline
- [x] Add notifications, profile, privacy and permission screens
- [x] Add Flutter tests

## Phase 5 — Integration
- [x] Connect Angular and Flutter repositories to API envelopes
- [x] Connect upload and location persistence
- [x] Connect authenticated realtime events
- [x] Add end-to-end happy-path coverage

## Phase 6 — Quality and handoff
- [x] Run formatting and lint/analyze
- [x] Run unit/integration tests
- [x] Build API, Admin Web and Flutter
- [x] Review secrets, authorization and production settings
- [x] Complete setup and deployment documentation

## Phase 7 — MySQL conversion
- [x] Replace the PostgreSQL Prisma provider and native types with MySQL-compatible definitions
- [x] Replace the PostgreSQL Docker service and environment variables with MySQL 8
- [x] Separate development and test databases with reset safeguards
- [x] Replace the PostgreSQL migration history with a fresh MySQL initial migration
- [x] Add Unicode, persistence and MySQL connection verification
- [x] Update scripts, engineering rules and database documentation
