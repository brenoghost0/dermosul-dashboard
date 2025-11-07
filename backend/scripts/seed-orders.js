"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const prisma = new client_1.PrismaClient();
// Funções utilitárias
const toCents = (value) => Math.round(value * 100);
const generateRandomCpf = () => {
    const num = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    let d1 = num.reduce((acc, digit, i) => acc + digit * (10 - i), 0) % 11;
    d1 = d1 < 2 ? 0 : 11 - d1;
    let d2 = (num.reduce((acc, digit, i) => acc + digit * (11 - i), 0) + d1 * 2) % 11;
    d2 = d2 < 2 ? 0 : 11 - d2;
    return `${num.join('')}${d1}${d2}`;
};
async function main() {
    console.log('Iniciando o processo de seeding de pedidos...');
    // 1. Buscar ou criar landing pages para associar aos pedidos
    let landingPages = await prisma.landingPage.findMany();
    if (landingPages.length === 0) {
        console.log('Nenhuma landing page encontrada. Criando uma de exemplo...');
        await prisma.landingPage.create({
            data: {
                slug: 'eucerin-anti-pigment-dual-serum-facial-uniformizador-30ml',
                title: 'Eucerin Anti-Pigment Dual Serum Facial Uniformizador 30ml',
                brand: 'Eucerin',
                description: 'Um sérum facial que combina dois ingredientes ativos poderosos que trabalham de maneiras diferentes para promover uma pele radiante e uniforme.',
                price: toCents(189.90),
                freeShipping: true,
                shippingPrice: 0,
                status: 'ATIVA',
                imageUrl: '/uploads/image-1756257069965-476937860.jpg',
            },
        });
        landingPages = await prisma.landingPage.findMany();
    }
    // 2. Criar 25 clientes e 25 pedidos
    for (let i = 0; i < 25; i++) {
        const customer = await prisma.customer.create({
            data: {
                firstName: pt_BR_1.faker.person.firstName(),
                lastName: pt_BR_1.faker.person.lastName(),
                email: pt_BR_1.faker.internet.email({ firstName: `test_${i}` }),
                phone: pt_BR_1.faker.phone.number(),
                cpf: generateRandomCpf(),
                birthDate: pt_BR_1.faker.date.birthdate().toISOString().split('T')[0],
                gender: pt_BR_1.faker.helpers.arrayElement(['FEMININO', 'MASCULINO']),
                addresses: {
                    create: {
                        cep: pt_BR_1.faker.location.zipCode(),
                        street: pt_BR_1.faker.location.street(),
                        number: pt_BR_1.faker.location.buildingNumber(),
                        district: pt_BR_1.faker.location.county(),
                        city: pt_BR_1.faker.location.city(),
                        state: pt_BR_1.faker.location.state({ abbreviated: true }),
                    },
                },
            },
        });
        const landingPage = pt_BR_1.faker.helpers.arrayElement(landingPages);
        const qty = pt_BR_1.faker.number.int({ min: 1, max: 3 });
        const totalAmount = landingPage.price * qty;
        // Garante que os 10 primeiros pedidos sejam dos últimos 14 dias
        const createdAt = i < 10 ? pt_BR_1.faker.date.recent({ days: 14 }) : pt_BR_1.faker.date.past({ years: 1 });
        await prisma.order.create({
            data: {
                id: pt_BR_1.faker.string.alphanumeric(8).toUpperCase(),
                customerId: customer.id,
                status: pt_BR_1.faker.helpers.arrayElement(['pago', 'pendente', 'enviado', 'cancelado']),
                category: pt_BR_1.faker.helpers.arrayElement(['Skincare', 'Maquiagem', 'Cabelo', 'Corpo']),
                totalAmount: totalAmount,
                createdAt: createdAt,
                items: {
                    create: {
                        sku: landingPage.slug,
                        name: landingPage.title,
                        qty: qty,
                        unitPrice: landingPage.price,
                    },
                },
                payments: {
                    create: {
                        paymentMethod: pt_BR_1.faker.helpers.arrayElement(['cartao', 'pix', 'boleto']),
                        paidAmount: totalAmount,
                        status: 'confirmado',
                    },
                },
            },
        });
    }
    console.log('Seeding de 25 pedidos concluído com sucesso!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
