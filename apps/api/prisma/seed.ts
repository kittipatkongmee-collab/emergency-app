import { AdminRole, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedAdmins(passwordHash: string) {
  const definitions = [
    {
      username: process.env.ADMIN_SEED_USERNAME ?? 'admin',
      fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'ผู้ดูแลระบบ',
      role: AdminRole.SUPER_ADMIN,
    },
    {
      username: 'supervisor1',
      fullName: 'หัวหน้าศูนย์ปฏิบัติการ',
      role: AdminRole.SUPERVISOR,
    },
    ...Array.from({ length: 3 }, (_, index) => ({
      username: `officer${index + 1}`,
      fullName: `เจ้าหน้าที่ปฏิบัติการ ${index + 1}`,
      role: AdminRole.OFFICER,
    })),
    {
      username: 'viewer1',
      fullName: 'เจ้าหน้าที่ตรวจสอบข้อมูล',
      role: AdminRole.VIEWER,
    },
  ];

  for (const definition of definitions) {
    await prisma.adminUser.upsert({
      where: { username: definition.username },
      update: {
        fullName: definition.fullName,
        role: definition.role,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        ...definition,
        passwordHash,
        status: 'ACTIVE',
      },
    });
  }
}

async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('ADMIN_SEED_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร');
  }

  await seedAdmins(await argon2.hash(password));

  const superAdmin = await prisma.adminUser.findUniqueOrThrow({
    where: { username: process.env.ADMIN_SEED_USERNAME ?? 'admin' },
  });
  await prisma.systemSetting.upsert({
    where: { key: 'emergencyContact' },
    update: {
      value: {
        phone: '025091520',
        hours: '24 ชั่วโมง',
        announcement: '',
      },
      updatedByAdminUserId: superAdmin.id,
    },
    create: {
      key: 'emergencyContact',
      value: {
        phone: '025091520',
        hours: '24 ชั่วโมง',
        announcement: '',
      },
      updatedByAdminUserId: superAdmin.id,
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
