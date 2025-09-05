"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Carrega as variáveis de ambiente do arquivo .env na raiz do backend
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
// Importar as funções do adaptador de dados
const data_1 = require("./data");
const prisma_1 = require("./db/prisma");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Configuração do Multer para upload de imagens
const UPLOADS_DIR = path_1.default.join(__dirname, "public", "uploads");
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// Log para verificar o conteúdo do diretório de uploads
fs_1.default.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
        console.error(`Erro ao ler diretório de uploads ${UPLOADS_DIR}:`, err);
    }
    else {
        console.log(`Conteúdo do diretório de uploads (${UPLOADS_DIR}):`, files);
    }
});
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
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
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Apenas imagens (jpeg, jpg, png, gif) são permitidas."));
    }
});
// Servir arquivos estáticos da pasta 'public'
const publicPath = path_1.default.join(__dirname, "public");
console.log(`Servindo arquivos estáticos de: ${publicPath}`);
app.use(express_1.default.static(publicPath));
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
// --------- ENDPOINTS ---------
// --- Notas do pedido (persistidas em arquivo no dist) ---
const NOTES_FILE = path_1.default.join(__dirname, 'notes.json');
function loadNotesFile() {
    try {
        if (!fs_1.default.existsSync(NOTES_FILE)) {
            fs_1.default.writeFileSync(NOTES_FILE, JSON.stringify({}), 'utf-8');
        }
        const raw = fs_1.default.readFileSync(NOTES_FILE, 'utf-8');
        return JSON.parse(raw || '{}');
    }
    catch (_a) {
        return {};
    }
}
function saveNotesFile(data) {
    fs_1.default.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
app.get('/api/orders/:id/notes', (req, res) => {
    const id = req.params.id;
    const map = loadNotesFile();
    res.json({ notes: map[id] || '' });
});
app.patch('/api/orders/:id/notes', (req, res) => {
    const id = req.params.id;
    const notes = (req.body && req.body.notes) || '';
    if (typeof notes !== 'string') {
        return res.status(400).json({ error: 'validation_failed', message: 'Campo notes deve ser string.' });
    }
    try {
        const map = loadNotesFile();
        map[id] = notes;
        saveNotesFile(map);
        res.json({ success: true, notes });
    }
    catch (e) {
        res.status(500).json({ error: 'server_error', message: (e === null || e === void 0 ? void 0 : e.message) || 'Falha ao salvar notas.' });
    }
});
// KPIs gerais
app.get("/api/overview", async (req, res) => {
    try {
        const stats = await (0, data_1.statsLast14Days)();
        res.json(stats);
    }
    catch (error) {
        console.error("Erro ao obter overview:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter overview." });
    }
});
// Receita por dia (últimos 14)
app.get("/api/revenueByDay", async (req, res) => {
    try {
        const days = (0, data_1.lastNDays)(14);
        const orders = await (0, data_1.listOrders)({});
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
        console.error("Erro ao obter receita por dia:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter receita por dia." });
    }
});
// Pedidos por categoria (últimos 14)
app.get("/api/ordersByCategory", async (req, res) => {
    try {
        const daysSet = new Set((0, data_1.lastNDays)(14));
        const orders = await (0, data_1.listOrders)({});
        const mapCat = new Map();
        for (const o of orders.items) {
            if (!daysSet.has(o.createdAt))
                continue;
            const key = o.category || "Outros";
            mapCat.set(key, (mapCat.get(key) || 0) + 1);
        }
        const result = Array.from(mapCat.entries()).map(([category, value]) => ({ category, value }));
        res.json(result);
    }
    catch (error) {
        console.error("Erro ao obter pedidos por categoria:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter pedidos por categoria." });
    }
});
// Métodos de pagamento (valores em R$) nos últimos 14 dias
app.get("/api/payments", async (req, res) => {
    try {
        const paymentsData = await (0, data_1.paymentsBreakdown)();
        res.json(paymentsData);
    }
    catch (error) {
        console.error("Erro ao obter métodos de pagamento:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter métodos de pagamento." });
    }
});
// Rota para o gráfico de pizza de pagamentos
app.get("/api/payments/breakdown", async (req, res) => {
    try {
        const paymentsData = await (0, data_1.paymentsBreakdown)();
        res.json(paymentsData);
    }
    catch (error) {
        console.error("Erro ao obter breakdown de pagamentos:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter breakdown de pagamentos." });
    }
});
// Conversão diária (pago/total) nos últimos 14 dias
app.get("/api/conversionByDay", async (req, res) => {
    try {
        const days = (0, data_1.lastNDays)(14);
        const orders = await (0, data_1.listOrders)({});
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
        const result = daily.map(d => ({
            date: d.date,
            rate: d.total ? d.paid / d.total : 0
        }));
        res.json(result);
    }
    catch (error) {
        console.error("Erro ao obter conversão por dia:", error);
        res.status(500).json({ error: "Erro interno do servidor ao obter conversão por dia." });
    }
});
// Listagem de pedidos (com filtros e paginação)
app.get("/api/orders", async (req, res) => {
    try {
        const ordersData = await (0, data_1.listOrders)(req.query);
        res.json(ordersData);
    }
    catch (error) {
        console.error("Erro ao listar pedidos:", error);
        res.status(500).json({ error: "Erro interno do servidor ao listar pedidos." });
    }
});
// Detalhe do pedido
app.get("/api/orders/:id", async (req, res) => {
    try {
        const order = await (0, data_1.getOrderById)(req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Pedido não encontrado" });
        }
        res.json(order);
    }
    catch (error) {
        console.error(`Erro ao obter pedido ${req.params.id}:`, error);
        res.status(500).json({ error: "Erro interno do servidor ao obter pedido." });
    }
});
// Endpoint para atualizar um pedido (PATCH)
app.patch("/api/orders/:id", async (req, res) => {
    try {
        const updatedOrder = await (0, data_1.updateOrder)(req.params.id, req.body);
        if (!updatedOrder) {
            return res.status(404).json({ error: "Pedido não encontrado." });
        }
        console.log(`PATCH /api/orders/${req.params.id}: Order updated successfully.`);
        res.json(updatedOrder);
    }
    catch (error) {
        console.error(`Erro ao atualizar pedido ${req.params.id}:`, error);
        const errorMessage = error.message.startsWith('{') ? JSON.parse(error.message) : error.message;
        res.status(400).json({ errors: errorMessage });
    }
});
// Endpoint para criar uma nova landing page
app.post("/api/landings", upload.single('image'), async (req, res) => {
    try {
        const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
        const newLandingPage = await (0, data_1.createLandingPage)({
            productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, imageUrl
        });
        console.log(`POST /api/landings: Landing page created successfully with ID ${newLandingPage.id}.`);
        res.status(201).json(newLandingPage);
    }
    catch (error) {
        console.error("Erro ao criar landing page:", error);
        if (error instanceof multer_1.default.MulterError) {
            return res.status(400).json({ error: error.message });
        }
        const errorMessage = error.message.startsWith('{') ? JSON.parse(error.message) : error.message;
        res.status(400).json({ error: errorMessage || "Erro interno do servidor ao criar landing page." });
    }
});
// Endpoint para listar todas as landing pages
app.get("/api/landings", async (req, res) => {
    console.log('GET /api/landings endpoint hit');
    try {
        console.log('Chamando listLandingPages...');
        const landingPages = await (0, data_1.listLandingPages)();
        console.log(`listLandingPages retornou ${landingPages.length} itens.`);
        res.json(landingPages);
    }
    catch (error) {
        console.error("Erro no endpoint /api/landings:", error);
        res.status(500).json({ error: "Erro interno do servidor ao listar landing pages." });
    }
});
// Endpoint para obter uma landing page específica por slug
app.get("/api/landings/:slug", async (req, res) => {
    try {
        const landingPage = await (0, data_1.getLandingPageBySlug)(req.params.slug);
        if (!landingPage) {
            return res.status(404).json({ error: "Landing Page não encontrada." });
        }
        res.json(landingPage);
    }
    catch (error) {
        console.error(`Erro ao buscar landing page com slug ${req.params.slug}:`, error);
        res.status(500).json({ error: "Erro interno do servidor ao buscar landing page." });
    }
});
// Endpoint para atualizar uma landing page (PUT/PATCH)
app.put("/api/landings/:id", upload.single('image'), async (req, res) => {
    try {
        const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
        const updatedLandingPage = await (0, data_1.updateLandingPage)(req.params.id, {
            productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, imageUrl
        });
        if (!updatedLandingPage) {
            return res.status(404).json({ error: "Landing Page não encontrada." });
        }
        console.log(`PUT /api/landings/${req.params.id}: Landing page updated successfully.`);
        res.json(updatedLandingPage);
    }
    catch (error) {
        console.error("Erro ao atualizar landing page:", error);
        if (error instanceof multer_1.default.MulterError) {
            return res.status(400).json({ error: error.message });
        }
        const errorMessage = error.message.startsWith('{') ? JSON.parse(error.message) : error.message;
        res.status(400).json({ error: errorMessage || "Erro interno do servidor ao atualizar landing page." });
    }
});
// Endpoint para deletar uma landing page
app.delete("/api/landings/:id", async (req, res) => {
    try {
        const deleted = await (0, data_1.deleteLandingPage)(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: "Landing Page não encontrada." });
        }
        console.log(`DELETE /api/landings/${req.params.id}: Landing page deleted successfully.`);
        res.json({ success: true });
    }
    catch (error) {
        console.error("Erro ao deletar landing page:", error);
        res.status(500).json({ error: "Erro interno do servidor ao deletar landing page." });
    }
});
// Endpoint de login simulado
app.post("/api/login", (req, res) => {
    console.log("Recebida requisição de login. Body:", req.body);
    const { username, password } = req.body;
    if (username === "admin" && password === "123") {
        return res.json({ success: true, token: "fake-jwt-token" });
    }
    res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
});
// Endpoint para criar um pedido a partir da landing page pública
app.post("/api/orders/public", async (req, res) => {
    try {
        const { cep, address, addressNumber, complement, district, city, state, email, phone, cpf, birthDay, birthMonth, birthYear, cardName, cardNumber, cardExpiryMonth, cardExpiryYear, cardCvv, productId, productTitle, productPrice, shippingValue, freeShipping, } = req.body;
        // Validações básicas (mais robustas podem ser adicionadas)
        if (!email || !phone || !cpf || !birthDay || !birthMonth || !birthYear ||
            !cardName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv ||
            !cep || !address || !addressNumber || !district || !city || !state ||
            !productId || !productTitle || productPrice === undefined) {
            return res.status(400).json({ error: "Todos os campos obrigatórios do formulário de compra devem ser preenchidos." });
        }
        const newOrderData = {
            status: "pendente",
            category: "Landing Page",
            total_value: Number(productPrice) + (freeShipping ? 0 : Number(shippingValue)),
            paymentMethod: "cartao",
            customer: {
                firstName: cardName.split(' ')[0] || "",
                lastName: cardName.split(' ').slice(1).join(' ') || "",
                email,
                cpf,
                birthdate: `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`,
                phone,
                zip: cep,
                address,
                number: addressNumber,
                complement,
                district,
                city,
                state,
            },
            shipping: {
                method: freeShipping ? "Grátis" : "Padrão",
                postalCode: cep,
                address1: address,
                address2: addressNumber,
                address2_complement: complement,
                district,
                city,
                state,
                value: freeShipping ? 0 : Number(shippingValue),
            },
            items: [
                {
                    sku: productId,
                    name: productTitle,
                    qty: 1,
                    price: Number(productPrice),
                },
            ],
            payments: [
                {
                    method: "Cartão de Crédito",
                    value: Number(productPrice) + (freeShipping ? 0 : Number(shippingValue)),
                },
            ],
            summary: {
                subTotal: Number(productPrice),
                discount: 0,
                shipping: freeShipping ? 0 : Number(shippingValue),
                total: Number(productPrice) + (freeShipping ? 0 : Number(shippingValue)),
            },
            timeline: [
                { label: "Pedido Realizado", date: new Date().toISOString() }
            ]
        };
        const createdOrder = await (0, data_1.createOrder)(newOrderData);
        console.log(`POST /api/orders/public: New order created with ID ${createdOrder.id}.`);
        res.status(201).json({ success: true, orderId: createdOrder.id, message: "Pedido realizado com sucesso!" });
    }
    catch (error) {
        console.error("Erro ao criar pedido público:", error);
        const errorMessage = error.message.startsWith('{') ? JSON.parse(error.message) : error.message;
        res.status(400).json({ error: errorMessage || "Erro interno do servidor ao processar o pedido." });
    }
});
// Healthcheck simples
app.get("/api/health", (_req, res) => res.json({ ok: true }));
async function runSeedIfNeeded() {
    const orderCount = await prisma_1.prisma.order.count();
    if (orderCount > 0) {
        console.log('Banco de dados já populado. Seed não será executado.');
        return;
    }
    console.log('Banco de dados vazio. Executando seed...');
    try {
        // 1. Criar 2 Landing Pages
        await prisma_1.prisma.landingPage.createMany({
            data: [
                {
                    slug: 'produto-essencial-1',
                    title: 'Creme Hidratante Facial Profundo',
                    brand: 'DermoSkin',
                    description: 'Hidratação intensa por 24 horas com ácido hialurônico e vitaminas.',
                    price: 18990, // R$ 189,90
                    freeShipping: true,
                    shippingPrice: 0,
                    imageUrl: '/uploads/image-1756175127270-163477494.jpeg',
                },
                {
                    slug: 'serum-rejuvenescedor-2',
                    title: 'Sérum Rejuvenescedor Noite',
                    brand: 'GlowUp',
                    description: 'Combate os sinais de envelhecimento enquanto você dorme.',
                    price: 29990, // R$ 299,90
                    freeShipping: false,
                    shippingPrice: 1500, // R$ 15,00
                    imageUrl: '/uploads/image-1756179009162-130769266.jpeg',
                },
            ],
            skipDuplicates: true,
        });
        console.log('Landing pages criadas.');
        // 2. Criar 4 Pedidos com Clientes, Endereços e Pagamentos
        for (let i = 0; i < 4; i++) {
            const customer = await prisma_1.prisma.customer.create({
                data: {
                    firstName: pt_BR_1.faker.person.firstName(),
                    lastName: pt_BR_1.faker.person.lastName(),
                    email: pt_BR_1.faker.internet.email({ firstName: `test_${i}` }),
                    phone: pt_BR_1.faker.phone.number(),
                    cpf: `${pt_BR_1.faker.string.numeric(3)}.${pt_BR_1.faker.string.numeric(3)}.${pt_BR_1.faker.string.numeric(3)}-${pt_BR_1.faker.string.numeric(2)}`,
                    birthDate: pt_BR_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
                    addresses: {
                        create: {
                            cep: pt_BR_1.faker.location.zipCode(),
                            street: pt_BR_1.faker.location.street(),
                            number: pt_BR_1.faker.location.buildingNumber(),
                            complement: pt_BR_1.faker.location.secondaryAddress(),
                            district: pt_BR_1.faker.location.streetAddress().split(',')[1]?.trim() || 'Centro',
                            city: pt_BR_1.faker.location.city(),
                            state: pt_BR_1.faker.location.state({ abbreviated: true }),
                        },
                    },
                },
            });
            const paymentMethod = pt_BR_1.faker.helpers.arrayElement(['cartao', 'pix', 'boleto']);
            const orderStatus = paymentMethod === 'boleto' && i % 2 === 0
                ? 'pendente'
                : pt_BR_1.faker.helpers.arrayElement(['pago', 'enviado']);
            const paymentStatus = orderStatus === 'pago' || orderStatus === 'enviado' ? 'confirmado' : 'pendente';
            const itemPrice = pt_BR_1.faker.number.int({ min: 8000, max: 25000 });
            const qty = pt_BR_1.faker.number.int({ min: 1, max: 2 });
            const totalAmount = itemPrice * qty;
            await prisma_1.prisma.order.create({
                data: {
                    customerId: customer.id,
                    status: orderStatus,
                    category: pt_BR_1.faker.helpers.arrayElement(['Skincare', 'Maquiagem', 'Cabelo']),
                    totalAmount: totalAmount,
                    createdAt: pt_BR_1.faker.date.recent({ days: 14 }),
                    items: {
                        create: {
                            sku: pt_BR_1.faker.string.alphanumeric(10).toUpperCase(),
                            name: pt_BR_1.faker.commerce.productName(),
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
    }
    catch (error) {
        console.error("Falha ao executar o seed no boot:", error);
        // Em caso de erro, deletar dados para permitir nova tentativa na próxima inicialização
        await prisma_1.prisma.order.deleteMany();
        await prisma_1.prisma.customer.deleteMany();
        await prisma_1.prisma.landingPage.deleteMany();
        console.log('Dados do seed removidos após falha.');
    }
}
// Start
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    runSeedIfNeeded().catch(e => {
        console.error("Falha ao executar o seed no boot:", e);
    });
});
