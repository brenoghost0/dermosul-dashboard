// backend/data/json-adapter.ts
import * as fs from 'fs';
import * as path from 'path';
import { toISO, lastNDays, generateUniqueId, generateSlug } from '../utils'; // Importar utilitários

// --- Interfaces ---
interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string; // Corrigido para birthDate
  zip: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

interface Shipping {
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

interface Item {
  sku: string;
  name: string;
  qty: number;
  price: number;
  subtotal?: number;
}

interface Payment {
  method: string;
  value: number;
  status?: string;
  installments?: number;
  paidAmount?: number;
}

interface Summary {
  subTotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemsTotal?: number;
  grandTotal?: number;
}

interface TimelineEvent {
  label: string;
  date: string;
}

interface Order {
  id: string;
  order_date: string;
  status: "pago" | "aguardando_pagamento" | "pendente" | "cancelado" | "enviado";
  category: string;
  total_value: number;
  paymentMethod: "pix" | "cartao" | "boleto" | "desconhecido";
  customer: Customer;
  shipping: Shipping;
  items: Item[];
  payments: Payment[];
  summary: Summary;
  timeline: TimelineEvent[];
  createdAt?: string;
  client?: string;
  clientInfo?: { name: string; email: string; phone: string };
  total?: number;
  _raw?: any;
}

interface LandingPage {
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

interface DB {
  orders: Order[];
  landingPages: LandingPage[];
  customers: any[];
  products: any[];
}

const DB_PATH = path.join(__dirname, '..', '..', 'db.json');

let db: DB = {
  orders: [],
  landingPages: [],
  customers: [],
  products: [],
};
let isInitialized = false;
let writeLock = false;

// --- Funções Utilitárias ---
// toISO, lastNDays, generateUniqueId, generateSlug agora vêm de ../utils

function mapOrder(o: any): Order {
  const first = o?.customer?.firstName || "";
  const last = o?.customer?.lastName || "";
  const mappedOrder: Order = {
    id: String(o?.id ?? ""),
    order_date: o?.order_date ? toISO(o.order_date) : toISO(new Date()),
    status: o?.status || "aguardando_pagamento",
    category: o?.category || "Outros",
    total_value: Number(o?.total_value ?? 0),
    paymentMethod: ["pix", "cartao", "boleto"].includes(o?.paymentMethod) ? o.paymentMethod : "desconhecido",
    customer: o.customer ? {
      id: o.customer.id || generateUniqueId(),
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
      id: generateUniqueId(),
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
    items: Array.isArray(o?.items) ? o.items.map((item: any) => ({
      sku: item.sku || "",
      name: item.name || "Produto",
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
      subtotal: Number(item.qty || 0) * Number(item.price || 0),
    })) : [],
    payments: Array.isArray(o?.payments) ? o.payments.map((payment: any) => ({
      method: payment.method || "desconhecido",
      value: Number(payment.value || 0),
      status: payment.status || "pendente",
      installments: Number(payment.installments || 1),
      paidAmount: Number(payment.paidAmount || 0),
    })) : [{ method: "desconhecido", value: 0, status: "aguardando_pagamento", installments: 1, paidAmount: 0 }],
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
    createdAt: o?.order_date ? toISO(o.order_date) : toISO(new Date()),
    client: `${first}${first && last ? " " : ""}${last}`.trim() || "Cliente",
    clientInfo: o?.customer ? { name: `${first} ${last}`.trim(), email: o.customer.email, phone: o.customer.phone } : { name: "Cliente", email: "", phone: "" },
    total: Number(o?.total_value ?? 0),
  };
  return mappedOrder;
}

// --- Funções de Validação ---
const isValidCpf = (cpf: string): boolean => /^\d{11}$/.test(cpf);
const isValidDate = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
};

interface OrderValidationErrors {
  status?: string;
  clientInfo?: string;
  clientInfo_name?: string;
  clientInfo_email?: string;
  clientInfo_phone?: string;
  shipping?: string;
  shipping_postalCode?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_district?: string;
  shipping_city?: string;
  shipping_state?: string;
  customer?: string;
  customer_cpf?: string;
  customer_birthdate?: string;
  paymentMethod?: string;
}

const validateOrder = (order: Order): OrderValidationErrors => {
    const errors: OrderValidationErrors = {};

    const validStatuses = ["pago", "aguardando_pagamento", "pendente", "cancelado", "enviado"];
    if (!order.status || !validStatuses.includes(order.status)) {
        errors.status = "Status inválido.";
    }

    if (!order.clientInfo) {
        errors.clientInfo = "Informações do cliente são obrigatórias.";
    } else {
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
    } else {
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
    } else {
        errors.customer = "Informações de cliente (CPF, Nascimento) são obrigatórias.";
    }

    return errors;
};

// --- Funções de Carregamento/Salvamento do DB ---

export function initializeJsonAdapter() {
  if (!isInitialized) {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      db = JSON.parse(raw);
      isInitialized = true;
      console.log("DB carregado em memória.");
    } catch (error: any) {
      console.error("Erro ao carregar db.json, inicializando com dados vazios:", error.message);
      db = { orders: [], landingPages: [], customers: [], products: [] };
      isInitialized = true;
      saveDB(db); // Salva o DB vazio para garantir que o arquivo exista
    }
  }
}

function loadDB(): DB {
  if (!isInitialized) {
    initializeJsonAdapter(); // Garante que o DB seja carregado se não estiver
  }
  return db;
}

async function saveDB(data: DB): Promise<void> {
  while (writeLock) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  writeLock = true;
  try {
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, DB_PATH);
    db = data;
  } catch (error: any) {
    console.error("Erro ao salvar db.json:", error.message);
    throw error;
  } finally {
    writeLock = false;
  }
}

