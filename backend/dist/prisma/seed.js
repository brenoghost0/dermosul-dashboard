"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const prisma = new client_1.PrismaClient();
function generateFormattedCpf() {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const d1 = n.reduce((acc, val, i) => acc + val * (10 - i), 0) % 11;
    n.push(d1 < 2 ? 0 : 11 - d1);
    const d2 = n.reduce((acc, val, i) => acc + val * (11 - i), 0) % 11;
    n.push(d2 < 2 ? 0 : 11 - d2);
    return `${n.slice(0, 3).join('')}.${n.slice(3, 6).join('')}.${n.slice(6, 9).join('')}-${n.slice(9).join('')}`;
}
async function main() {
    console.log('Iniciando o script de seed...');
    // Limpar dados existentes para garantir um estado limpo
    await prisma.address.deleteMany({});
    await prisma.customer.deleteMany({});
    console.log('Dados antigos de clientes e endereços removidos.');
    // Criar 5 clientes de demonstração
    for (let i = 0; i < 5; i++) {
        const customer = await prisma.customer.create({
            data: {
                firstName: pt_BR_1.faker.person.firstName(),
                lastName: pt_BR_1.faker.person.lastName(),
                email: pt_BR_1.faker.internet.email(),
                phone: pt_BR_1.faker.phone.number(),
                cpf: generateFormattedCpf(),
                birthDate: pt_BR_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
                addresses: {
                    create: {
                        cep: pt_BR_1.faker.location.zipCode('#####-###'),
                        street: pt_BR_1.faker.location.street(),
                        number: pt_BR_1.faker.number.int({ min: 1, max: 2000 }).toString(),
                        district: pt_BR_1.faker.location.county(),
                        city: pt_BR_1.faker.location.city(),
                        state: pt_BR_1.faker.location.state({ abbreviated: true }),
                        complement: pt_BR_1.faker.location.secondaryAddress(),
                    },
                },
            },
        });
        console.log(`Cliente de demonstração criado: ${customer.firstName} ${customer.lastName}`);
    }
    console.log('Seed concluído com sucesso!');
}
main()
    .catch((e) => {
    console.error('Ocorreu um erro durante o seed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
