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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_js_1 = require("./data/index.js");
const index_js_2 = require("./lib/payment/index.js");
const prisma_js_1 = require("./db/prisma.js");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'unauthorized', message: 'Token não fornecido.' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'unauthorized', message: 'Token malformado.' });
    }
    jsonwebtoken_1.default.verify(token, process.env.SESSION_SECRET || 'super-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'forbidden', message: 'Token inválido.' });
        }
        next();
    });
};
// --- CONFIGURAÇÃO DO MULTER (UPLOAD) ---
const UPLOADS_DIR = path_1.default.join(process.cwd(), "backend", "public", "uploads");
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
router.use('/uploads', express_1.default.static(UPLOADS_DIR));
router.use('/uploads', express_1.default.static(UPLOADS_DIR));
router.use('/uploads', express_1.default.static(UPLOADS_DIR));
router.use('/uploads', express_1.default.static(UPLOADS_DIR));
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname).toLowerCase());
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && extname)
            return cb(null, true);
        cb(new Error("Apenas imagens (jpeg, jpg, png, gif) são permitidas."));
    }
});
// --- ROTAS COM MULTIPART/FORM-DATA (DEVEM VIR ANTES DO EXPRESS.JSON) ---
router.post("/landings", requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping } = req.body;
        if (!productTitle || !productPrice) {
            return res.status(400).json({ error: 'validation_failed', message: 'Título e Preço são campos obrigatórios.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'validation_failed', message: 'A imagem do produto é obrigatória.' });
        }
        const imageUrl = `${process.env.API_BASE_URL}/uploads/${req.file.filename}`;
        const newLandingPage = await (0, index_js_1.createLandingPage)({
            productTitle,
            productDescription,
            productBrand,
            productPrice,
            shippingValue,
            freeShipping: String(freeShipping).toLowerCase() === 'true',
            imageUrl
        });
        res.status(201).json(newLandingPage);
    }
    catch (error) {
        console.error("Erro ao criar landing page:", error);
        res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao criar a landing page.' });
    }
});
router.put("/landings/:id", requireAuth, upload.single('image'), async (req, res) => {
    try {
        const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, imageUrl: existingImageUrl } = req.body;
        const imageUrl = req.file ? `${process.env.API_BASE_URL}/uploads/${req.file.filename}` : existingImageUrl;
        const updatedLandingPage = await (0, index_js_1.updateLandingPage)(req.params.id, {
            productTitle,
            productDescription,
            productBrand,
            productPrice,
            shippingValue,
            freeShipping: String(freeShipping).toLowerCase() === 'true',
            imageUrl
        });
        if (!updatedLandingPage)
            return res.status(404).json({ error: "Landing Page não encontrada." });
        res.json(updatedLandingPage);
    }
    catch (error) {
        console.error("Erro ao atualizar landing page:", error);
        res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao atualizar a landing page.' });
    }
});
// --- APLICA O PARSER DE JSON PARA TODAS AS ROTAS ABAIXO ---
router.use(express_1.default.json());
// --- ROTAS PÚBLICAS (CONSUMIDAS PELA LANDING PAGE) ---
router.get('/landings/:slug', async (req, res) => {
    try {
        const lp = await (0, index_js_1.getLandingBySlug)(req.params.slug);
        if (!lp)
            return res.status(404).json({ error: 'not_found' });
        res.json(lp);
    }
    catch (e) {
        console.error('GET /api/landings/:slug', e);
        res.status(500).json({ error: 'server_error' });
    }
});
router.post('/orders/public', async (req, res) => {
    try {
        const order = await (0, index_js_1.createPublicOrder)(req.body);
        res.status(201).json(order);
    }
    catch (e) {
        if (e.details) {
            return res.status(400).json({ error: 'validation_failed', details: e.details });
        }
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        res.status(500).json({ error: 'creation_failed', message: errorMessage });
    }
});
// --- ROTAS DE PAGAMENTO (GATEWAY) ---
router.post('/payments/credit-card', async (req, res) => {
    try {
        const paymentRequest = req.body;
        const paymentProvider = (0, index_js_2.getPaymentProvider)();
        const result = await paymentProvider.processPayment(paymentRequest);
        res.json(result);
    }
    catch (error) {
        console.error('Error processing credit card payment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/payments/pix', async (req, res) => {
    try {
        const paymentRequest = req.body;
        const paymentProvider = (0, index_js_2.getPaymentProvider)();
        const result = await paymentProvider.createPixPayment(paymentRequest);
        res.json(result);
    }
    catch (error) {
        console.error('Error creating PIX payment:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// --- ROTA DE WEBHOOK ---
router.post('/gateway/asaas/webhook', async (req, res) => {
    const event = req.body;
    // TODO: Adicionar validação de segurança do webhook (ex: verificar IP ou assinatura)
    // const asaasSignature = req.headers['asaas-signature'];
    try {
        if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
            const payment = event.payment;
            const externalReference = payment.externalReference;
            if (externalReference) {
                console.log(`[Webhook Asaas] Payment confirmed for externalReference: ${externalReference}`);
                await (0, index_js_1.updateOrderStatusByExternalReference)(externalReference, 'pago');
            }
        }
        res.status(200).send('Webhook received');
    }
    catch (error) {
        console.error('[Webhook Asaas] Error processing webhook:', error);
        res.status(500).send('Error processing webhook');
    }
});
// --- ROTAS DE AUTENTICAÇÃO ---
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await prisma_js_1.prisma.user.findUnique({ where: { username } });
    if (user && await bcrypt_1.default.compare(password, user.passwordHash)) {
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, process.env.SESSION_SECRET || 'super-secret-key', {
            expiresIn: '1d',
        });
        return res.json({ success: true, token });
    }
    res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
});
router.post("/logout", (req, res) => {
    res.json({ success: true });
});
// --- ROTAS PRIVADAS (DASHBOARD) ---
router.get("/overview", requireAuth, async (req, res) => {
    try {
        res.json(await (0, index_js_1.statsLast14Days)());
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/revenueByDay", requireAuth, async (req, res) => {
    try {
        const days = (0, index_js_1.lastNDays)(14);
        const orders = await (0, index_js_1.listOrders)({});
        const by = days.map((date) => ({ date, revenue: 0 }));
        const idx = new Map(days.map((d, i) => [d, i]));
        for (const o of orders.items) {
            if (!idx.has(o.createdAt))
                continue;
            by[idx.get(o.createdAt)].revenue += o.total;
        }
        res.json(by);
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/ordersByCategory", requireAuth, async (req, res) => {
    try {
        const daysSet = new Set((0, index_js_1.lastNDays)(14));
        const orders = await (0, index_js_1.listOrders)({});
        const mapCat = new Map();
        for (const o of orders.items) {
            if (!daysSet.has(o.createdAt))
                continue;
            const key = o.category || "Outros";
            mapCat.set(key, (mapCat.get(key) || 0) + 1);
        }
        res.json(Array.from(mapCat.entries()).map(([category, value]) => ({ category, value })));
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/payments/breakdown", requireAuth, async (req, res) => {
    try {
        res.json(await (0, index_js_1.paymentsBreakdown)());
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/conversionByDay", requireAuth, async (req, res) => {
    try {
        const days = (0, index_js_1.lastNDays)(14);
        const orders = await (0, index_js_1.listOrders)({});
        const idx = new Map(days.map((d, i) => [d, i]));
        const daily = days.map((d) => ({ date: d, paid: 0, total: 0 }));
        for (const o of orders.items) {
            const i = idx.get(o.createdAt);
            if (i === undefined)
                continue;
            daily[i].total += 1;
            if (o.status === "pago")
                daily[i].paid += 1;
        }
        res.json(daily.map(d => ({ date: d.date, rate: d.total ? d.paid / d.total : 0 })));
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/orders", requireAuth, async (req, res) => {
    try {
        res.json(await (0, index_js_1.listOrders)(req.query));
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/orders/:id", requireAuth, async (req, res) => {
    try {
        const order = await (0, index_js_1.getOrderById)(req.params.id);
        if (!order)
            return res.status(404).json({ error: "Pedido não encontrado" });
        res.json(order);
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.patch("/orders/:id", requireAuth, async (req, res) => {
    try {
        const updatedOrder = await (0, index_js_1.updateOrder)(req.params.id, req.body);
        if (!updatedOrder)
            return res.status(404).json({ error: "Pedido não encontrado." });
        res.json(updatedOrder);
    }
    catch (error) {
        res.status(400).json({ errors: error.message });
    }
});
router.delete("/orders/:id", requireAuth, async (req, res) => {
    try {
        const deleted = await (0, index_js_1.deleteOrder)(req.params.id);
        if (!deleted)
            return res.status(404).json({ error: "Pedido não encontrado." });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.get("/landings", requireAuth, async (req, res) => {
    try {
        res.json(await (0, index_js_1.listLandingPages)());
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.delete("/landings/:id", requireAuth, async (req, res) => {
    try {
        const deleted = await (0, index_js_1.deleteLandingPage)(req.params.id);
        if (!deleted)
            return res.status(404).json({ error: "Landing Page não encontrada." });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
router.patch("/landings/:id/status", requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        if (status !== 'ATIVA' && status !== 'PAUSADA') {
            return res.status(400).json({ error: "Status inválido. Use 'ATIVA' ou 'PAUSADA'." });
        }
        const updated = await (0, index_js_1.updateLandingPageStatus)(req.params.id, status);
        if (!updated)
            return res.status(404).json({ error: "Landing Page não encontrada." });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});
exports.default = router;
