// src/lib/api.ts
import axios from 'axios';

// Usa a origem atual do navegador como padrão em produção (mesma origem)
const RUNTIME_ORIGIN = typeof window !== 'undefined' && (window.location?.origin || '');
export const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || RUNTIME_ORIGIN || 'http://localhost:3007';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface OrderRow {
  id: string;
  fullId: string;
  client: string;
  category: string;
  status: "pago" | "pendente" | "cancelado" | "enviado";
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
  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const r = await fetch(`${API_BASE_URL}${path}`, {
    ...config,
    headers,
  });

  if (!r.ok) {
    // Tenta JSON; se falhar, captura texto para mensagem mais útil
    let message = '';
    try {
      const errorData = await r.json();
      message = errorData?.message || '';
    } catch {
      try {
        const t = await r.text();
        message = t ? `${r.status} ${r.statusText}: ${t.slice(0, 200)}` : '';
      } catch {}
    }
    if (r.status === 401) {
      localStorage.removeItem("auth");
    }
    throw new Error(message || `Falha na requisição para ${path}`);
  }
  return r.json();
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

    return http<LandingPage>('/api/landings', {
      method: 'POST',
      body: formData,
      headers: {}, // Deixa o browser setar o Content-Type para multipart/form-data
    });
  },
  listLandingPages: async () => {
    const data = await http<LandingPage[]>('/api/landings');
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

    return http<LandingPage>(`/api/landings/${id}`, {
      method: 'PUT',
      body: formData,
      headers: {}, // Deixa o browser setar o Content-Type para multipart/form-data
    });
  },
  deleteLandingPage: (id: string) => {
    return http<{ success: boolean }>(`/api/landings/${id}`, {
      method: 'DELETE',
    });
  },
  updateLandingPageStatus: (id: string, status: 'ATIVA' | 'PAUSADA') => {
    return http<LandingPage>(`/api/landings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
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
