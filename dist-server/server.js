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
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const express_session_1 = __importDefault(require("express-session"));
// Import sem extensão para funcionar bem após transpilar para dist/ (CJS)
const api_1 = __importDefault(require("./api")); // Importa o router centralizado
const prisma_1 = require("./db/prisma");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
const utils_1 = require("./utils");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Configuração da sessão
app.use((0, express_session_1.default)({
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
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
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
app.use(express_1.default.static(frontendPath));
// Servir uploads
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
// --------- ENDPOINTS ---------
// USA O ROUTER CENTRALIZADO PARA TODAS AS ROTAS DA API
app.use("/api", api_1.default);
// Healthcheck simples
app.get("/api/health", (_req, res) => res.json({ ok: true }));
// --- Fallback das rotas de notas (garante funcionamento mesmo que apiRouter não tenha recarregado) ---
const NOTES_FILE = path.join(process.cwd(), 'backend', 'notes.json');
function loadNotesFile() {
    try {
        if (!fs_1.default.existsSync(NOTES_FILE)) {
            fs_1.default.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
            fs_1.default.writeFileSync(NOTES_FILE, JSON.stringify({}), 'utf-8');
        }
        const raw = fs_1.default.readFileSync(NOTES_FILE, 'utf-8');
        return JSON.parse(raw || '{}');
    }
    catch {
        return {};
    }
}
function saveNotesFile(data) {
    fs_1.default.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
app.get('/api/orders/:id/notes', (req, res) => {
    const id = req.params.id;
    const notesMap = loadNotesFile();
    res.json({ notes: notesMap[id] || '' });
});
app.use(express_1.default.json());
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
        res.status(500).json({ error: 'server_error', message: e?.message || 'Falha ao salvar notas.' });
    }
});
// Fallback para o index.html do frontend (para rotas de SPA)
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).send('Frontend não encontrado. Execute `npm run build`.');
    }
});
const bcrypt_1 = __importDefault(require("bcrypt"));
async function runSeedIfNeeded() {
    // Garante que o usuário admin exista
    const userCount = await prisma_1.prisma.user.count();
    if (userCount === 0) {
        console.log('Nenhum usuário admin encontrado, criando um...');
        const passwordHash = await bcrypt_1.default.hash('123', 10);
        await prisma_1.prisma.user.create({
            data: {
                username: 'admin',
                passwordHash,
                name: 'Administrador',
                email: 'admin@example.com',
            },
        });
        console.log('Usuário "admin" / senha "123" criado.');
    }
    const orderCount = await prisma_1.prisma.order.count();
    if (orderCount > 0) {
        console.log('Banco de dados já populado com pedidos. Seed de pedidos não será executado.');
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
                    imageUrl: pt_BR_1.faker.image.urlLoremFlickr({ category: 'cosmetics' }),
                },
                {
                    slug: 'serum-rejuvenescedor-2',
                    title: 'Sérum Rejuvenescedor Noite',
                    brand: 'GlowUp',
                    description: 'Combate os sinais de envelhecimento enquanto você dorme.',
                    price: 29990, // R$ 299,90
                    freeShipping: false,
                    shippingPrice: 1500, // R$ 15,00
                    imageUrl: pt_BR_1.faker.image.urlLoremFlickr({ category: 'beauty' }),
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
            const customer = await prisma_1.prisma.customer.create({
                data: {
                    firstName: pt_BR_1.faker.person.firstName(),
                    lastName: pt_BR_1.faker.person.lastName(),
                    email: pt_BR_1.faker.internet.email({ firstName: `test_${i}` }),
                    phone: (() => {
                        const ddd = '11';
                        const rest8 = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
                        const digits = `${ddd}9${rest8}`;
                        return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}${digits.slice(3, 7)}-${digits.slice(7)}`;
                    })(),
                    cpf: `${pt_BR_1.faker.string.numeric(3)}.${pt_BR_1.faker.string.numeric(3)}.${pt_BR_1.faker.string.numeric(3)}-${pt_BR_1.faker.string.numeric(2)}`,
                    birthDate: pt_BR_1.faker.date.birthdate({ min: 18, max: 65, mode: 'age' }).toISOString().split('T')[0],
                    addresses: {
                        create: {
                            cep: rc.cep,
                            street: pt_BR_1.faker.location.street(),
                            number: pt_BR_1.faker.location.buildingNumber(),
                            complement: pt_BR_1.faker.location.secondaryAddress(),
                            district: pt_BR_1.faker.location.streetAddress().split(',')[1]?.trim() || 'Centro',
                            city: rc.city,
                            state: rc.state,
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
                    id: (0, utils_1.generateShortId)(),
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
const PORT = parseInt(process.env.PORT || '3003', 10);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend listening on http://0.0.0.0:${PORT}`);
    runSeedIfNeeded().catch(e => {
        console.error("Falha ao executar o seed no boot:", e);
    });
});
