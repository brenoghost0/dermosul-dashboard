import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import {
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  statsLast14Days,
  paymentsBreakdown,
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  getLandingBySlug,
  createPublicOrder,
  lastNDays,
  updateLandingPageStatus,
  updateOrderStatusByExternalReference,
  getOrderByExternalReference
} from './data/index.js';
import { getPaymentProvider, PaymentRequest } from './lib/payment/index.js';
import { prisma } from './db/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = Router();

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token malformado.' });
  }

  jwt.verify(token, process.env.SESSION_SECRET || 'super-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'forbidden', message: 'Token inválido.' });
    }
    next();
  });
};

// --- CONFIGURAÇÃO DO MULTER (UPLOAD) ---
const UPLOADS_DIR = path.join(process.cwd(), "backend", "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Apenas imagens (jpeg, jpg, png, gif) são permitidas."));
  }
});

// --- ROTAS COM MULTIPART/FORM-DATA (DEVEM VIR ANTES DO EXPRESS.JSON) ---

router.post("/landings", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, template } = req.body;

    if (!productTitle || !productPrice) {
      return res.status(400).json({ error: 'validation_failed', message: 'Título e Preço são campos obrigatórios.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'validation_failed', message: 'A imagem do produto é obrigatória.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    const newLandingPage = await createLandingPage({ 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true',
      imageUrl,
      template: template || 'MODELO_1'
    });
    res.status(201).json(newLandingPage);
  } catch (error: any) {
    console.error("Erro ao criar landing page:", error);
    res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao criar a landing page.' });
  }
});

router.put("/landings/:id", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, template, imageUrl: existingImageUrl } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingImageUrl;

    const updatedLandingPage = await updateLandingPage(req.params.id, { 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true', 
      imageUrl,
      template: template || undefined
    });

    if (!updatedLandingPage) return res.status(404).json({ error: "Landing Page não encontrada." });
    res.json(updatedLandingPage);
  } catch (error: any) {
    console.error("Erro ao atualizar landing page:", error);
    res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao atualizar a landing page.' });
  }
});


// --- APLICA O PARSER DE JSON PARA TODAS AS ROTAS ABAIXO ---
router.use(express.json());


// --- ROTAS PÚBLICAS (CONSUMIDAS PELA LANDING PAGE) ---

