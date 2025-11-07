"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/db/prisma");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../src/utils");
const faker_1 = require("@faker-js/faker");
// Carregar variáveis de ambiente para garantir que DATABASE_URL seja lida
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const DB_PATH = path.resolve(__dirname, 'db.json');
// Converte valores monetários para centavos (inteiros)
const toCents = (value) => Math.round(value * 100);
// Mapeia o método de pagamento do formato JSON para o enum do Prisma
const mapPaymentMethodToPrisma = (method) => {
    switch (method.toLowerCase()) {
        case 'cartao':
        case 'cartão de crédito':
            return 'cartao';
        case 'pix':
            return 'pix';
        case 'boleto':
            return 'boleto';
        default:
            return 'desconhecido';
    }
};
async function migrate() {
    console.log('Iniciando migração de db.json para SQLite...');
    let dbJson;
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        dbJson = JSON.parse(raw);
    }
    catch (error) {
        console.error(`Erro ao ler db.json: ${error.message}`);
        return;
    }
    let migratedCustomers = 0;
    let migratedOrders = 0;
    let migratedLandingPages = 0;
    // Limpar o banco de dados SQLite antes da migração (opcional, mas útil para testes)
    await prisma_1.prisma.payment.deleteMany();
    await prisma_1.prisma.orderItem.deleteMany();
    await prisma_1.prisma.order.deleteMany();
    await prisma_1.prisma.address.deleteMany();
    await prisma_1.prisma.customer.deleteMany();
    await prisma_1.prisma.landingPage.deleteMany();
    console.log('Banco de dados SQLite limpo.');
    // Migrar Landing Pages
    for (const lp of dbJson.landingPages) {
        try {
            await prisma_1.prisma.landingPage.create({
                data: {
                    id: lp.id,
                    slug: lp.slug || (0, utils_1.generateSlug)(lp.productTitle),
                    title: lp.productTitle,
                    brand: lp.productBrand,
                    description: lp.productDescription || '',
                    price: toCents(lp.productPrice),
                    freeShipping: lp.freeShipping,
                    imageUrl: lp.productImage,
                    shippingPrice: toCents(lp.shippingValue),
                    createdAt: new Date(lp.createdAt),
                    updatedAt: lp.updatedAt ? new Date(lp.updatedAt) : undefined,
                },
            });
            migratedLandingPages++;
        }
        catch (error) {
            if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
                console.warn(`Landing Page com slug '${lp.slug}' já existe, ignorando.`);
            }
            else if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
                console.warn(`Landing Page com ID '${lp.id}' já existe, ignorando.`);
            }
            else {
                console.error(`Erro ao migrar landing page ${lp.id}: ${error.message}`);
            }
        }
    }
    // Migrar Pedidos
    for (const order of dbJson.orders) {
        try {
            // 1. Criar ou conectar Customer
            let customer = await prisma_1.prisma.customer.findUnique({
                where: { email: order.customer.email },
            });
            if (!customer) {
                customer = await prisma_1.prisma.customer.create({
                    data: {
                        id: order.customer.id, // Usar ID existente se houver
                        firstName: order.customer.firstName || '',
                        lastName: order.customer.lastName || '',
                        email: order.customer.email,
                        phone: order.customer.phone || '',
                        cpf: order.customer.cpf || '',
                        birthDate: faker_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
                        createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
                    },
                });
                migratedCustomers++;
            }
            // 2. Criar ou conectar Address
            if (order.shipping && customer) {
                let address = await prisma_1.prisma.address.findFirst({
                    where: {
                        customerId: customer.id,
                        cep: order.shipping.postalCode,
                        street: order.shipping.address1,
                        number: order.shipping.address2,
                    },
                });
                if (!address) {
                    await prisma_1.prisma.address.create({
                        data: {
                            customerId: customer.id,
                            cep: order.shipping.postalCode || faker_1.faker.location.zipCode(),
                            street: order.shipping.address1 || faker_1.faker.location.street(),
                            number: order.shipping.address2 || faker_1.faker.location.buildingNumber(),
                            complement: order.shipping.address2_complement || faker_1.faker.location.secondaryAddress(),
                            district: order.shipping.district || faker_1.faker.location.county(),
                            city: order.shipping.city || faker_1.faker.location.city(),
                            state: order.shipping.state || faker_1.faker.location.state({ abbreviated: true }),
                            createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
                        },
                    });
                }
            }
            // 3. Criar Order
            const newOrder = await prisma_1.prisma.order.create({
                data: {
                    id: (0, utils_1.generateUniqueId)(), // Gerar novo ID aleatório
                    customerId: customer.id,
                    status: order.status.toLowerCase(),
                    category: order.category || 'Outros',
                    totalAmount: toCents(order.total_value),
                    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
                    items: {
                        create: order.items.map(item => ({
                            sku: item.sku || '',
                            name: item.name || 'Produto',
                            qty: item.qty || 0,
                            unitPrice: toCents(item.price || 0),
                        })),
                    },
                    payments: {
                        create: order.payments.map(payment => {
                            let paymentStatus = payment.status || 'pendente';
                            if (order.status === 'pago') {
                                paymentStatus = 'confirmado';
                            }
                            else if (order.status === 'cancelado') {
                                paymentStatus = 'cancelado';
                            }
                            return {
                                paymentMethod: mapPaymentMethodToPrisma(payment.method),
                                paidAmount: toCents(payment.value || 0),
                                status: paymentStatus,
                                createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
                            };
                        }),
                    },
                },
            });
            migratedOrders++;
        }
        catch (error) {
            if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
                console.warn(`Pedido com ID '${order.id}' já existe, ignorando.`);
            }
            else if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
                console.warn(`Cliente com email '${order.customer.email}' já existe, ignorando criação duplicada.`);
            }
            else {
                console.error(`Erro ao migrar pedido ${order.id}: ${error.message}`);
            }
        }
    }
    console.log('\n--- Relatório de Migração ---');
    console.log(`Clientes migrados (ou conectados): ${migratedCustomers}`);
    console.log(`Pedidos migrados: ${migratedOrders}`);
    console.log(`Landing Pages migradas: ${migratedLandingPages}`);
    await prisma_1.prisma.$disconnect();
    console.log('Migração concluída.');
}
migrate().catch(e => {
    console.error(e);
    prisma_1.prisma.$disconnect();
    process.exit(1);
});
