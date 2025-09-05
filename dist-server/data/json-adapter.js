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
exports.initializeJsonAdapter = initializeJsonAdapter;
exports.listOrders = listOrders;
exports.getOrderById = getOrderById;
exports.createOrder = createOrder;
exports.updateOrder = updateOrder;
exports.statsLast14Days = statsLast14Days;
exports.paymentsBreakdown = paymentsBreakdown;
exports.listLandingPages = listLandingPages;
exports.createLandingPage = createLandingPage;
exports.updateLandingPage = updateLandingPage;
exports.deleteLandingPage = deleteLandingPage;
exports.getLandingPageBySlug = getLandingPageBySlug;
// backend/data/json-adapter.ts
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const utils_1 = require("../utils"); // Importar utilitários
const DB_PATH = path.join(__dirname, '..', '..', 'db.json');
let db = {
    orders: [],
    landingPages: [],
    customers: [],
    products: [],
};
let isInitialized = false;
let writeLock = false;
// --- Funções Utilitárias ---
// toISO, lastNDays, generateUniqueId, generateSlug agora vêm de ../utils
function mapOrder(o) {
    const first = o?.customer?.firstName || "";
    const last = o?.customer?.lastName || "";
    const mappedOrder = {
        id: String(o?.id ?? ""),
        order_date: o?.order_date ? (0, utils_1.toISO)(o.order_date) : (0, utils_1.toISO)(new Date()),
        status: o?.status || "pendente",
        category: o?.category || "Outros",
        total_value: Number(o?.total_value ?? 0),
        paymentMethod: ["pix", "cartao", "boleto"].includes(o?.paymentMethod) ? o.paymentMethod : "desconhecido",
        customer: o.customer ? {
            id: o.customer.id || (0, utils_1.generateUniqueId)(),
            firstName: o.customer.firstName || "",
            lastName: o.customer.lastName || "",
            cpf: o.customer.cpf || "",
            birthDate: o.customer.birthDate || "", // Usar birthDate para consistência com Prisma
            email: o.customer.email || "",
            phone: o.customer.phone || "",
            zip: o.customer.zip || "",
            address: o.customer.address || "",
            number: o.customer.number || "",
            complement: o.customer.complement || "",
            district: o.customer.district || "",
            city: o.customer.city || "",
            state: o.customer.state || "",
        } : {
            id: (0, utils_1.generateUniqueId)(),
            firstName: "", lastName: "", cpf: "", birthDate: "", email: "", phone: "",
            zip: "", address: "", number: "", complement: "", district: "", city: "", state: ""
        },
        shipping: o.shipping ? {
            method: o.shipping.method || "Padrão",
            postalCode: o.shipping.zip || "",
            address1: o.shipping.address || "",
            address2: o.shipping.number || "",
            address2_complement: o.shipping.complement || "",
            district: o.shipping.district || "",
            city: o.shipping.city || "",
            state: o.shipping.state || "",
            value: Number(o.shipping.value || 0)
        } : {
            method: "Padrão", postalCode: "", address1: "", address2: "", address2_complement: "",
            district: "", city: "", state: "", value: 0
        },
        items: Array.isArray(o?.items) ? o.items.map((item) => ({
            sku: item.sku || "",
            name: item.name || "Produto",
            qty: Number(item.qty || 0),
            price: Number(item.price || 0),
            subtotal: Number(item.qty || 0) * Number(item.price || 0),
        })) : [],
        payments: Array.isArray(o?.payments) ? o.payments.map((payment) => ({
            method: payment.method || "desconhecido",
            value: Number(payment.value || 0),
            status: payment.status || "pendente",
            installments: Number(payment.installments || 1),
            paidAmount: Number(payment.paidAmount || 0),
        })) : [{ method: "desconhecido", value: 0, status: "pendente", installments: 1, paidAmount: 0 }],
        summary: o?.summary ? {
            subTotal: Number(o.summary.subTotal || 0),
            itemsTotal: Number(o.summary.itemsTotal || o.summary.subTotal || 0),
            shipping: Number(o.summary.shipping || 0),
            discount: Number(o.summary.discount || 0),
            total: Number(o.summary.total || 0),
            grandTotal: Number(o.summary.grandTotal || o.summary.total || 0),
        } : { subTotal: 0, itemsTotal: 0, shipping: 0, discount: 0, total: 0, grandTotal: 0 },
        timeline: o?.timeline || [],
        _raw: o,
        createdAt: o?.order_date ? (0, utils_1.toISO)(o.order_date) : (0, utils_1.toISO)(new Date()),
        client: `${first}${first && last ? " " : ""}${last}`.trim() || "Cliente",
        clientInfo: o?.customer ? { name: `${first} ${last}`.trim(), email: o.customer.email, phone: o.customer.phone } : { name: "Cliente", email: "", phone: "" },
        total: Number(o?.total_value ?? 0),
    };
    return mappedOrder;
}
// --- Funções de Validação ---
const isValidCpf = (cpf) => /^\d{11}$/.test(cpf);
const isValidDate = (dateString) => {
    if (!dateString)
        return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};
