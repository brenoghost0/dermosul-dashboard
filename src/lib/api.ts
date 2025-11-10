// src/lib/api.ts
import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const RUNTIME_ORIGIN = isBrowser ? window.location?.origin || '' : '';
const RUNTIME_HOST = isBrowser ? window.location?.host || '' : '';

const normalizeBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
};

const rawEnvBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
const normalizedEnvBase = normalizeBaseUrl(rawEnvBase);
const normalizedRuntimeBase = normalizeBaseUrl(RUNTIME_ORIGIN);
const isViteDevHost = /^localhost:51(73|74)$/i.test(RUNTIME_HOST);
const DEFAULT_LOCAL_API = 'http://127.0.0.1:3008';

export const API_BASE_URL =
  normalizedEnvBase ||
  (isViteDevHost ? DEFAULT_LOCAL_API : normalizedRuntimeBase) ||
  DEFAULT_LOCAL_API;
const resolveApiUrl = (rawPath: string): string => {
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const trimmed = (rawPath || "").trim();
  let normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const baseEndsWithApi = typeof API_BASE_URL === "string" && API_BASE_URL.toLowerCase().endsWith("/api");

  if (!normalizedPath.startsWith("/api")) {
    normalizedPath = `/api${normalizedPath}`;
  }

  if (!API_BASE_URL) {
    return normalizedPath || "/api";
  }

  if (baseEndsWithApi) {
    const trimmedBase = API_BASE_URL;
    const suffix = normalizedPath.slice(4) || "/";
    return `${trimmedBase}${suffix}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

type HeadersLike = Record<string, unknown> & {
  set?: (key: string, value: string) => void;
  get?: (key: string) => string | null;
  delete?: (key: string) => void;
};

const setHeader = (headers: HeadersLike, key: string, value: string | null | undefined) => {
  if (!headers) return;
  if (headers.set && headers.delete) {
    if (value == null) {
      headers.delete(key);
    } else {
      headers.set(key, value);
    }
  } else {
    if (value == null) {
      delete (headers as Record<string, unknown>)[key];
    } else {
      (headers as Record<string, unknown>)[key] = value;
    }
  }
};

apiClient.interceptors.request.use((config) => {
  const headers = (config.headers as HeadersLike) || {};
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth") : null;
  setHeader(headers, 'Authorization', token ? `Bearer ${token}` : null);
  if (config.data instanceof FormData) {
    setHeader(headers, 'Content-Type', null);
    setHeader(headers, 'content-type', null);
  }
  config.headers = headers;
  if (config.url) {
    config.url = resolveApiUrl(config.url);
  } else {
    config.url = resolveApiUrl('');
  }
  return config;
});

export interface OrderRow {
  id: string;
  fullId: string;
  client: string;
  category: string;
  status: "pago" | "pendente" | "aguardando_pagamento" | "cancelado" | "enviado";
  total: number;
  createdAt: string; // YYYY-MM-DD
  paymentMethod?: 'pix' | 'cartao' | 'boleto' | 'desconhecido';
  lpStatus?: 'ATIVA' | 'PAUSADA';
}

export interface OrdersResponse {
  items: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type ListOrdersResponse = OrdersResponse;

type OrdersParams = Partial<{
  page: number;
  pageSize: number;
  q: string;
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  sort: string; // ex: 'createdAt:desc'
}>;

export async function http<T>(path: string, config?: RequestInit): Promise<T> {
  const isFormData = config?.body instanceof FormData;
  const headers = new Headers(config?.headers);
  const token = localStorage.getItem("auth");

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Só define Content-Type se não for FormData, pois o browser fará isso
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const requestUrl = resolveApiUrl(path);

  if ((import.meta as any)?.env?.DEV) {
    console.debug('[http] request', path, '->', requestUrl);
  }

  const r = await fetch(requestUrl, {
    ...config,
    headers,
  });

  if (!r.ok) {
    // Tenta JSON; se falhar, captura texto para mensagem mais útil
    let message = '';
    try {
      const raw = await r.text();
      if (raw) {
        try {
          const errorData = JSON.parse(raw);
          message = errorData?.message || errorData?.error || '';
        } catch {
          message = `${r.status} ${r.statusText}: ${raw.slice(0, 200)}`;
        }
      }
    } catch {
      // Ignora a falha ao ler o corpo e deixa cair no fallback genérico.
    }
    if ((import.meta as any)?.env?.DEV) {
      console.debug('[http] non-json response', path, '->', requestUrl, raw.slice(0, 200));
    }
    if (r.status === 401) {
      localStorage.removeItem("auth");
    }
    throw new Error(message || `Falha na requisição para ${path}`);
  }
  if (r.status === 204 || r.status === 205) {
    return undefined as T;
  }

  const contentType = r.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json') || contentType.includes('+json');
  const rawBody = await r.text();

  if (!rawBody) {
    return undefined as T;
  }

  if (!isJson) {
    throw new Error(`Resposta inesperada do servidor. Esperado JSON, recebeu: ${rawBody.slice(0, 120)}`);
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new Error(`Falha ao interpretar resposta JSON do servidor: ${rawBody.slice(0, 120)}`);
  }
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  cpf: string;
  birthdate: string; // YYYY-MM-DD
  email: string;
  phone: string;
  gender?: string;
}

export interface ShippingInfo {
  postalCode: string;
  address1: string; // Rua
  address2: string; // Número
  address2_complement?: string; // Complemento (opcional)
  district: string; // Bairro
  city: string;
  state: string;
  country?: string;
}

export interface OrderDetail extends OrderRow {
  // herdado: id, client, category, status, total (grandTotal), createdAt
  payment: { method: string; status: string; installments: number; paidAmount: number };
  clientInfo: { name: string; email?: string; phone?: string }; // opcional — ou reaproveite `client` simples
  customer: CustomerInfo; // Adicionado para campos editáveis do cliente
  shipping: ShippingInfo; // Adicionado para campos editáveis de endereço
  items: { sku: string; name: string; qty: number; price: number; subtotal: number }[];
  totals: { itemsTotal: number; shipping: number; discount: number; grandTotal: number };
  timeline?: { label: string; date: string }[];
  paymentMethod?: 'pix' | 'cartao' | 'boleto' | 'desconhecido';
}

export interface CancelOrderResponse {
  order: OrderDetail;
  refund?: {
    status?: string;
    message?: string;
  } | null;
}

// Helper para normalizar números
export const n = (x: unknown, d = 0) => {
  const v = Number(x);
  return Number.isFinite(v) ? v : d;
};

// Existing exports from previous steps (OverviewData, ConversionPoint, api)
export type CategoryData = { category: string; value: number };
export interface PaymentBreakdownItem {
  method: string;
  amount: number;
}

export interface OverviewData {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  convAvg: number;
  paymentsBreakdown: PaymentBreakdownItem[];
}

export interface ConversionPoint {
  date: string;
  rate: number;
}

export const api = {
  getOverview: async (): Promise<OverviewData> => {
    // A rota /api/overview já retorna o breakdown, então não precisamos de uma chamada separada.
    const data = await http<OverviewData>('/api/overview');
    return {
      totalRevenue: n(data.totalRevenue),
      totalOrders: n(data.totalOrders),
      avgTicket: n(data.avgTicket),
      convAvg: n(data.convAvg),
      paymentsBreakdown: Array.isArray(data.paymentsBreakdown) ? data.paymentsBreakdown : [],
    };
  },
  getPaymentsBreakdown: async (): Promise<PaymentBreakdownItem[]> => {
    const data = await http<PaymentBreakdownItem[]>('/api/payments/breakdown');
    return Array.isArray(data) ? data.map(item => ({ method: item.method, amount: n(item.amount) })) : [];
  },
  getRevenueByDay: async () => {
    const data = await http<{ date: string; revenue: number }[]>('/api/revenueByDay');
    return data.map(item => ({ date: item.date, revenue: n(item.revenue) }));
  },
  getOrdersByCategory: async () => {
    const data = await http<{ category: string; value: number }[]>('/api/ordersByCategory');
    return data.map(item => ({ category: item.category, value: n(item.value) }));
  },
  getConversionByDay: async () => {
    const data = await http<ConversionPoint[]>('/api/conversionByDay');
    return data.map(item => ({ date: item.date, rate: n(item.rate) }));
  },
  listOrders: (p: OrdersParams = {}) => {
    const qs = new URLSearchParams();
    if (p.page) qs.set("page", String(p.page));
    if (p.pageSize) qs.set("pageSize", String(p.pageSize));
    if (p.q) qs.set("q", p.q);
    if (p.status) qs.set("status", p.status);
    if (p.category) qs.set("category", p.category);
    if (p.dateFrom) qs.set("dateFrom", p.dateFrom);
    if (p.dateTo) qs.set("dateTo", p.dateTo);
    if (p.sort) qs.set("sort", p.sort);
    const url = `/api/orders?${qs.toString()}`;
    return http<OrdersResponse>(url);
  },
  exportOrdersCsv: (p: OrdersParams = {}) => {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    const url = `/api/orders/export?${qs.toString()}`;
    return fetch(url); // o caller faz .blob() e baixa
  },
  getOrderById: (id: string) => http<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`),
  saveOrder: (id: string, data: Partial<OrderDetail>) => {
    return http<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  cancelOrder: (id: string, payload?: { reason?: string; refundAmount?: number }) => {
    return http<CancelOrderResponse>(`/api/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },
  deleteOrder: (id: string) => {
    return http<{ success: boolean }>(`/api/orders/${encodeURIComponent(id)}` , {
      method: 'DELETE',
    });
  },
  getOrderNotes: (id: string) => http<{ notes: string }>(`/api/orders/${encodeURIComponent(id)}/notes`),
  saveOrderNotes: (id: string, notes: string) => http<{ success: boolean; notes: string }>(`/api/orders/${encodeURIComponent(id)}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  }),
};

export interface LandingPage {
  id: string;
  slug: string; // Adicionado slug
  template: string; // Adicionado template
  imageUrl?: string; // URL da imagem
  productTitle: string;
  productDescription: string;
  productBrand: string;
  productPrice: number;
  shippingValue: number;
  freeShipping: boolean;
  url: string;
  createdAt: string;
  updatedAt?: string; // Adicionado updatedAt
  status: 'ATIVA' | 'PAUSADA';
}

export const landingPageApi = {
  createLandingPage: async (data: {
    image?: File;
    template: string;
    productTitle: string;
    productDescription: string;
    productBrand: string;
    productPrice: number;
    shippingValue: number;
    freeShipping: boolean;
  }) => {
    const formData = new FormData();
    if (data.image) {
      formData.append('image', data.image);
    }
    formData.append('template', data.template);
    formData.append('productTitle', data.productTitle);
    formData.append('productDescription', data.productDescription);
    formData.append('productBrand', data.productBrand);
    formData.append('productPrice', String(data.productPrice));
    formData.append('shippingValue', String(data.shippingValue));
    formData.append('freeShipping', String(data.freeShipping));

    const response = await apiClient.post<LandingPage>('/landings', formData);
    return response.data;
  },
  listLandingPages: async () => {
    const { data } = await apiClient.get<LandingPage[]>('/landings');
    return data;
  },
  getLandingPageBySlug: async (slug: string) => {
    const data = await apiClient.get<LandingPage>(`/landings/${slug}`);
    return data.data;
  },
  updateLandingPage: async (id: string, data: {
    image?: File;
    template: string;
    productTitle: string;
    productDescription: string;
    productBrand: string;
    productPrice: number;
    shippingValue: number;
    freeShipping: boolean;
  }) => {
    const formData = new FormData();
    if (data.image) {
      formData.append('image', data.image);
    }
    formData.append('template', data.template);
    formData.append('productTitle', data.productTitle);
    formData.append('productDescription', data.productDescription);
    formData.append('productBrand', data.productBrand);
    formData.append('productPrice', String(data.productPrice));
    formData.append('shippingValue', String(data.shippingValue));
    formData.append('freeShipping', String(data.freeShipping));

    const response = await apiClient.put<LandingPage>(`/landings/${id}`, formData);
    return response.data;
  },
  deleteLandingPage: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/landings/${id}`).then((res) => res.data);
  },
  updateLandingPageStatus: (id: string, status: 'ATIVA' | 'PAUSADA') => {
    return apiClient.patch<LandingPage>(`/landings/${id}/status`, { status }).then((res) => res.data);
  },
};

export interface PublicOrderData {
  cep: string;
  address: string;
  addressNumber: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  gender: string;
  firstName: string;
  lastName: string;
  productId: string;
  productTitle: string;
  productPrice: number;
  qty: number;
  paymentMethod?: 'pix' | 'cartao' | 'boleto';
}

export const publicOrderApi = {
  createPublicOrder: async (data: PublicOrderData) => {
    const r = await fetch('/api/orders/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      // A API agora retorna um JSON com { message: "..." } em caso de erro
      const errorResponse = await r.json().catch(() => ({ message: "Ocorreu uma falha na comunicação com o servidor." }));
      // Sempre jogue um erro com a mensagem específica do backend
      throw new Error(errorResponse.message || "Erro desconhecido ao processar o pedido.");
    }
    return r.json();
  },
};
