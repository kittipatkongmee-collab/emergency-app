import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const password = process.env.DEVELOPMENT_ADMIN_PASSWORD ?? '';
if (password.length < 12) {
  throw new Error(
    'DEVELOPMENT_ADMIN_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร',
  );
}

const content = readFileSync(envPath, 'utf8');
if (
  !/^NODE_ENV=development$/m.test(content) ||
  !/^DATABASE_NAME=police_incident_system$/m.test(content)
) {
  throw new Error('คำสั่งนี้ใช้ได้เฉพาะ environment สำหรับ development');
}

const next = content.match(/^ADMIN_SEED_PASSWORD=/m)
  ? content.replace(
      /^ADMIN_SEED_PASSWORD=.*$/m,
      `ADMIN_SEED_PASSWORD=${password}`,
    )
  : `${content.trimEnd()}\nADMIN_SEED_PASSWORD=${password}\n`;

writeFileSync(envPath, next, 'utf8');
console.log('อัปเดตรหัสผ่านผู้ดูแลระบบใน .env development แล้ว');
