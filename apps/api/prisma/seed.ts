import {
  PrismaClient,
  AdminRole,
  IncidentStatus,
  IncidentType,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const types = Object.values(IncidentType);
const statuses = Object.values(IncidentStatus);
const places = [
  ['กรุงเทพมหานคร', 'เขตดอนเมือง', 'ถนนวิภาวดีรังสิต', 13.9126, 100.6068],
  ['เชียงใหม่', 'อำเภอเมืองเชียงใหม่', 'ถนนมหิดล', 18.7669, 98.9625],
  ['ภูเก็ต', 'อำเภอเมืองภูเก็ต', 'ถนนเจ้าฟ้า', 7.8804, 98.3923],
] as const;

async function main() {
  const username = process.env.ADMIN_SEED_USERNAME ?? 'admin';
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('ADMIN_SEED_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร');
  const passwordHash = await argon2.hash(password);
  const superAdmin = await prisma.adminUser.upsert({
    where: { username },
    update: {
      fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'ผู้ดูแลระบบ',
      role: AdminRole.SUPER_ADMIN,
      passwordHash,
      status: 'ACTIVE',
    },
    create: {
      username,
      fullName: process.env.ADMIN_SEED_FULL_NAME ?? 'ผู้ดูแลระบบ',
      role: AdminRole.SUPER_ADMIN,
      passwordHash,
    },
  });
  const officers = [];
  for (let i = 1; i <= 3; i++) {
    officers.push(
      await prisma.adminUser.upsert({
        where: { username: `officer${i}` },
        update: { passwordHash, status: 'ACTIVE' },
        create: {
          username: `officer${i}`,
          fullName: `เจ้าหน้าที่ตัวอย่าง ${i}`,
          role: AdminRole.OFFICER,
          passwordHash,
        },
      }),
    );
  }
  const citizen = await prisma.citizenUser.upsert({
    where: { facebookId: 'seed-citizen' },
    update: {},
    create: {
      facebookId: 'seed-citizen',
      fullName: 'ประชาชนตัวอย่าง',
      phone: '0812345678',
    },
  });
  for (let i = 1; i <= 15; i++) {
    const place = places[(i - 1) % places.length];
    const status = statuses[(i - 1) % statuses.length];
    const incident = await prisma.incident.upsert({
      where: { caseCode: `CASE-2026-${String(i).padStart(5, '0')}` },
      update: {},
      create: {
        caseCode: `CASE-2026-${String(i).padStart(5, '0')}`,
        citizenUserId: citizen.id,
        reporterName: citizen.fullName,
        reporterPhone: citizen.phone!,
        type: types[(i - 1) % types.length],
        description: `เหตุการณ์ตัวอย่างสำหรับทดสอบลำดับที่ ${i}`,
        latitude: place[3],
        longitude: place[4],
        address: `${place[2]} ${place[1]} ${place[0]}`,
        district: place[1],
        province: place[0],
        status,
        assignedAdminUserId: officers[(i - 1) % officers.length].id,
        statusHistory: {
          create: [
            { toStatus: 'RECEIVED', note: 'รับแจ้งเหตุแล้ว' },
            ...(status !== 'RECEIVED'
              ? [
                  {
                    fromStatus: 'RECEIVED' as const,
                    toStatus: status,
                    note: 'อัปเดตจากข้อมูล Seed',
                    changedByAdminUserId: superAdmin.id,
                  },
                ]
              : []),
          ],
        },
      },
    });
    await prisma.notification.upsert({
      where: { id: incident.id },
      update: {},
      create: {
        id: incident.id,
        citizenUserId: citizen.id,
        incidentId: incident.id,
        title: 'สถานะเหตุการณ์',
        message: `${incident.caseCode}: ${status}`,
        type: 'STATUS_CHANGED',
      },
    });
  }
  await prisma.systemSetting.upsert({
    where: { key: 'emergencyContact' },
    update: {},
    create: {
      key: 'emergencyContact',
      value: { phone: '025091520', hours: '24 ชั่วโมง' },
      updatedByAdminUserId: superAdmin.id,
    },
  });
}

main().finally(() => prisma.$disconnect());
