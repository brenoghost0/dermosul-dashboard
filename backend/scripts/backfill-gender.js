"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../../node_modules/.prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const customers = await prisma.customer.findMany({
        where: {
            gender: null,
        },
    });
    console.log(`Found ${customers.length} customers without gender. Updating...`);
    for (const customer of customers) {
        const randomGender = Math.random() < 0.5 ? 'Feminino' : 'Masculino';
        await prisma.customer.update({
            where: {
                id: customer.id,
            },
            data: {
                gender: randomGender,
            },
        });
        console.log(`Updated customer ${customer.id} with gender: ${randomGender}`);
    }
    console.log('Backfill complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
