import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config();

import { createServer } from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import multer from 'multer';
import session from 'express-session';
import { Server as SocketIOServer } from 'socket.io';
// Import sem extensão para funcionar bem após transpilar para dist/ (CJS)
import apiRouter from './api'; // Importa o router centralizado
import storeApiRouter from './store-api'; // Importa o router da loja
import { scrapeQueueEvents } from './lib/scraping/queue';
import type { ScrapeRealtimeEvent } from './lib/scraping/types';

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
    chatSessions?: Record<string, Array<{ role: "user" | "assistant"; content: string }>>;
    chatProductMemory?: Record<string, {
      lastBatch: Array<{
        id?: string | null;
        slug?: string | null;
        name: string;
        description?: string | null;
        price?: string | null;
        rank: number;
      }>;
      recent: Array<{
        id?: string | null;
        slug?: string | null;
        name: string;
        description?: string | null;
        price?: string | null;
      }>;
      awaitingLinkConfirmation?: boolean;
    }>;
    luckyWheel?: {
      lastResult?: {
        prizeId: string;
        couponCode?: string | null;
        message: string;
        rotationDegrees: number;
        timestamp: string;
        freeShipping?: boolean;
        freeOrder?: boolean;
        autoApplyCoupon?: boolean;
        couponType?: "PERCENT" | "AMOUNT" | null;
        couponValue?: number | null;
      } | null;
      lastShownAt?: string | null;
      dismissed?: boolean;
      blockedReason?: string | null;
    };
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
  lastNDays,
  generateSitemapXml
} from './data/index';
import { prisma } from './db/prisma';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { generateShortId } from './utils';

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

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
  path: '/socket.io',
});

io.on('connection', (socket) => {
  socket.join('scrape:all');
  socket.on('scrape:subscribe', (jobId: string) => {
    if (typeof jobId === 'string' && jobId.length > 0) {
      socket.join(`scrape:${jobId}`);
    }
  });
  socket.on('scrape:unsubscribe', (jobId: string) => {
    if (typeof jobId === 'string' && jobId.length > 0) {
      socket.leave(`scrape:${jobId}`);
    }
  });
});

function emitScrapeEvent(jobId: string, event: Partial<ScrapeRealtimeEvent>) {
  const payload: ScrapeRealtimeEvent & Record<string, unknown> = {
    jobId,
    ...event,
  } as ScrapeRealtimeEvent & Record<string, unknown>;
  io.to('scrape:all').emit('scrape:event', payload);
  io.to(`scrape:${jobId}`).emit('scrape:event', payload);
}

scrapeQueueEvents.on('progress', ({ jobId, data }) => {
  const event = typeof data === 'object' && data !== null
    ? { ...data, jobId }
    : { type: 'progress', jobId, processed: Number(data) || 0 };
  emitScrapeEvent(jobId, event as ScrapeRealtimeEvent);
});

scrapeQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  let data: any = returnvalue;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = { status: 'done' };
    }
  }
  emitScrapeEvent(jobId, {
    type: 'status',
    jobId,
    status: data?.status || 'done',
    processed: data?.processed,
    total: data?.total,
  });
});

scrapeQueueEvents.on('failed', ({ jobId, failedReason }) => {
  emitScrapeEvent(jobId, {
    type: 'status',
    jobId,
    status: 'failed',
    errorMessage: failedReason,
  });
});

scrapeQueueEvents.on('error', (error) => {
  console.error('[scrapeQueueEvents] erro', error);
});

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

// Servir arquivos estáticos do frontend
const frontendPath = path.join(process.cwd(), 'dist');
console.log(`Servindo arquivos estáticos de: ${frontendPath}`);
app.use(express.static(frontendPath));

// Servir uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// --------- ENDPOINTS ---------

// USA O ROUTER CENTRALIZADO PARA TODAS AS ROTAS DA API
app.use("/api/store", storeApiRouter);
app.use("/api", apiRouter);

// Healthcheck simples
app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.get('/robots.txt', (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const content = `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml`;
  res.type('text/plain').send(content);
});

app.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const xml = await generateSitemapXml(baseUrl);
    res.type('application/xml').send(xml);
  } catch (error: any) {
    console.error('[sitemap]', error);
    res.status(500).type('text/plain').send('Erro ao gerar sitemap');
  }
});

