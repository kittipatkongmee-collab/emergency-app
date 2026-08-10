# Police Incident API for PHP 5.6

This application is the DirectAdmin-compatible replacement API maintained in
parallel with `apps/api` until contract parity is accepted. It uses FastRoute,
PDO, MariaDB, Firebase RTDB triggers and FCM without exposing service account
credentials under `public_html`.

## Local verification

```powershell
composer install --working-dir=apps/api-php
pnpm php:test
docker compose -f docker-compose.php.yml up -d --build
docker compose -f docker-compose.php.yml exec api-php php tests/integration.php
Invoke-RestMethod http://localhost:8085/api/v1/ready
docker compose -f docker-compose.php.yml down -v
```

The integration database name must end in `_test`; destructive test helpers
abort for every other database name.

## Commands

- `php bin/seed.php`: create the first administrator. The password is read only
  from `ADMIN_SEED_PASSWORD`.
- `php bin/cron.php`: deliver pending RTDB events and clean expired buckets.
- `php bin/check-requirements.php`: verify PHP extensions, MariaDB and UTC.
- `pnpm build:directadmin`: build the Angular app and deployment ZIP.

PHP 5.6 is end-of-life. This code therefore fails closed in production, pins
dependencies and expects HTTPS, WAF/ModSecurity, hidden errors and strict file
permissions, but those controls do not restore upstream security support.
