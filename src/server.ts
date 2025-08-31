import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import multer from 'multer';
import session from 'express-session';
import apiRouter from './api.js'; // Importa o router centralizado

// Declarar o módulo 'express' para estender a interface Request
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Estender a interface de sessão do Express
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Importar as funções do adaptador de dados
import {
  listOrders,
  getOrderById,
  updateOrder,
  statsLast14Days,
  paymentsBreakdown,
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  getLandingBySlug,
  lastNDays
} from './data/index';
import { prisma } from './db/prisma';
import { faker } from '@faker-js/faker/locale/pt_BR';

const app = express();
app.use(cors());

// Configuração da sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Configuração do Multer para upload de imagens
const UPLOADS_DIR = path.join(process.cwd(), "backend", "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Apenas imagens (jpeg, jpg, png, gif) são permitidas."));
  }
});

// Servir arquivos estáticos da pasta 'public'
const publicPath = path.join(__dirname, "public");
console.log(`Servindo arquivos estáticos de: ${publicPath}`);
app.use(express.static(publicPath));
app.use('/uploads', express.static(UPLOADS_DIR));

// --------- ENDPOINTS ---------

// USA O ROUTER CENTRALIZADO PARA TODAS AS ROTAS DA API
app.use("/api", apiRouter);

// Healthcheck simples
app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

async function runSeedIfNeeded() {
  const orderCount = await prisma.order.count();
  if (orderCount > 0) {
    console.log('Banco de dados já populado. Seed não será executado.');
    return;
  }

  console.log('Banco de dados vazio. Executando seed...');

  try {
    // 1. Criar 2 Landing Pages
    await prisma.landingPage.createMany({
      data: [
        {
          slug: 'produto-essencial-1',
          title: 'Creme Hidratante Facial Profundo',
          brand: 'DermoSkin',
          description: 'Hidratação intensa por 24 horas com ácido hialurônico e vitaminas.',
          price: 18990, // R$ 189,90
          freeShipping: true,
          shippingPrice: 0,
          imageUrl: faker.image.urlLoremFlickr({ category: 'cosmetics' }),
        },
        {
          slug: 'serum-rejuvenescedor-2',
          title: 'Sérum Rejuvenescedor Noite',
          brand: 'GlowUp',
          description: 'Combate os sinais de envelhecimento enquanto você dorme.',
          price: 29990, // R$ 299,90
          freeShipping: false,
          shippingPrice: 1500, // R$ 15,00
          imageUrl: faker.image.urlLoremFlickr({ category: 'beauty' }),
        },
      ],
    });
    console.log('Landing pages criadas.');

    // 2. Criar 4 Pedidos com Clientes, Endereços e Pagamentos
    for (let i = 0; i < 4; i++) {
      const customer = await prisma.customer.create({
        data: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email({ firstName: `test_${i}` }),
          phone: faker.phone.number(),
          cpf: `${faker.string.numeric(3)}.${faker.string.numeric(3)}.${faker.string.numeric(3)}-${faker.string.numeric(2)}`,
          birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
          addresses: {
            create: {
              cep: faker.location.zipCode(),
              street: faker.location.street(),
              number: faker.location.buildingNumber(),
              complement: faker.location.secondaryAddress(),
              district: faker.location.streetAddress().split(',')[1]?.trim() || 'Centro',
              city: faker.location.city(),
              state: faker.location.state({ abbreviated: true }),
            },
          },
        },
      });

      const paymentMethod = faker.helpers.arrayElement(['cartao', 'pix', 'boleto'] as const);
      const orderStatus = paymentMethod === 'boleto' && i % 2 === 0 
        ? 'pendente' 
        : faker.helpers.arrayElement(['pago', 'enviado']);
      
      const paymentStatus = orderStatus === 'pago' || orderStatus === 'enviado' ? 'confirmado' : 'pendente';

      const itemPrice = faker.number.int({ min: 8000, max: 25000 });
      const qty = faker.number.int({ min: 1, max: 2 });
      const totalAmount = itemPrice * qty;

      await prisma.order.create({
        data: {
          id: faker.string.uuid(),
          customerId: customer.id,
          status: orderStatus,
          category: faker.helpers.arrayElement(['Skincare', 'Maquiagem', 'Cabelo']),
          totalAmount: totalAmount,
          createdAt: faker.date.recent({ days: 14 }),
          items: {
            create: {
              sku: faker.string.alphanumeric(10).toUpperCase(),
              name: faker.commerce.productName(),
              qty: qty,
              unitPrice: itemPrice,
            },
          },
          payments: {
            create: {
              paymentMethod: paymentMethod,
              paidAmount: totalAmount,
              status: paymentStatus,
            },
          },
        },
      });
    }
    console.log('Clientes, pedidos, endereços e pagamentos criados.');
    console.log('Seed concluído com sucesso!');

  } catch (error) {
    console.error("Falha ao executar o seed no boot:", error);
    // Em caso de erro, deletar dados para permitir nova tentativa na próxima inicialização
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.landingPage.deleteMany();
    console.log('Dados do seed removidos após falha.');
  }
}

// Start
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  runSeedIfNeeded().catch(e => {
      console.error("Falha ao executar o seed no boot:", e);
  });
});
