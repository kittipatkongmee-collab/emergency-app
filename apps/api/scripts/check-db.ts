import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const connection = await prisma.$queryRaw<
      Array<{
        databaseName: string;
        characterSet: string;
        collationName: string;
        timezoneName: string;
      }>
    >`SELECT DATABASE() AS databaseName,
             @@character_set_database AS characterSet,
             @@collation_database AS collationName,
             @@session.time_zone AS timezoneName`;
    const tableCounts = {
      citizens: await prisma.citizenUser.count(),
      admins: await prisma.adminUser.count(),
      incidents: await prisma.incident.count(),
    };
    const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `;
    console.log({
      connection: connection[0],
      tableCounts,
      tables: tables.map(({ tableName }) => tableName),
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main();