const validateOrder = (order) => {
    const errors = {};
    const validStatuses = ["pago", "pendente", "cancelado", "enviado"];
    if (!order.status || !validStatuses.includes(order.status)) {
        errors.status = "Status inválido.";
    }
    if (!order.clientInfo) {
        errors.clientInfo = "Informações do cliente são obrigatórias.";
    }
    else {
        if (!order.clientInfo.name || order.clientInfo.name.trim() === "") {
            errors.clientInfo_name = "Nome do cliente é obrigatório.";
        }
        if (!order.clientInfo.email || !/\S+@\S+\.\S+/.test(order.clientInfo.email)) {
            errors.clientInfo_email = "Email do cliente é inválido.";
        }
        if (!order.clientInfo.phone || !/^\d{10,11}$/.test(order.clientInfo.phone.replace(/\D/g, ''))) {
            errors.clientInfo_phone = "Telefone do cliente é inválido (apenas números, 10 ou 11 dígitos).";
        }
    }
    if (!order.shipping) {
        errors.shipping = "Informações de endereço são obrigatórias.";
    }
    else {
        if (!order.shipping.postalCode || !/^\d{8}$/.test(order.shipping.postalCode.replace(/\D/g, ''))) {
            errors.shipping_postalCode = "CEP inválido (apenas números, 8 dígitos).";
        }
        if (!order.shipping.address1 || order.shipping.address1.trim() === "") {
            errors.shipping_address1 = "Rua é obrigatória.";
        }
        if (!order.shipping.address2 || order.shipping.address2.trim() === "") {
            errors.shipping_address2 = "Número é obrigatório.";
        }
        if (!order.shipping.district || order.shipping.district.trim() === "") {
            errors.shipping_district = "Bairro é obrigatório.";
        }
        if (!order.shipping.city || order.shipping.city.trim() === "") {
            errors.shipping_city = "Cidade é obrigatória.";
        }
        if (!order.shipping.state || order.shipping.state.trim() === "") {
            errors.shipping_state = "Estado é obrigatório.";
        }
    }
    if (order.customer) {
        if (!order.customer.cpf || !isValidCpf(order.customer.cpf.replace(/\D/g, ''))) {
            errors.customer_cpf = "CPF inválido (11 dígitos numéricos).";
        }
        if (!order.customer.birthDate || !isValidDate(order.customer.birthDate)) { // Corrigido para birthDate
            errors.customer_birthdate = "Data de nascimento inválida.";
        }
    }
    else {
        errors.customer = "Informações de cliente (CPF, Nascimento) são obrigatórias.";
    }
    return errors;
};
// --- Funções de Carregamento/Salvamento do DB ---
function initializeJsonAdapter() {
    if (!isInitialized) {
        try {
            const raw = fs.readFileSync(DB_PATH, "utf-8");
            db = JSON.parse(raw);
            isInitialized = true;
            console.log("DB carregado em memória.");
        }
        catch (error) {
            console.error("Erro ao carregar db.json, inicializando com dados vazios:", error.message);
            db = { orders: [], landingPages: [], customers: [], products: [] };
            isInitialized = true;
            saveDB(db); // Salva o DB vazio para garantir que o arquivo exista
        }
    }
}
function loadDB() {
    if (!isInitialized) {
        initializeJsonAdapter(); // Garante que o DB seja carregado se não estiver
    }
    return db;
}
async function saveDB(data) {
    while (writeLock) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    writeLock = true;
    try {
        const tmpPath = DB_PATH + '.tmp';
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
        fs.renameSync(tmpPath, DB_PATH);
        db = data;
    }
    catch (error) {
        console.error("Erro ao salvar db.json:", error.message);
        throw error;
    }
    finally {
        writeLock = false;
    }
}
// --- Funções do Adaptador de Dados ---
async function listOrders(params) {
    const { status, category, dateFrom, dateTo, sort, page = "1", pageSize = "20" } = params;
    const currentDb = loadDB();
    let items = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];
    if (status) {
        items = items.filter(o => String(o.status).toLowerCase() === String(status).toLowerCase());
    }
    if (category) {
        items = items.filter(o => String(o.category).toLowerCase() === String(category).toLowerCase());
    }
    if (dateFrom) {
        const f = (0, utils_1.toISO)(dateFrom);
        items = items.filter(o => o.createdAt && o.createdAt >= f);
    }
    if (dateTo) {
        const t = (0, utils_1.toISO)(dateTo);
        items = items.filter(o => o.createdAt && o.createdAt <= t);
    }
    if (sort) {
        const [field, order] = String(sort).split(",");
        const dir = order === "desc" ? -1 : 1;
        items.sort((a, b) => {
            const av = a[field];
            const bv = b[field];
            if (typeof av === "number" && typeof bv === "number")
                return (av - bv) * dir;
            return String(av).localeCompare(String(bv)) * dir;
        });
    }
    else {
        items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.max(parseInt(pageSize, 10) || 20, 1);
    const total = items.length;
    const start = (p - 1) * ps;
    const paginated = items.slice(start, start + ps);
    return {
        items: paginated,
        total,
        page: p,
        pageSize: ps,
        totalPages: Math.max(Math.ceil(total / ps), 1)
    };
}
async function getOrderById(id) {
    const currentDb = loadDB();
    const found = Array.isArray(currentDb.orders) ? currentDb.orders.find(o => String(o.id) === String(id)) : null;
    return found ? mapOrder(found) : null;
}
async function createOrder(orderData) {
    const currentDb = loadDB();
    const newOrderId = (0, utils_1.generateUniqueId)();
    const orderDate = (0, utils_1.toISO)(new Date());
    const newOrder = {
        id: newOrderId,
        order_date: orderDate,
        status: orderData.status || "pendente",
        category: orderData.category || "Outros",
        total_value: Number(orderData.total_value || 0),
        paymentMethod: orderData.paymentMethod || "desconhecido",
        customer: {
            id: (0, utils_1.generateUniqueId)(),
            firstName: orderData.customer?.firstName || "",
            lastName: orderData.customer?.lastName || "",
            email: orderData.customer?.email || "",
            cpf: orderData.customer?.cpf || "",
            birthDate: orderData.customer?.birthdate ? (0, utils_1.toISO)(orderData.customer.birthdate) : "",
            phone: orderData.customer?.phone || "",
            zip: orderData.customer?.zip || "",
            address: orderData.customer?.address || "",
            number: orderData.customer?.number || "",
            complement: orderData.customer?.complement || "",
            district: orderData.customer?.district || "",
            city: orderData.customer?.city || "",
            state: orderData.customer?.state || "",
        },
        shipping: {
            method: orderData.shipping?.method || "Padrão",
            postalCode: orderData.shipping?.postalCode || "", // Mapeado de frontend
            address1: orderData.shipping?.address1 || "", // Mapeado de frontend
            address2: orderData.shipping?.address2 || "", // Mapeado de frontend
            address2_complement: orderData.shipping?.address2_complement || "", // Mapeado de frontend
            district: orderData.shipping?.district || "",
            city: orderData.shipping?.city || "",
            state: orderData.shipping?.state || "",
            value: Number(orderData.shipping?.value || 0), // Adicionado para satisfazer a interface Shipping
        },
        items: Array.isArray(orderData.items) ? orderData.items.map((item) => ({
            sku: item.sku || "",
            name: item.name || "Produto",
            qty: Number(item.qty || 0),
            price: Number(item.price || 0),
        })) : [],
        payments: Array.isArray(orderData.payments) ? orderData.payments.map((payment) => ({
            method: payment.method || "desconhecido",
            value: Number(payment.value || 0),
        })) : [],
        summary: {
            subTotal: Number(orderData.summary?.subTotal || 0),
            discount: Number(orderData.summary?.discount || 0),
            shipping: Number(orderData.summary?.shipping || 0),
            total: Number(orderData.summary?.total || 0),
        },
        timeline: Array.isArray(orderData.timeline) ? orderData.timeline : [{ label: "Pedido Criado", date: new Date().toISOString() }]
    };
    const validationErrors = validateOrder(mapOrder(newOrder));
    if (Object.keys(validationErrors).length > 0) {
        throw new Error(JSON.stringify(validationErrors));
    }
    currentDb.orders.push(newOrder);
    await saveDB(currentDb);
    return mapOrder(newOrder);
}
async function updateOrder(id, updatedFields) {
    const currentDb = loadDB();
    const orderIndex = currentDb.orders.findIndex(o => String(o.id) === String(id));
    if (orderIndex === -1) {
        return null;
    }
    let existingOrder = currentDb.orders[orderIndex];
    const newCustomerData = {
        ...existingOrder.customer,
        firstName: updatedFields.customer?.firstName || existingOrder.customer?.firstName,
        lastName: updatedFields.customer?.lastName || existingOrder.customer?.lastName,
        cpf: updatedFields.customer?.cpf || existingOrder.customer?.cpf,
        birthDate: updatedFields.customer?.birthdate ? (0, utils_1.toISO)(updatedFields.customer.birthdate) : existingOrder.customer?.birthDate,
        email: updatedFields.customer?.email || existingOrder.customer?.email,
        phone: updatedFields.customer?.phone || existingOrder.customer?.phone,
        zip: updatedFields.shipping?.postalCode || existingOrder.customer?.zip,
        address: updatedFields.shipping?.address1 || existingOrder.customer?.address,
        number: updatedFields.shipping?.address2 || existingOrder.customer?.number,
        complement: updatedFields.shipping?.address2_complement || existingOrder.customer?.complement,
        district: updatedFields.shipping?.district || existingOrder.customer?.district,
        city: updatedFields.shipping?.city || existingOrder.customer?.city,
        state: updatedFields.shipping?.state || existingOrder.customer?.state,
    };
    const newShippingData = {
        ...existingOrder.shipping,
        postalCode: updatedFields.shipping?.postalCode || existingOrder.shipping?.postalCode,
        address1: updatedFields.shipping?.address1 || existingOrder.shipping?.address1,
        address2: updatedFields.shipping?.address2 || existingOrder.shipping?.address2,
        address2_complement: updatedFields.shipping?.address2_complement || existingOrder.shipping?.address2_complement,
        district: updatedFields.shipping?.district || existingOrder.shipping?.district,
        city: updatedFields.shipping?.city || existingOrder.shipping?.city,
        state: updatedFields.shipping?.state || existingOrder.shipping?.state,
        value: Number(updatedFields.shipping?.value || existingOrder.shipping?.value || 0), // Adicionado para satisfazer a interface Shipping
    };
    const mergedOrder = {
        ...existingOrder,
        status: updatedFields.status || existingOrder.status,
        customer: newCustomerData,
        shipping: newShippingData,
        total_value: updatedFields.total || existingOrder.total_value,
        category: updatedFields.category || existingOrder.category,
        order_date: updatedFields.createdAt ? (0, utils_1.toISO)(updatedFields.createdAt) : existingOrder.order_date,
        paymentMethod: ["pix", "cartao", "boleto"].includes(updatedFields.paymentMethod) ? updatedFields.paymentMethod : existingOrder.paymentMethod
    };
    const validationErrors = validateOrder(mapOrder(mergedOrder));
    if (Object.keys(validationErrors).length > 0) {
        throw new Error(JSON.stringify(validationErrors));
    }
    currentDb.orders[orderIndex] = mergedOrder;
    await saveDB(currentDb);
    return mapOrder(mergedOrder);
}
async function statsLast14Days() {
    const currentDb = loadDB();
    const orders = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];
    const windowDays = 14;
    const windowSet = new Set((0, utils_1.lastNDays)(windowDays));
    let totalRevenue = 0;
    let totalOrders = 0;
    let paidOrders = 0;
    for (const o of orders) {
        if (!o.createdAt || !windowSet.has(o.createdAt))
            continue;
        totalOrders += 1;
        totalRevenue += (o.total ?? 0); // Usar nullish coalescing operator
        if (o.status === "pago")
            paidOrders += 1;
    }
    const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
    const convAvg = totalOrders ? (paidOrders / totalOrders) * 100 : 0;
    return {
        totalRevenue,
        totalOrders,
        avgTicket,
        convAvg
    };
}
async function paymentsBreakdown() {
    const currentDb = loadDB();
    const orders = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];
    const daysSet = new Set((0, utils_1.lastNDays)(14));
    const agg = new Map();
    for (const o of orders) {
        if (!o.createdAt || !daysSet.has(o.createdAt) || o.status !== 'pago')
            continue;
        const key = o.paymentMethod || "desconhecido";
        agg.set(key, (agg.get(key) || 0) + (o.total ?? 0)); // Usar nullish coalescing operator
    }
    const result = Array.from(agg.entries()).map(([method, value]) => ({ method, value }));
    return {
        payments: result,
        from: (0, utils_1.lastNDays)(14)[0],
        to: (0, utils_1.lastNDays)(14)[13]
    };
}
async function listLandingPages() {
    const currentDb = loadDB();
    const landingPages = Array.isArray(currentDb.landingPages) ? currentDb.landingPages : [];
    landingPages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return landingPages;
}
async function createLandingPage(data) {
    const currentDb = loadDB();
    if (!data.productTitle || data.productTitle.trim() === "") {
        throw new Error("Título do produto é obrigatório.");
    }
    if (!data.productBrand || data.productBrand.trim() === "") {
        throw new Error("Marca é obrigatória.");
    }
    if (data.productPrice === undefined || isNaN(Number(data.productPrice))) {
        throw new Error("Preço do produto é obrigatório e deve ser um número.");
    }
    if (!Boolean(data.freeShipping) && (data.shippingValue === undefined || isNaN(Number(data.shippingValue)))) {
        throw new Error("Valor do frete é obrigatório quando frete grátis não está marcado.");
    }
    const id = (0, utils_1.generateUniqueId)();
    const slug = await (0, utils_1.generateSlug)(data.productTitle);
    const fullShippingValue = Boolean(data.freeShipping) ? 0 : Number(data.shippingValue);
    const newLandingPage = {
        id,
        slug,
        productImage: data.imageUrl,
        productTitle: data.productTitle,
        productDescription: data.productDescription || "",
        productBrand: data.productBrand,
        productPrice: Number(data.productPrice),
        shippingValue: fullShippingValue,
        freeShipping: Boolean(data.freeShipping),
        url: `/l/${slug}`,
        createdAt: new Date().toISOString(),
    };
    if (!currentDb.landingPages) {
        currentDb.landingPages = [];
    }
    currentDb.landingPages.push(newLandingPage);
    await saveDB(currentDb);
    return newLandingPage;
}
async function updateLandingPage(id, data) {
    const currentDb = loadDB();
    const landingPageIndex = currentDb.landingPages.findIndex(lp => String(lp.id) === String(id));
    if (landingPageIndex === -1) {
        return null;
    }
    let existingLandingPage = currentDb.landingPages[landingPageIndex];
    if (!data.productTitle || data.productTitle.trim() === "") {
        throw new Error("Título do produto é obrigatório.");
    }
    if (!data.productBrand || data.productBrand.trim() === "") {
        throw new Error("Marca é obrigatória.");
    }
    if (data.productPrice === undefined || isNaN(Number(data.productPrice)) || Number(data.productPrice) <= 0) {
        throw new Error("Preço do produto é obrigatório e deve ser um número positivo.");
    }
    if (!Boolean(data.freeShipping) && (data.shippingValue === undefined || isNaN(Number(data.shippingValue)) || Number(data.shippingValue) < 0)) {
        throw new Error("Valor do frete é obrigatório e deve ser um número não negativo quando o frete grátis não está marcado.");
    }
    const updatedLandingPage = {
        ...existingLandingPage,
        productImage: data.imageUrl || existingLandingPage.productImage,
        productTitle: data.productTitle,
        productDescription: data.productDescription || "",
        productBrand: data.productBrand,
        productPrice: Number(data.productPrice),
        shippingValue: Boolean(data.freeShipping) ? 0 : Number(data.shippingValue),
        freeShipping: Boolean(data.freeShipping),
        updatedAt: new Date().toISOString(),
    };
    if (data.productTitle !== existingLandingPage.productTitle) {
        updatedLandingPage.slug = await (0, utils_1.generateSlug)(data.productTitle);
        updatedLandingPage.url = `/l/${updatedLandingPage.slug}`;
    }
    currentDb.landingPages[landingPageIndex] = updatedLandingPage;
    await saveDB(currentDb);
    return updatedLandingPage;
}
async function deleteLandingPage(id) {
    const currentDb = loadDB();
    const initialLength = currentDb.landingPages.length;
    currentDb.landingPages = currentDb.landingPages.filter(lp => String(lp.id) !== String(id));
    if (currentDb.landingPages.length === initialLength) {
        return false;
    }
    await saveDB(currentDb);
    return true;
}
async function getLandingPageBySlug(slug) {
    const currentDb = loadDB();
    const found = Array.isArray(currentDb.landingPages) ? currentDb.landingPages.find(lp => lp.slug === slug) : null;
    return found || null;
}
// Inicializa o DB ao carregar o módulo
initializeJsonAdapter();
