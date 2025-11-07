"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
