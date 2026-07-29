import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS connected`;
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
