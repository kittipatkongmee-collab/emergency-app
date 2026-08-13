#!/bin/sh
set -eu

case "${TEST_DATABASE_NAME:-}" in
  ''|*[!A-Za-z0-9_]*) echo "TEST_DATABASE_NAME must contain only letters, numbers, and underscores" >&2; exit 1 ;;
esac

case "${SHADOW_DATABASE_NAME:-}" in
  ''|*[!A-Za-z0-9_]*) echo "SHADOW_DATABASE_NAME must contain only letters, numbers, and underscores" >&2; exit 1 ;;
esac

case "${TEST_DATABASE_USER:-}" in
  ''|*[!A-Za-z0-9_]*) echo "TEST_DATABASE_USER must contain only letters, numbers, and underscores" >&2; exit 1 ;;
esac

case "${TEST_DATABASE_PASSWORD:-}" in
  ''|*[!A-Za-z0-9_]*) echo "TEST_DATABASE_PASSWORD must be URL-safe and contain only letters, numbers, and underscores" >&2; exit 1 ;;
esac

mysql --protocol=socket --user=root --password="${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE DATABASE IF NOT EXISTS ${TEST_DATABASE_NAME}
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ${SHADOW_DATABASE_NAME}
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${TEST_DATABASE_USER}'@'%' IDENTIFIED BY '${TEST_DATABASE_PASSWORD}';
ALTER USER '${TEST_DATABASE_USER}'@'%' IDENTIFIED BY '${TEST_DATABASE_PASSWORD}';
GRANT ALL PRIVILEGES ON ${TEST_DATABASE_NAME}.* TO '${TEST_DATABASE_USER}'@'%';
GRANT ALL PRIVILEGES ON ${SHADOW_DATABASE_NAME}.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
EOSQL
