import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Deleta todos os usuários existentes para garantir um estado limpo
  await prisma.user.deleteMany({});
  
  const passwordHash = await bcrypt.hash('123', 10);
  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
