import { prisma } from '../src/db/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { generateSlug, generateUniqueId } from '../src/utils';
import { faker } from '@faker-js/faker';

// Carregar variáveis de ambiente para garantir que DATABASE_URL seja lida
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const DB_PATH = path.resolve(__dirname, 'db.json');

interface CustomerJson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  zip: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

interface ShippingJson {
  method: string;
  postalCode: string;
  address1: string;
  address2: string;
  address2_complement: string;
  district: string;
  city: string;
  state: string;
  value: number;
}

interface ItemJson {
  sku: string;
  name: string;
  qty: number;
  price: number;
}

interface PaymentJson {
  method: string;
  value: number;
  status?: string;
}

interface SummaryJson {
  subTotal: number;
  discount: number;
  shipping: number;
  total: number;
}

interface TimelineEventJson {
  label: string;
  date: string;
}

interface OrderJson {
  id: string;
  order_date: string;
  status: "pago" | "pendente" | "cancelado" | "enviado";
  category: string;
  total_value: number;
  paymentMethod: "pix" | "cartao" | "boleto" | "desconhecido";
  customer: CustomerJson;
  shipping: ShippingJson;
  items: ItemJson[];
  payments: PaymentJson[];
  summary: SummaryJson;
  timeline: TimelineEventJson[];
  createdAt?: string;
}

interface LandingPageJson {
  id: string;
  slug: string;
  productImage?: string;
  productTitle: string;
  productDescription: string;
  productBrand: string;
  productPrice: number;
  shippingValue: number;
  freeShipping: boolean;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

interface DBJson {
  orders: OrderJson[];
  landingPages: LandingPageJson[];
  customers: any[]; // Não usado diretamente, mas presente no db.json
  products: any[]; // Não usado diretamente, mas presente no db.json
}

// Converte valores monetários para centavos (inteiros)
const toCents = (value: number): number => Math.round(value * 100);

// Mapeia o método de pagamento do formato JSON para o enum do Prisma
const mapPaymentMethodToPrisma = (method: string): 'pix' | 'cartao' | 'boleto' | 'desconhecido' => {
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

  let dbJson: DBJson;
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    dbJson = JSON.parse(raw);
  } catch (error: any) {
    console.error(`Erro ao ler db.json: ${error.message}`);
    return;
  }

  let migratedCustomers = 0;
  let migratedOrders = 0;
  let migratedLandingPages = 0;

  // Limpar o banco de dados SQLite antes da migração (opcional, mas útil para testes)
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.address.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.landingPage.deleteMany();
  console.log('Banco de dados SQLite limpo.');

  // Migrar Landing Pages
  for (const lp of dbJson.landingPages) {
    try {
      await prisma.landingPage.create({
        data: {
          id: lp.id,
          slug: lp.slug || generateSlug(lp.productTitle),
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
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
        console.warn(`Landing Page com slug '${lp.slug}' já existe, ignorando.`);
      } else if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        console.warn(`Landing Page com ID '${lp.id}' já existe, ignorando.`);
      } else {
        console.error(`Erro ao migrar landing page ${lp.id}: ${error.message}`);
      }
    }
  }

  // Migrar Pedidos
  for (const order of dbJson.orders) {
    try {
      // 1. Criar ou conectar Customer
      let customer = await prisma.customer.findUnique({
        where: { email: order.customer.email },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            id: order.customer.id, // Usar ID existente se houver
            firstName: order.customer.firstName || '',
            lastName: order.customer.lastName || '',
            email: order.customer.email,
            phone: order.customer.phone || '',
            cpf: order.customer.cpf || '',
            birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
            createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
          },
        });
        migratedCustomers++;
      }

      // 2. Criar ou conectar Address
      if (order.shipping && customer) {
        let address = await prisma.address.findFirst({
          where: {
            customerId: customer.id,
            cep: order.shipping.postalCode,
            street: order.shipping.address1,
            number: order.shipping.address2,
          },
        });

        if (!address) {
          await prisma.address.create({
            data: {
              customerId: customer.id,
              cep: order.shipping.postalCode || faker.location.zipCode(),
              street: order.shipping.address1 || faker.location.street(),
              number: order.shipping.address2 || faker.location.buildingNumber(),
              complement: order.shipping.address2_complement || faker.location.secondaryAddress(),
              district: order.shipping.district || faker.location.county(),
              city: order.shipping.city || faker.location.city(),
              state: order.shipping.state || faker.location.state({ abbreviated: true }),
              createdAt: order.createdAt ? new Date(order.createdAt) : new Date(order.order_date),
            },
          });
        }
      }

      // 3. Criar Order
      const newOrder = await prisma.order.create({
        data: {
          id: generateUniqueId(), // Gerar novo ID aleatório
          customerId: customer!.id,
          status: order.status.toLowerCase() as any,
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
              } else if (order.status === 'cancelado') {
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
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        console.warn(`Pedido com ID '${order.id}' já existe, ignorando.`);
      } else if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        console.warn(`Cliente com email '${order.customer.email}' já existe, ignorando criação duplicada.`);
      } else {
        console.error(`Erro ao migrar pedido ${order.id}: ${error.message}`);
      }
    }
  }

  console.log('\n--- Relatório de Migração ---');
  console.log(`Clientes migrados (ou conectados): ${migratedCustomers}`);
  console.log(`Pedidos migrados: ${migratedOrders}`);
  console.log(`Landing Pages migradas: ${migratedLandingPages}`);

  await prisma.$disconnect();
  console.log('Migração concluída.');
}

migrate().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