// --- Fallback das rotas de notas (garante funcionamento mesmo que apiRouter não tenha recarregado) ---
const NOTES_FILE = path.join(process.cwd(), 'backend', 'notes.json');
function loadNotesFile(): Record<string, string> {
  try {
    if (!fs.existsSync(NOTES_FILE)) {
      fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
      fs.writeFileSync(NOTES_FILE, JSON.stringify({}), 'utf-8');
    }
    const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}
function saveNotesFile(data: Record<string, string>) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
app.get('/api/orders/:id/notes', (req: Request, res: Response) => {
  const id = req.params.id;
  const notesMap = loadNotesFile();
  res.json({ notes: notesMap[id] || '' });
});
app.use(express.json());
app.patch('/api/orders/:id/notes', (req: Request, res: Response) => {
  const id = req.params.id;
  const notes = (req.body && (req.body as any).notes) || '';
  if (typeof notes !== 'string') {
    return res.status(400).json({ error: 'validation_failed', message: 'Campo notes deve ser string.' });
  }
  try {
    const map = loadNotesFile();
    map[id] = notes;
    saveNotesFile(map);
    res.json({ success: true, notes });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e?.message || 'Falha ao salvar notas.' });
  }
});

// Fallback para o index.html do frontend (para rotas de SPA)
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend não encontrado. Execute `npm run build`.');
  }
});

import bcrypt from 'bcrypt';

async function runSeedIfNeeded() {
  // Garante que o usuário admin exista
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    console.log('Nenhum usuário admin encontrado, criando um...');
    const passwordHash = await bcrypt.hash('123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        name: 'Administrador',
        email: 'admin@example.com',
      },
    });
    console.log('Usuário "admin" / senha "123" criado.');
  }

  const orderCount = await prisma.order.count();
  if (orderCount > 0) {
    console.log('Banco de dados já populado com pedidos. Seed de pedidos não será executado.');
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
      // CEPs reais (amostra) para autofill
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
      const rc = REAL_CEPS[Math.floor(Math.random() * REAL_CEPS.length)];

      const customer = await prisma.customer.create({
        data: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email({ firstName: `test_${i}` }),
          phone: (() => {
            const ddd = '11';
            const rest8 = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
            const digits = `${ddd}9${rest8}`;
            return `(${digits.slice(0,2)}) ${digits.slice(2,3)}${digits.slice(3,7)}-${digits.slice(7)}`;
          })(),
          cpf: `${faker.string.numeric(3)}.${faker.string.numeric(3)}.${faker.string.numeric(3)}-${faker.string.numeric(2)}`,
          birthDate: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
          addresses: {
            create: {
              cep: rc.cep,
              street: faker.location.street(),
              number: faker.location.buildingNumber(),
              complement: faker.location.secondaryAddress(),
              district: faker.location.streetAddress().split(',')[1]?.trim() || 'Centro',
              city: rc.city,
              state: rc.state,
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

      const productName = faker.commerce.productName();
      const productSku = faker.string.alphanumeric(10).toUpperCase();

      const productSlugBase = faker.helpers.slugify(productName.toLowerCase());
      let slugCandidate = productSlugBase;
      let slugCounter = 1;
      while (await prisma.product.findUnique({ where: { slug: slugCandidate } })) {
        slugCandidate = `${productSlugBase}-${slugCounter++}`;
      }

      const product = await prisma.product.create({
        data: {
          name: productName,
          slug: slugCandidate,
          brand: faker.company.name(),
          sku: productSku,
          description: faker.commerce.productDescription(),
          descriptionHtml: null,
          price: itemPrice,
          compareAtPrice: null,
          stockQuantity: faker.number.int({ min: 10, max: 200 }),
          active: true,
          metaTitle: null,
          metaDescription: null,
        },
      });

      await prisma.order.create({
        data: {
          id: generateShortId(),
          customerId: customer.id,
          status: orderStatus,
          category: faker.helpers.arrayElement(['Skincare', 'Maquiagem', 'Cabelo']),
          totalAmount: totalAmount,
          createdAt: faker.date.recent({ days: 14 }),
          items: {
            create: {
              qty,
              unitPrice: itemPrice,
              product: {
                connect: { id: product.id },
              },
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
const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ENABLE_AUTO_SEED = process.env.ENABLE_AUTO_SEED === 'true';

httpServer.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);

  if (ENABLE_AUTO_SEED) {
    runSeedIfNeeded().catch(e => {
      console.error("Falha ao executar o seed no boot:", e);
    });
  } else {
    console.log('Seed automático desativado. Defina ENABLE_AUTO_SEED=true para popular dados fictícios somente quando desejar.');
  }
});
