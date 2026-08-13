import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const key = 'mysqlUnicodePersistenceCheck';
const expected = {
  text: 'ทดสอบแจ้งเหตุในประเทศไทย 🚨',
  address: '99 ถนนวิภาวดีรังสิต เขตดอนเมือง กรุงเทพมหานคร',
  specialCharacters: 'ทดสอบ: []{} / \\ + = ? ! @ #',
};

function assertExpected(value: Prisma.JsonValue | null | undefined) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    throw new Error(
      'ข้อมูลภาษาไทยหรือ Emoji ที่อ่านกลับมาไม่ตรงกับค่าที่บันทึก',
    );
  }
}

async function writeAndVerify() {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: expected },
    create: { key, value: expected },
  });
  const stored = await prisma.systemSetting.findUnique({ where: { key } });
  assertExpected(stored?.value);
  console.log('บันทึกและอ่านภาษาไทย ที่อยู่ Emoji และอักขระพิเศษสำเร็จ');
}

async function readAndVerify() {
  const stored = await prisma.systemSetting.findUnique({ where: { key } });
  assertExpected(stored?.value);
  console.log('ข้อมูลทดสอบยังอยู่หลัง Restart MySQL');
}

async function cleanup() {
  await prisma.systemSetting.deleteMany({ where: { key } });
  console.log('ลบข้อมูลตรวจสอบชั่วคราวแล้ว');
}

async function main() {
  const action = process.argv[2] ?? 'all';
  if (!process.env.DATABASE_URL?.startsWith('mysql://')) {
    throw new Error('verify:mysql รองรับเฉพาะ MySQL');
  }

  if (action === 'write' || action === 'all') await writeAndVerify();
  if (action === 'read') await readAndVerify();
  if (action === 'cleanup' || action === 'all') await cleanup();
  if (!['write', 'read', 'cleanup', 'all'].includes(action)) {
    throw new Error('ใช้ action: write, read, cleanup หรือ all');
  }
}

void main().finally(() => prisma.$disconnect());