// --- Funções do Adaptador de Dados ---

export async function listOrders(params: any): Promise<any> {
  const {
    status,
    category,
    dateFrom,
    dateTo,
    sort,
    page = "1",
    pageSize = "20"
  } = params;

  const currentDb = loadDB();
  let items: Order[] = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];

  if (status) {
    items = items.filter(o => String(o.status).toLowerCase() === String(status).toLowerCase());
  }
  if (category) {
    items = items.filter(o => String(o.category).toLowerCase() === String(category).toLowerCase());
  }
  if (dateFrom) {
    const f = toISO(dateFrom);
    items = items.filter(o => o.createdAt && o.createdAt >= f);
  }
  if (dateTo) {
    const t = toISO(dateTo);
    items = items.filter(o => o.createdAt && o.createdAt <= t);
  }

  if (sort) {
    const [field, order] = String(sort).split(",");
    const dir = order === "desc" ? -1 : 1;
    items.sort((a: any, b: any) => { // Usar 'any' temporariamente para acesso dinâmico
      const av = a[field];
      const bv = b[field];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  } else {
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

export async function getOrderById(id: string): Promise<Order | null> {
  const currentDb = loadDB();
  const found = Array.isArray(currentDb.orders) ? currentDb.orders.find(o => String(o.id) === String(id)) : null;
  return found ? mapOrder(found) : null;
}

export async function createOrder(orderData: any): Promise<Order> {
  const currentDb = loadDB();
  const newOrderId = generateUniqueId();
  const orderDate = toISO(new Date());

  const newOrder: Order = {
    id: newOrderId,
    order_date: orderDate,
    status: orderData.status || "aguardando_pagamento",
    category: orderData.category || "Outros",
    total_value: Number(orderData.total_value || 0),
    paymentMethod: orderData.paymentMethod || "desconhecido",
    customer: {
      id: generateUniqueId(),
      firstName: orderData.customer?.firstName || "",
      lastName: orderData.customer?.lastName || "",
      email: orderData.customer?.email || "",
      cpf: orderData.customer?.cpf || "",
      birthDate: orderData.customer?.birthdate ? toISO(orderData.customer.birthdate) : "",
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
    items: Array.isArray(orderData.items) ? orderData.items.map((item: any) => ({
      sku: item.sku || "",
      name: item.name || "Produto",
      qty: Number(item.qty || 0),
      price: Number(item.price || 0),
    })) : [],
    payments: Array.isArray(orderData.payments) ? orderData.payments.map((payment: any) => ({
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

export async function updateOrder(id: string, updatedFields: any): Promise<Order | null> {
  const currentDb = loadDB();
  const orderIndex = currentDb.orders.findIndex(o => String(o.id) === String(id));

  if (orderIndex === -1) {
    return null;
  }

  let existingOrder = currentDb.orders[orderIndex];

  const newCustomerData: Customer = {
    ...existingOrder.customer,
    firstName: updatedFields.customer?.firstName || existingOrder.customer?.firstName,
    lastName: updatedFields.customer?.lastName || existingOrder.customer?.lastName,
    cpf: updatedFields.customer?.cpf || existingOrder.customer?.cpf,
    birthDate: updatedFields.customer?.birthdate ? toISO(updatedFields.customer.birthdate) : existingOrder.customer?.birthDate,
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

  const newShippingData: Shipping = {
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

  const mergedOrder: Order = {
    ...existingOrder,
    status: updatedFields.status || existingOrder.status,
    customer: newCustomerData,
    shipping: newShippingData,
    total_value: updatedFields.total || existingOrder.total_value,
    category: updatedFields.category || existingOrder.category,
    order_date: updatedFields.createdAt ? toISO(updatedFields.createdAt) : existingOrder.order_date,
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

export async function statsLast14Days(): Promise<any> {
  const currentDb = loadDB();
  const orders = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];

  const windowDays = 14;
  const windowSet = new Set(lastNDays(windowDays));

  let totalRevenue = 0;
  let totalOrders = 0;
  let paidOrders = 0;

  for (const o of orders) {
    if (!o.createdAt || !windowSet.has(o.createdAt)) continue;
    totalOrders += 1;
    totalRevenue += (o.total ?? 0); // Usar nullish coalescing operator
    if (o.status === "pago") paidOrders += 1;
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

export async function paymentsBreakdown(): Promise<any> {
  const currentDb = loadDB();
  const orders = Array.isArray(currentDb.orders) ? currentDb.orders.map(mapOrder) : [];
  const daysSet = new Set(lastNDays(14));

  const agg = new Map();
  for (const o of orders) {
    if (!o.createdAt || !daysSet.has(o.createdAt) || o.status !== 'pago') continue;
    const key = o.paymentMethod || "desconhecido";
    agg.set(key, (agg.get(key) || 0) + (o.total ?? 0)); // Usar nullish coalescing operator
  }

  const result = Array.from(agg.entries()).map(([method, value]) => ({ method, value }));
  return {
    payments: result,
    from: lastNDays(14)[0],
    to: lastNDays(14)[13]
  };
}

export async function listLandingPages(): Promise<LandingPage[]> {
  const currentDb = loadDB();
  const landingPages = Array.isArray(currentDb.landingPages) ? currentDb.landingPages : [];
  landingPages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return landingPages;
}

export async function createLandingPage(data: any): Promise<LandingPage> {
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

  const id = generateUniqueId();
  const slug = await generateSlug(data.productTitle);
  const fullShippingValue = Boolean(data.freeShipping) ? 0 : Number(data.shippingValue);

  const newLandingPage: LandingPage = {
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

export async function updateLandingPage(id: string, data: any): Promise<LandingPage | null> {
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

  const updatedLandingPage: LandingPage = {
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
    updatedLandingPage.slug = await generateSlug(data.productTitle);
    updatedLandingPage.url = `/l/${updatedLandingPage.slug}`;
  }

  currentDb.landingPages[landingPageIndex] = updatedLandingPage;
  await saveDB(currentDb);
  return updatedLandingPage;
}

export async function deleteLandingPage(id: string): Promise<boolean> {
  const currentDb = loadDB();
  const initialLength = currentDb.landingPages.length;
  currentDb.landingPages = currentDb.landingPages.filter(lp => String(lp.id) !== String(id));

  if (currentDb.landingPages.length === initialLength) {
    return false;
  }

  await saveDB(currentDb);
  return true;
}

export async function getLandingPageBySlug(slug: string): Promise<LandingPage | null> {
  const currentDb = loadDB();
  const found = Array.isArray(currentDb.landingPages) ? currentDb.landingPages.find(lp => lp.slug === slug) : null;
  return found || null;
}

// Inicializa o DB ao carregar o módulo
initializeJsonAdapter();
