import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "public" CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA "public"');
}

main()
  .catch((error) => {
    console.error('[reset-db] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
