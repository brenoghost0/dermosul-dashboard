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
  updateOrderStatusByExternalReference
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
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping } = req.body;

    if (!productTitle || !productPrice) {
      return res.status(400).json({ error: 'validation_failed', message: 'Título e Preço são campos obrigatórios.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'validation_failed', message: 'A imagem do produto é obrigatória.' });
    }

    const imageUrl = `${process.env.API_BASE_URL}/uploads/${req.file.filename}`;
    
    const newLandingPage = await createLandingPage({ 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true',
      imageUrl 
    });
    res.status(201).json(newLandingPage);
  } catch (error: any) {
    console.error("Erro ao criar landing page:", error);
    res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao criar a landing page.' });
  }
});

router.put("/landings/:id", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, imageUrl: existingImageUrl } = req.body;
    const imageUrl = req.file ? `${process.env.API_BASE_URL}/uploads/${req.file.filename}` : existingImageUrl;

    const updatedLandingPage = await updateLandingPage(req.params.id, { 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true', 
      imageUrl 
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
  const user = await prisma.user.findUnique({ where: { username } });

  if (user && await bcrypt.compare(password, user.passwordHash)) {
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.SESSION_SECRET || 'super-secret-key', {
      expiresIn: '1d',
    });
    return res.json({ success: true, token });
  }

  res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
});

router.post("/logout", (req: Request, res: Response) => {
  res.json({ success: true });
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
      by[idx.get(o.createdAt)!].revenue += o.total;
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
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
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
    const { status } = req.body;
    if (status !== 'ATIVA' && status !== 'PAUSADA') {
      return res.status(400).json({ error: "Status inválido. Use 'ATIVA' ou 'PAUSADA'." });
    }
    const updated = await updateLandingPageStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: "Landing Page não encontrada." });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
