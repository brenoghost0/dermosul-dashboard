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
const api_js_1 = __importDefault(require("./api.js")); // Importa o router centralizado
const prisma_1 = require("./db/prisma");
const pt_BR_1 = require("@faker-js/faker/locale/pt_BR");
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
// Servir arquivos estáticos da pasta 'public'
const publicPath = path.join(__dirname, "public");
console.log(`Servindo arquivos estáticos de: ${publicPath}`);
app.use(express_1.default.static(publicPath));
app.use('/uploads', express_1.default.static(UPLOADS_DIR));
// --------- ENDPOINTS ---------
// USA O ROUTER CENTRALIZADO PARA TODAS AS ROTAS DA API
app.use("/api", api_js_1.default);
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
                    id: pt_BR_1.faker.string.uuid(),
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
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    runSeedIfNeeded().catch(e => {
        console.error("Falha ao executar o seed no boot:", e);
    });
});
