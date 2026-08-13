import { PrismaClient, TokenOwnerType } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { isAbsolute, normalize, resolve } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  const databaseName = databaseUrl.pathname.replace(/^\//, '');
  if (
    process.env.NODE_ENV !== 'development' ||
    databaseUrl.protocol !== 'mysql:' ||
    databaseName !== 'police_incident_system' ||
    process.env.CONFIRM_CLEAR_DEVELOPMENT_DATA !== 'true'
  ) {
    throw new Error(
      'คำสั่งนี้ใช้ได้เฉพาะฐาน MySQL development และต้องยืนยันก่อน',
    );
  }

  const images = await prisma.incidentImage.findMany({
    select: { storageKey: true },
  });
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.deviceToken.deleteMany(),
    prisma.refreshToken.deleteMany({
      where: { ownerType: TokenOwnerType.CITIZEN },
    }),
    prisma.incident.deleteMany(),
    prisma.externalIdentity.deleteMany(),
    prisma.citizenUser.deleteMany(),
    prisma.caseCounter.deleteMany(),
  ]);

  if (process.env.STORAGE_DRIVER !== 's3') {
    const root = resolve(process.env.STORAGE_LOCAL_PATH ?? 'uploads');
    for (const image of images) {
      const target = resolve(root, normalize(image.storageKey));
      if (
        !isAbsolute(image.storageKey) &&
        target.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)
      ) {
        await unlink(target).catch(() => undefined);
      }
    }
  }

  console.log(
    `ล้างข้อมูลประชาชนและเหตุการณ์ใน development แล้ว (${images.length} รูป)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Clear failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
