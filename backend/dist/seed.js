"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Iniciando o script de seed...');
    // Limpar dados existentes para garantir um estado limpo
    console.log('Limpando banco de dados...');
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.landingPage.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.customer.deleteMany({});
    console.log('Banco de dados limpo.');
    // Criar 2 Landing Pages
    console.log('Criando landing pages...');
    await prisma.landingPage.create({
        data: {
            slug: 'produto-exemplo-1',
            title: 'Produto Exemplo 1',
            brand: 'Marca Famosa',
            description: 'Esta é uma descrição incrível para o produto exemplo 1.',
            price: 19990, // R$ 199,90
            freeShipping: true,
            shippingPrice: 0,
            imageUrl: '/uploads/image-1756175127270-163477494.jpeg',
        },
    });
    await prisma.landingPage.create({
        data: {
            slug: 'produto-exemplo-2',
            title: 'Produto Exemplo 2',
            brand: 'Outra Marca',
            description: 'Descrição fantástica para o produto exemplo 2.',
            price: 9990, // R$ 99,90
            freeShipping: false,
            shippingPrice: 1500, // R$ 15,00
            imageUrl: '/uploads/image-1756179009162-130769266.jpeg',
        },
    });
    console.log('Landing pages criadas.');
    // Criar 5 Clientes com Pedidos e Pagamentos
    console.log('Criando clientes e pedidos...');
    for (let i = 0; i < 5; i++) {
        const customer = await prisma.customer.create({
            data: {
                firstName: pt_BR_1.faker.person.firstName(),
                lastName: pt_BR_1.faker.person.lastName(),
                email: pt_BR_1.faker.internet.email(),
                phone: pt_BR_1.faker.phone.number(),
                cpf: `${pt_BR_1.faker.number.int({ min: 100, max: 999 })}.${pt_BR_1.faker.number.int({ min: 100, max: 999 })}.${pt_BR_1.faker.number.int({ min: 100, max: 999 })}-${pt_BR_1.faker.number.int({ min: 10, max: 99 })}`,
                birthDate: pt_BR_1.faker.date.birthdate().toISOString().split('T')[0],
            },
        });
        const order = await prisma.order.create({
            data: {
                customerId: customer.id,
                status: pt_BR_1.faker.helpers.arrayElement(['pago', 'pendente', 'enviado', 'cancelado']),
                category: pt_BR_1.faker.commerce.department(),
                totalAmount: pt_BR_1.faker.number.int({ min: 5000, max: 30000 }), // Entre R$ 50 e R$ 300
                payments: {
                    create: {
                        paymentMethod: pt_BR_1.faker.helpers.arrayElement(['pix', 'cartao', 'boleto']),
                        paidAmount: pt_BR_1.faker.number.int({ min: 5000, max: 30000 }),
                        status: 'confirmado',
                    },
                },
                items: {
                    create: {
                        sku: pt_BR_1.faker.string.alphanumeric(10),
                        name: pt_BR_1.faker.commerce.productName(),
                        qty: pt_BR_1.faker.number.int({ min: 1, max: 3 }),
                        unitPrice: pt_BR_1.faker.number.int({ min: 1000, max: 10000 }),
                    },
                },
            },
        });
        console.log(`Cliente ${customer.firstName} e pedido ${order.id} criados.`);
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
