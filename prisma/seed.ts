import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Garante que não haja operadores duplicados
  await prisma.operator.deleteMany({ where: { username: 'admin' } });

  const passwordHash = await bcrypt.hash('123', 10);
  await prisma.operator.create({
    data: {
      username: 'admin',
      passwordHash,
      name: 'Administrador',
      email: 'admin@dermosul.com.br',
      canManageAll: true,
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