router.get('/landings/:slug', async (req: Request, res: Response) => {
  try {
    const lp = await getLandingBySlug(req.params.slug);
    if (!lp) return res.status(404).json({ error: 'not_found' });
    res.json(lp);
  } catch (e: any) {
    console.error('GET /api/landings/:slug', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- EXPORTAÇÃO DE PEDIDOS EM CSV ---

router.get('/orders/export', requireAuth, async (req: Request, res: Response) => {
  try {
    // Força um pageSize grande para exportar todos os resultados do filtro atual
    const params = { ...req.query, page: 1, pageSize: 100000 } as any;
    const data = await listOrders(params);

    // Define colunas e gera CSV simples
    const headers = [
      'createdAt',
      'id',
      'fullId',
      'client',
      'category',
      'status',
      'total',
      'paymentMethod',
      'lpStatus'
    ];

    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Aspas duplas escapadas conforme CSV
      const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n');
      const escaped = s.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };

    const rows = [headers.join(',')].concat(
      (data.items || []).map((o: any) => [
        o.createdAt,
        o.id,
        o.fullId,
        o.client,
        o.category,
        o.status,
        o.total,
        o.paymentMethod || 'desconhecido',
        o.lpStatus || ''
      ].map(esc).join(','))
    );

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pedidos.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    res.status(500).json({ error: 'server_error', message: 'Falha ao exportar CSV.' });
  }
});

router.post('/orders/public', async (req: Request, res: Response) => {
  try {
    const order = await createPublicOrder(req.body);
    res.status(201).json(order);
  } catch (e: any) {
    if (e.details) {
      return res.status(400).json({ error: 'validation_failed', details: e.details });
    }
    const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
    res.status(500).json({ error: 'creation_failed', message: errorMessage });
  }
});

router.get('/orders/by-reference/:ref', async (req: Request, res: Response) => {
  try {
    const order = await getOrderByExternalReference(req.params.ref);
    if (!order) {
      return res.status(404).json({ error: 'not_found', message: 'Pedido não encontrado.' });
    }
    res.json(order);
  } catch (e: any) {
    console.error('GET /api/orders/by-reference/:ref', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- ROTAS DE PAGAMENTO (GATEWAY) ---

router.post('/payments/credit-card', async (req: Request, res: Response) => {
  try {
    const paymentRequest: PaymentRequest = req.body;
    const paymentProvider = getPaymentProvider();
    const result = await paymentProvider.processPayment(paymentRequest);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing credit card payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payments/pix', async (req: Request, res: Response) => {
  try {
    const paymentRequest: PaymentRequest = req.body;
    const paymentProvider = getPaymentProvider();
    const result = await paymentProvider.createPixPayment(paymentRequest);
    res.json(result);
  } catch (error: any) {
    console.error('Error creating PIX payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Confere status de pagamento por externalReference no gateway e atualiza o pedido caso pago
router.get('/payments/status/by-reference/:ref', async (req: Request, res: Response) => {
  try {
    const externalReference = req.params.ref;
    const paymentProvider = getPaymentProvider();
    // @ts-ignore - método específico do AsaasProvider
    if (typeof paymentProvider.getPaymentStatusByExternalReference !== 'function') {
      return res.status(400).json({ success: false, message: 'Provider does not support status lookup.' });
    }
    // @ts-ignore
    const result = await paymentProvider.getPaymentStatusByExternalReference(externalReference);
    if (result.success && result.paid) {
      await updateOrderStatusByExternalReference(externalReference, 'pago');
    }
    return res.json({ success: true, paid: !!result.paid, status: result.status });
  } catch (error: any) {
    console.error('Error checking payment status by reference:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ROTA DE WEBHOOK ---

router.post('/gateway/asaas/webhook', async (req: Request, res: Response) => {
  const event = req.body;

  // TODO: Adicionar validação de segurança do webhook (ex: verificar IP ou assinatura)
  // const asaasSignature = req.headers['asaas-signature'];

  try {
    if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
      const payment = event.payment;
      const externalReference = payment.externalReference;

      if (externalReference) {
        console.log(`[Webhook Asaas] Payment confirmed for externalReference: ${externalReference}`);
        await updateOrderStatusByExternalReference(externalReference, 'pago');
      }
    }
    res.status(200).send('Webhook received');
  } catch (error: any) {
    console.error('[Webhook Asaas] Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// --- ROTAS DE AUTENTICAÇÃO ---

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // 1) Tenta autenticar como Admin (User)
  const user = await prisma.user.findUnique({ where: { username } });
  if (user && await bcrypt.compare(password, user.passwordHash)) {
    const token = jwt.sign({ role: 'admin', userId: user.id, username: user.username }, process.env.SESSION_SECRET || 'super-secret-key', { expiresIn: '1d' });
    return res.json({ success: true, token });
  }

  // 2) Tenta autenticar como Operador
  try {
    const op = await prisma.operator.findUnique({ where: { username } });
    if (op && await bcrypt.compare(password, op.passwordHash)) {
      const token = jwt.sign({
        role: 'operator',
        operatorId: op.id,
        username: op.username,
        perms: {
          canGenerateLandings: op.canGenerateLandings,
          canViewOrders: op.canViewOrders,
          canManageAll: op.canManageAll,
        }
      }, process.env.SESSION_SECRET || 'super-secret-key', { expiresIn: '1d' });
      return res.json({ success: true, token });
    }
  } catch (e) {
    // ignore
  }

  res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
});

router.post("/logout", (req: Request, res: Response) => {
  res.json({ success: true });
});

// --- CONFIGURAÇÕES ---
router.get('/settings/profile', requireAuth, async (_req: Request, res: Response) => {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      // Auto-cria usuário admin padrão quando ausente
      const passwordHash = await bcrypt.hash('123', 10);
      user = await prisma.user.create({ data: { username: 'admin', passwordHash, name: 'Administrador', email: 'admin@example.com' } });
    }
    res.json({ id: user.id, name: user.name || '', email: user.email || '', username: user.username });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.put('/settings/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, username, password } = req.body || {};
    let user = await prisma.user.findFirst();
    // Se não existir, cria um usuário base e depois aplica atualização
    if (!user) {
      const baseHash = await bcrypt.hash(password && String(password).length >= 4 ? String(password) : '123', 10);
      user = await prisma.user.create({ data: { username: username || 'admin', passwordHash: baseHash, name: name || 'Administrador', email: email || 'admin@example.com' } });
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, username: user.username } });
    }
    const data: any = { name: name ?? user.name, email: email ?? user.email, username: username ?? user.username };
    if (password && String(password).length >= 4) {
      data.passwordHash = await bcrypt.hash(String(password), 10);
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, username: updated.username } });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.get('/settings/operators', requireAuth, async (_req: Request, res: Response) => {
  try {
    const ops = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(ops.map(o => ({
      id: o.id, name: o.name, email: o.email, username: o.username,
      canGenerateLandings: o.canGenerateLandings, canViewOrders: o.canViewOrders, canManageAll: o.canManageAll,
    })));
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.post('/settings/operators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, username, password, canGenerateLandings, canViewOrders, canManageAll } = req.body || {};
    if (!name || !email || !username || !password) return res.status(400).json({ message: 'Preencha nome, email, usuário e senha' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await prisma.operator.create({ data: { name, email, username, passwordHash, canGenerateLandings: !!canGenerateLandings, canViewOrders: !!canViewOrders, canManageAll: !!canManageAll } });
    res.json({ id: created.id });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.delete('/settings/operators/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.operator.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

// --- ROTAS PRIVADAS (DASHBOARD) ---

router.get("/overview", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await statsLast14Days());
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/revenueByDay", requireAuth, async (req: Request, res: Response) => {
  try {
    const days = lastNDays(14);
    const orders = await listOrders({});
    const by = days.map((date: string) => ({ date, revenue: 0 }));
    const idx = new Map(days.map((d: string, i: number) => [d, i]));
    for (const o of orders.items) {
      if (!idx.has(o.createdAt)) continue;
      by[idx.get(o.createdAt)!].revenue += o.total_value;
    }
    res.json(by);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/ordersByCategory", requireAuth, async (req: Request, res: Response) => {
  try {
    const daysSet = new Set(lastNDays(14));
    const orders = await listOrders({});
    const mapCat = new Map();
    for (const o of orders.items) {
      if (!daysSet.has(o.createdAt)) continue;
      const key = o.category || "Outros";
      mapCat.set(key, (mapCat.get(key) || 0) + 1);
    }
    res.json(Array.from(mapCat.entries()).map(([category, value]) => ({ category, value })));
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/payments/breakdown", requireAuth, async (req: Request, res: Response) => {
    try {
        res.json(await paymentsBreakdown());
    } catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

router.get("/conversionByDay", requireAuth, async (req: Request, res: Response) => {
  try {
    const days = lastNDays(14);
    const orders = await listOrders({});
    const idx = new Map(days.map((d: string, i: number) => [d, i]));
    const daily = days.map((d: string) => ({ date: d, paid: 0, total: 0 }));
    for (const o of orders.items) {
      const i = idx.get(o.createdAt);
      if (i === undefined) continue;
      daily[i].total += 1;
      if (o.status === "pago") daily[i].paid += 1;
    }
    res.json(daily.map(d => ({ date: d.date, rate: d.total ? d.paid / d.total : 0 })));
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listOrders(req.query));
  } catch (error: any) {
    console.error("[ERROR] Falha em GET /api/orders:", error); // Log detalhado
    res.status(500).json({ error: "Erro interno do servidor.", message: error.message });
  }
});

router.get("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.patch("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const updatedOrder = await updateOrder(req.params.id, req.body);
    if (!updatedOrder) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json(updatedOrder);
  } catch (error: any) {
    res.status(400).json({ errors: error.message });
  }
});

router.delete("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteOrder(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// --- Notas do pedido (armazenadas em arquivo backend/notes.json) ---

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

router.get('/orders/:id/notes', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const notesMap = loadNotesFile();
  res.json({ notes: notesMap[id] || '' });
});

router.patch('/orders/:id/notes', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const { notes } = req.body || {};
  if (typeof notes !== 'string') {
    return res.status(400).json({ error: 'validation_failed', message: 'Campo notes deve ser string.' });
  }
  const notesMap = loadNotesFile();
  notesMap[id] = notes;
  try {
    saveNotesFile(notesMap);
    res.json({ success: true, notes });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e?.message || 'Falha ao salvar notas.' });
  }
});

router.get("/landings", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listLandingPages());
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.delete("/landings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteLandingPage(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Landing Page não encontrada." });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.patch("/landings/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body || {};
    if (status !== 'ATIVA' && status !== 'PAUSADA') {
      return res.status(400).json({ error: 'validation_failed', message: "Status inválido. Use 'ATIVA' ou 'PAUSADA'." });
    }
    const updated = await updateLandingPageStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'not_found', message: "Landing Page não encontrada." });
    res.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/landings/:id/status error:', error);
    res.status(500).json({ error: 'server_error', message: error?.message || 'Falha ao atualizar status.' });
  }
});

export default router;
