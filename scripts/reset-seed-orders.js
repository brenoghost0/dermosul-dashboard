"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const prisma = new client_1.PrismaClient();
const toCents = (value) => Math.round(value * 100);
const id8 = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
// CPF válido (com dígitos verificadores) e formatado XXX.XXX.XXX-XX
const generateValidCpf = (formatted = true) => {
    const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    let d1 = n.reduce((acc, digit, i) => acc + digit * (10 - i), 0) % 11;
    d1 = d1 < 2 ? 0 : 11 - d1;
    let d2 = (n.reduce((acc, digit, i) => acc + digit * (11 - i), 0) + d1 * 2) % 11;
    d2 = d2 < 2 ? 0 : 11 - d2;
    const digits = [...n, d1, d2].join('');
    if (!formatted)
        return digits;
    return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}`;
};
// Celular BR válido: DDD (2) + 9 + 8 dígitos (total 11). Formato: (11) 9XXXX-XXXX
const generateBrMobile = (formatted = true) => {
    const ddd = '11'; // Fixar DDD 11 conforme solicitado
    const rest8 = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
    const digits = `${ddd}9${rest8}`; // 11 dígitos
    if (!formatted)
        return digits;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}${digits.slice(3, 7)}-${digits.slice(7)}`;
};
// Amostra de CEPs reais (centrais) para autofill funcionar melhor
// Fonte: CEPs de referência de capitais e regiões centrais
const REAL_CEPS = [
    { cep: '01001-000', city: 'São Paulo', state: 'SP' },
    { cep: '20010-000', city: 'Rio de Janeiro', state: 'RJ' },
    { cep: '30110-012', city: 'Belo Horizonte', state: 'MG' },
    { cep: '40020-000', city: 'Salvador', state: 'BA' },
    { cep: '60025-001', city: 'Fortaleza', state: 'CE' },
    { cep: '70040-010', city: 'Brasília', state: 'DF' },
    { cep: '80010-000', city: 'Curitiba', state: 'PR' },
    { cep: '88010-400', city: 'Florianópolis', state: 'SC' },
    { cep: '69005-010', city: 'Manaus', state: 'AM' },
    { cep: '66010-000', city: 'Belém', state: 'PA' },
];
const pickRealCep = () => REAL_CEPS[Math.floor(Math.random() * REAL_CEPS.length)];
async function run() {
    console.log('→ Limpando pedidos, itens, pagamentos, endereços e clientes...');
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.address.deleteMany();
    await prisma.customer.deleteMany();
    console.log('✔ Base limpa');
    // Garante pelo menos 2 landing pages para variety
    const existingLP = await prisma.landingPage.findMany();
    let landingPages = existingLP;
    if (landingPages.length === 0) {
        console.log('→ Criando landing pages de exemplo...');
        await prisma.landingPage.createMany({
            data: [
                {
                    slug: 'produto-essencial-1',
                    title: 'Creme Hidratante Facial Profundo',
                    brand: 'DermoSkin',
                    description: 'Hidratação intensa por 24h com ácido hialurônico.',
                    price: toCents(189.9),
                    freeShipping: true,
                    shippingPrice: 0,
                },
                {
                    slug: 'serum-rejuvenescedor-2',
                    title: 'Sérum Rejuvenescedor Noite',
                    brand: 'GlowUp',
                    description: 'Combate sinais de envelhecimento enquanto você dorme.',
                    price: toCents(299.9),
                    freeShipping: false,
                    shippingPrice: toCents(15),
                },
            ],
        });
        landingPages = await prisma.landingPage.findMany();
    }
    console.log('→ Criando 50 pedidos com IDs numéricos (8 dígitos)...');
    for (let i = 0; i < 50; i++) {
        const lp = pt_BR_1.faker.helpers.arrayElement(landingPages);
        const qty = pt_BR_1.faker.number.int({ min: 1, max: 3 });
        const itemPrice = lp.price; // em centavos
        const totalAmount = itemPrice * qty + (lp.freeShipping ? 0 : lp.shippingPrice);
        const createdAt = pt_BR_1.faker.date.recent({ days: 60 });
        const realCep = pickRealCep();
        const customer = await prisma.customer.create({
            data: {
                firstName: pt_BR_1.faker.person.firstName(),
                lastName: pt_BR_1.faker.person.lastName(),
                email: pt_BR_1.faker.internet.email(),
                phone: generateBrMobile(true),
                cpf: generateValidCpf(true),
                birthDate: pt_BR_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
                gender: pt_BR_1.faker.helpers.arrayElement(['FEMININO', 'MASCULINO']),
                addresses: {
                    create: {
                        cep: realCep.cep,
                        street: pt_BR_1.faker.location.street(),
                        number: pt_BR_1.faker.location.buildingNumber(),
                        complement: pt_BR_1.faker.location.secondaryAddress(),
                        district: pt_BR_1.faker.location.county(),
                        city: realCep.city,
                        state: realCep.state,
                    },
                },
            },
        });
        const status = pt_BR_1.faker.helpers.arrayElement(['pago', 'pendente', 'enviado', 'cancelado']);
        const paymentMethod = pt_BR_1.faker.helpers.arrayElement(['cartao', 'pix', 'boleto']);
        await prisma.order.create({
            data: {
                id: id8(),
                customerId: customer.id,
                status,
                category: pt_BR_1.faker.helpers.arrayElement(['Skincare', 'Maquiagem', 'Cabelo', 'Corpo']),
                totalAmount,
                createdAt,
                items: {
                    create: [
                        { sku: lp.slug, name: lp.title, qty, unitPrice: itemPrice },
                    ],
                },
                payments: {
                    create: [
                        { paymentMethod, paidAmount: totalAmount, status: status === 'pago' || status === 'enviado' ? 'confirmado' : 'pendente' },
                    ],
                },
            },
        });
    }
    console.log('✔ Seed concluído com 50 pedidos.');
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
