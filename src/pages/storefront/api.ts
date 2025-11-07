import { http } from "../../lib/api";
import type {
  StoreSettings,
  Banner,
  ProductSummary,
  ProductDetail,
  Category,
  Collection,
  PaginatedProducts,
  CmsPage,
  ShippingMethod,
} from "../Store/api";
import type { LuckyWheelPublicState, LuckyWheelSpinResult } from "../../types/lucky-wheel.js";

export type StorefrontMenuItem = {
  id: string;
  label: string;
  href: string;
  position: number;
  parentId?: string | null;
};

export type StorefrontMenu = {
  id: string;
  key: "HEADER" | "FOOTER";
  items: StorefrontMenuItem[];
};

export type CartItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type CartItem = {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  product: ProductSummary;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price?: number | null;
    stock: number;
  } | null;
};

export type Cart = {
  id: string;
  sessionToken?: string | null;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  coupon?: { id: string; code: string; type: string; value: number } | null;
  shippingMethod?: ShippingMethod | null;
  shippingAddress?: any;
  billingAddress?: any;
  items: CartItem[];
  luckyWheelPerks?: {
    freeShippingApplied?: boolean;
    freeOrderApplied?: boolean;
  };
};

export type CheckoutPayload = {
  cartId: string;
  sessionToken?: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    document: string;
    birthDate?: string;
    gender?: string | null;
  };
  shippingAddress: {
    name?: string;
    email?: string;
    phone?: string;
    document?: string;
    postalCode: string;
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
  };
  billingAddress?: CheckoutPayload["shippingAddress"] | null;
  shippingMethodId: string;
  paymentMethod: "pix" | "cartao";
  paymentDetails?: {
    installments?: number;
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
    };
  } | null;
  couponCode?: string | null;
  notes?: string | null;
  perks?: {
    freeShipping?: boolean;
    freeOrder?: boolean;
  };
};

export type CheckoutResponse = {
  orderId: string;
  orderNumber: string;
  status: string;
  totals: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    totalCents: number;
  };
  payment: {
    method: string;
    status: string;
    externalReference?: string;
    gatewayPaymentId?: string | null;
    gatewayStatus?: string | null;
    pix?: {
      qrCode: string;
      copyPaste: string;
    } | null;
  };
};

export type StorefrontEventPayload = {
  sessionId: string;
  eventType: 'VIEW_PRODUCT' | 'VIEW_CATEGORY' | 'ADD_TO_CART' | 'PURCHASE';
  productId?: string;
  collectionId?: string;
  cartId?: string;
  customerId?: string;
  metadata?: Record<string, unknown>;
};

export type RecommendationSections = {
  trending: ProductSummary[];
  newArrivals: ProductSummary[];
  cartComplements: ProductSummary[];
  customerFavorites: ProductSummary[];
};

const toQueryString = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export const storefrontApi = {
  async getSettings() {
    return http<StoreSettings>("/api/store/settings");
  },
  async getMenu(key: "HEADER" | "FOOTER") {
    return http<StorefrontMenu>(`/api/store/menus/${key.toLowerCase()}`);
  },
  async listBanners(params: { kind?: string; activeOnly?: boolean } = {}) {
    return http<Banner[]>(`/api/store/banners${toQueryString(params)}`);
  },
  async listProducts(params: Record<string, unknown> = {}) {
    return http<PaginatedProducts>(`/api/store/products${toQueryString(params)}`);
  },
  async getProduct(slug: string) {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    return http<ProductDetail>(`/api/store/products/${slug}`);
  },
  async listCategories() {
    return http<Category[]>("/api/store/categories");
  },
  async listCollections() {
    return http<Collection[]>("/api/store/collections");
  },
  async getCollection(slug: string) {
    return http<Collection>(`/api/store/collections/${slug}`);
  },
  async getCategoryProducts(slug: string, params: Record<string, unknown> = {}) {
    return http<PaginatedProducts>(`/api/store/categories/${slug}/products${toQueryString(params)}`);
  },
  async getCollectionProducts(slug: string, params: Record<string, unknown> = {}) {
    return http<PaginatedProducts>(`/api/store/collections/${slug}/products${toQueryString(params)}`);
  },
  async searchProducts(term: string) {
    return http<ProductSummary[]>(`/api/store/search${toQueryString({ q: term })}`);
  },
  async getCart(params: { cartId?: string | null; sessionToken?: string | null }) {
    return http<Cart>(`/api/store/cart${toQueryString(params)}`);
  },
  async upsertCart(payload: {
    cartId?: string | null;
    sessionToken?: string | null;
    items?: CartItemInput[];
    couponCode?: string | null;
    shippingMethodId?: string | null;
    shippingAddress?: any;
    billingAddress?: any;
  }) {
    return http<Cart>("/api/store/cart", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async checkout(payload: CheckoutPayload) {
    return http<CheckoutResponse>("/api/store/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async trackEvent(payload: StorefrontEventPayload) {
    return http<{ success: boolean }>("/api/store/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async getRecommendations(params: { cartId?: string; sessionId?: string; customerId?: string; limit?: number } = {}) {
    return http<RecommendationSections>(`/api/store/recommendations${toQueryString(params)}`);
  },
  async listShippingMethods() {
    return http<ShippingMethod[]>("/api/store/shipping-methods");
  },
  async getPage(slug: string) {
    return http<CmsPage>(`/api/store/pages/${slug}`);
  },
  async checkPaymentStatus(externalReference: string, options: { paymentId?: string } = {}) {
    const query = options.paymentId ? `?paymentId=${encodeURIComponent(options.paymentId)}` : "";
    return http<{ success: boolean; paid: boolean; status?: string }>(
      `/api/payments/status/by-reference/${externalReference}${query}`
    );
  },
  async getLuckyWheelState(params: { cartId?: string; sessionToken?: string }) {
    return http<LuckyWheelPublicState>(`/api/store/lucky-wheel${toQueryString(params)}`);
  },
  async spinLuckyWheel(payload: { cartId?: string; sessionToken?: string }) {
    return http<{ result: LuckyWheelSpinResult }>("/api/store/lucky-wheel/spin", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
