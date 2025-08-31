import { prisma } from '../src/db/prisma';
import { faker } from '@faker-js/faker/locale/pt_BR';

async function main() {
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { birthDate: '' },
        { birthDate: '1900-01-01' },
      ],
    },
  });

  for (const customer of customers) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
      },
    });
  }

  console.log(`Updated ${customers.length} customers with a birth date.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
