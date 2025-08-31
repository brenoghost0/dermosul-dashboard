export interface OverviewData {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  convAvg: number;
}

export interface RevenueDataItem {
  date: string;
  revenue: number;
}
export type RevenueData = RevenueDataItem[];

export interface CategoryDataItem {
  category: string;
  value: number;
}
export type CategoryData = CategoryDataItem[];

export interface PaymentDataItem {
  method: string;
  value: number;
}
export type PaymentData = PaymentDataItem[];

export interface ConversionDataItem {
  date: string;
  rate: number;
}
export type ConversionData = ConversionDataItem[];

// Type for the list of orders, matching the backend mapping
export interface OrderRow {
  id: string;
  createdAt: string;
  client: string;
  category: string;
  status: "pago" | "pendente" | "cancelado" | "enviado";
  total: number;
}

export interface ListOrdersResponse {
  items: OrderRow[];
  total?: number;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  cpf: string;
  birthdate: string;
  phone: string;
  zip: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export interface Shipping {
  method: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  value: number;
}

export interface Item {
  sku: string;
  name: string;
  qty: number;
  price: number;
}

export interface Payment {
  method: string;
  value: number;
}

export interface Summary {
  subTotal: number;
  discount: number;
  shipping: number;
  total: number;
}

// Type for the detailed order view
export interface OrderDetail {
  id: string;
  order_date: string;
  status: "pago" | "pendente" | "cancelado" | "enviado";
  category: string;
  total_value: number;
  customer: Customer;
  shipping: Shipping;
  items: Item[];
  payments: Payment[];
  summary: Summary;
}

async function http<T>(path: string, config?: RequestInit): Promise<T> {
  // Prepending the API base URL. Using VITE_API_URL environment variable.
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const res = await fetch(`${baseUrl}${path}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erro desconhecido no servidor' }));
    throw new Error(err.message || `Failed to fetch ${path}`);
  }
  return res.json();
}

export const api = {
  getOverview: () => http<OverviewData>('/api/dashboard/overview'),
  getRevenueByDay: () => http<RevenueData>('/api/dashboard/revenue-by-day'),
  getOrdersByCategory: () => http<CategoryData>('/api/dashboard/orders-by-category'),
  getPayments: () => http<PaymentData>('/api/dashboard/payments'),
  getConversionByDay: () => http<ConversionData>('/api/dashboard/conversion-by-day'),
  listOrders: (params?: { pageSize?: number; sort?: string }) => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return http<ListOrdersResponse>(`/api/orders${query}`);
  },
  getOrderById: (id: string) => http<OrderDetail>(`/api/orders/${id}`),
  updateOrderStatus: (id: string, status: OrderDetail['status']) => http<OrderDetail>(`/api/orders/${id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  }),
};
