"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/db/prisma");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
async function main() {
    const customers = await prisma_1.prisma.customer.findMany({
        where: {
            OR: [
                { birthDate: '' },
                { birthDate: '1900-01-01' },
            ],
        },
    });
    for (const customer of customers) {
        await prisma_1.prisma.customer.update({
            where: { id: customer.id },
            data: {
                birthDate: pt_BR_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
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
    await prisma_1.prisma.$disconnect();
});
