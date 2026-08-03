import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const examplePath = resolve(root, '.env.example');
const envPath = resolve(root, '.env');

function parse(content) {
  const values = new Map();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function secret(bytes = 24) {
  return randomBytes(bytes).toString('hex');
}

function existingDevelopmentSecret(values, key) {
  const value = values.get(key) ?? '';
  return /^[A-Za-z0-9_]{24,}$/.test(value) ? value : secret();
}

const template = readFileSync(examplePath, 'utf8');
const current = existsSync(envPath)
  ? parse(readFileSync(envPath, 'utf8'))
  : new Map();

const databaseName = 'police_incident_system';
const databaseUser = 'police_app';
const databasePassword = existingDevelopmentSecret(
  current,
  'DATABASE_PASSWORD',
);
const databaseRootPassword = existingDevelopmentSecret(
  current,
  'DATABASE_ROOT_PASSWORD',
);
const shadowDatabaseName = 'police_incident_shadow';
const testDatabaseName = 'police_incident_test';
const testDatabaseUser = 'police_test';
const testDatabasePassword = existingDevelopmentSecret(
  current,
  'TEST_DATABASE_PASSWORD',
);

const replacements = new Map(current);
replacements.set('DATABASE_NAME', databaseName);
replacements.set('DATABASE_USER', databaseUser);
replacements.set('DATABASE_PASSWORD', databasePassword);
replacements.set('DATABASE_ROOT_PASSWORD', databaseRootPassword);
replacements.set('DATABASE_PORT', '3306');
replacements.set('SHADOW_DATABASE_NAME', shadowDatabaseName);
replacements.set('TEST_DATABASE_NAME', testDatabaseName);
replacements.set('TEST_DATABASE_USER', testDatabaseUser);
replacements.set('TEST_DATABASE_PASSWORD', testDatabasePassword);
replacements.set(
  'DATABASE_URL',
  `mysql://${databaseUser}:${databasePassword}@localhost:3306/${databaseName}`,
);
replacements.set(
  'SHADOW_DATABASE_URL',
  `mysql://${databaseUser}:${databasePassword}@localhost:3306/${shadowDatabaseName}`,
);
replacements.set(
  'TEST_DATABASE_URL',
  `mysql://${testDatabaseUser}:${testDatabasePassword}@localhost:3306/${testDatabaseName}`,
);
replacements.set('DEV_AUTH_BYPASS', 'true');
replacements.set('FACEBOOK_LOGIN_ENABLED', 'false');
replacements.set('FCM_ENABLED', 'false');
replacements.set('MAP_PROVIDER', replacements.get('MAP_PROVIDER') || 'development');

for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  const value = replacements.get(key) ?? '';
  if (value.length < 32 || value.startsWith('replace-with-')) {
    replacements.set(key, secret(32));
  }
}

const adminPassword = replacements.get('ADMIN_SEED_PASSWORD') ?? '';
if (adminPassword.length < 12) {
  replacements.set('ADMIN_SEED_PASSWORD', `Admin_${secret(12)}`);
}

const renderedKeys = new Set();
const rendered = template
  .split(/\r?\n/)
  .map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) return line;
    renderedKeys.add(match[1]);
    return `${match[1]}=${replacements.get(match[1]) ?? ''}`;
  });

for (const [key, value] of replacements) {
  if (!renderedKeys.has(key)) rendered.push(`${key}=${value}`);
}

writeFileSync(envPath, `${rendered.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
console.log('สร้าง .env สำหรับ MySQL development แล้ว (ซ่อนค่ารหัสผ่าน)');
