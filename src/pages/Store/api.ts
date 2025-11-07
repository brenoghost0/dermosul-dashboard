import { http } from "../../lib/api";

export interface StoreTypography {
  heading?: { fontFamily?: string; fontWeight?: number; lineHeight?: number | string; letterSpacing?: string };
  body?: { fontFamily?: string; fontWeight?: number; lineHeight?: number | string; letterSpacing?: string };
}

export interface StoreTextBlocks {
  announcement?: { enabled?: boolean; message?: string; ctaLabel?: string; ctaHref?: string };
  hero?: {
    tag?: string;
    title?: string;
    subtitle?: string;
    ctaPrimary?: { label?: string; href?: string };
    ctaSecondary?: { label?: string; href?: string };
  };
  highlights?: { title?: string; subtitle?: string };
  newsletter?: { title?: string; subtitle?: string; placeholder?: string; ctaLabel?: string; legalText?: string };
  footer?: { description?: string; contactEmail?: string; contactPhone?: string; serviceHours?: string; address?: string };
  trustbar?: Array<{ icon?: string; label?: string }>;
  checkout?: { pixMessage?: string; cardMessage?: string; successMessage?: string };
  [key: string]: unknown;
}

export interface HomeLayoutSection {
  id: string;
  type: string;
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  collectionSlug?: string;
  categorySlug?: string;
  bannerKind?: string;
  limit?: number;
  [key: string]: unknown;
}

export interface StoreSeoSettings {
  defaultTitle?: string;
  defaultDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  metaImageUrl?: string;
  twitterCard?: string;
  [key: string]: unknown;
}

export interface StoreDomainSettings {
  primaryDomain?: string;
  subdomain?: string;
  previewDomain?: string;
  customDomains?: string[];
  [key: string]: unknown;
}

export interface StoreIntegrationsSettings {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  pinterestTagId?: string;
  emailMarketing?: { provider?: string; apiKey?: string; listId?: string };
  whatsappBusiness?: { number?: string; message?: string };
  customScripts?: Array<{ id: string; position: "head" | "body"; code: string }>;
  [key: string]: unknown;
}

export interface StoreCheckoutSettings {
  shipping?: { freeShippingOverCents?: number | null; allowPickup?: boolean; deliveryEstimateText?: string };
  payment?: {
    availableMethods?: Array<"pix" | "cartao">;
    defaultStatus?: string;
    manualPix?: { enabled?: boolean; instructions?: string };
  };
  notifications?: { sendEmail?: boolean; sendWhatsapp?: boolean };
  [key: string]: unknown;
}

export interface StoreSettings {
  id: string;
  currency: string;
  defaultTitle: string | null;
  defaultDescription: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  appleTouchIconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  metaImageUrl?: string | null;
  typography?: StoreTypography | null;
  textBlocks?: StoreTextBlocks | null;
  homeLayout?: HomeLayoutSection[] | null;
  seoSettings?: StoreSeoSettings | null;
  domainSettings?: StoreDomainSettings | null;
  integrations?: StoreIntegrationsSettings | null;
  checkoutSettings?: StoreCheckoutSettings | null;
}

export interface Banner {
  id: string;
  kind: "HERO" | "CAROUSEL" | "STRIP";
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  position: number;
  active: boolean;
}

export interface ProductImage {
  id?: string;
  url: string;
  alt?: string | null;
  position: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price?: number | null;
  stock: number;
  attributes?: Record<string, unknown> | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  brand: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  active: boolean;
  stockQuantity: number;
  imageUrl?: string | null;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

export interface ProductDetail extends ProductSummary {
  description?: string;
  descriptionHtml?: string | null;
  productLinks?: Array<{ position: number; categoryId: string }>;
  collectionLinks?: Array<{ position: number; collectionId: string }>;
}

export interface PaginatedProducts {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  position: number;
  parentId?: string | null;
  subcategories?: Category[];
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  position: number;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  contentHtml: string;
  published: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface MenuItem {
  id: string;
  menuId: string;
  label: string;
  href: string;
  position: number;
  parentId?: string | null;
}

export interface Menu {
  id: string;
  key: "HEADER" | "FOOTER";
  items: MenuItem[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  carrier?: string | null;
  flatPriceCents: number;
  freeOverCents?: number | null;
  deliveryEtaText?: string | null;
  active: boolean;
  zipRange?: Record<string, unknown> | null;
}

export interface PaymentProvider {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  config?: Record<string, unknown> | null;
}

export interface Coupon {
  id: string;
  code: string;
  type: "PERCENT" | "AMOUNT";
  value: number;
  startsAt?: string | null;
  endsAt?: string | null;
  active: boolean;
}

const toQueryString = (params: Record<string, unknown>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

export const storeAdminApi = {
  async getSettings() {
    return http<StoreSettings>("/api/admin/store/settings");
  },
  async updateSettings(data: Partial<StoreSettings>) {
    return http<StoreSettings>("/api/admin/store/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  async listBanners(params?: { kind?: string }) {
    const qs = params?.kind ? `?kind=${encodeURIComponent(params.kind)}` : "";
    return http<Banner[]>(`/api/admin/store/banners${qs}`);
  },
  async createBanner(payload: Partial<Banner>) {
    return http<Banner>("/api/admin/store/banners", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateBanner(id: string, payload: Partial<Banner>) {
    return http<Banner>(`/api/admin/store/banners/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteBanner(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/banners/${id}`, { method: "DELETE" });
  },
  async listProducts(params: Record<string, unknown> = {}) {
    try {
      return await http<PaginatedProducts>(`/api/admin/store/products${toQueryString(params)}`);
    } catch (error) {
      console.warn("[storeAdminApi] Falha ao listar produtos via admin API, tentando fallback público.", error);
      return http<PaginatedProducts>(`/api/store/products${toQueryString(params)}`);
    }
  },
  async getProduct(id: string) {
    try {
      return await http<ProductDetail>(`/api/admin/store/products/${id}`);
    } catch (error) {
      console.warn("[storeAdminApi] Falha ao carregar produto via admin API, tentando fallback público.", error);
      const listing = await http<PaginatedProducts>(`/api/store/products${toQueryString({ pageSize: 100 })}`);
      const summary = listing.items.find((item) => item.id === id);
      if (!summary) {
        throw new Error("Produto não encontrado.");
      }
      return http<ProductDetail>(`/api/store/products/${summary.slug}`);
    }
  },
  async upsertProduct(payload: Partial<ProductDetail> & { id?: string }) {
    if (payload.id) {
      return http<ProductDetail>(`/api/admin/store/products/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
    return http<ProductDetail>("/api/admin/store/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async deleteProduct(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/products/${id}`, { method: "DELETE" });
  },
  async listCategories() {
    try {
      return await http<Category[]>("/api/admin/store/categories");
    } catch (error) {
      console.warn("[storeAdminApi] Falha ao listar categorias via admin API, tentando fallback público.", error);
      return http<Category[]>("/api/store/categories");
    }
  },
  async createCategory(payload: Partial<Category>) {
    return http<Category>("/api/admin/store/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateCategory(id: string, payload: Partial<Category>) {
    return http<Category>(`/api/admin/store/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteCategory(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/categories/${id}`, { method: "DELETE" });
  },
  async listCollections() {
    try {
      return await http<Collection[]>("/api/store/admin/collections");
    } catch (primaryError) {
      console.warn("[storeAdminApi] Falha ao listar coleções via nova rota admin, tentando legado.", primaryError);
      try {
        return await http<Collection[]>("/api/admin/store/collections");
      } catch (legacyError) {
        console.warn("[storeAdminApi] Rotas admin indisponíveis, usando vitrine.", legacyError);
        return http<Collection[]>("/api/store/collections");
      }
    }
  },
  async adjustProductPrices(percentage: number) {
    return http<{ success: boolean; updated: number }>("/api/admin/store/products/adjust-prices", {
      method: "POST",
      body: JSON.stringify({ percentage }),
    });
  },
  async createCollection(payload: Partial<Collection>) {
    return http<Collection>("/api/admin/store/collections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateCollection(id: string, payload: Partial<Collection>) {
    return http<Collection>(`/api/admin/store/collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteCollection(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/collections/${id}`, { method: "DELETE" });
  },
  async listPages() {
    return http<CmsPage[]>("/api/admin/store/pages");
  },
  async createPage(payload: Partial<CmsPage>) {
    return http<CmsPage>("/api/admin/store/pages", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updatePage(id: string, payload: Partial<CmsPage>) {
    return http<CmsPage>(`/api/admin/store/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deletePage(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/pages/${id}`, { method: "DELETE" });
  },
  async listMenus() {
    return http<Menu[]>("/api/admin/store/menus");
  },
  async getMenu(key: "HEADER" | "FOOTER") {
    return http<Menu>(`/api/admin/store/menus/${key.toLowerCase()}`);
  },
  async createMenuItem(key: "HEADER" | "FOOTER", payload: Partial<MenuItem>) {
    return http<MenuItem>(`/api/admin/store/menus/${key.toLowerCase()}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateMenuItem(id: string, payload: Partial<MenuItem> & { menuId: string }) {
    return http<MenuItem>(`/api/admin/store/menus/items/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteMenuItem(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/menus/items/${id}`, { method: "DELETE" });
  },
  async listShippingMethods() {
    return http<ShippingMethod[]>("/api/admin/store/shipping-methods");
  },
  async createShippingMethod(payload: Partial<ShippingMethod>) {
    return http<ShippingMethod>("/api/admin/store/shipping-methods", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateShippingMethod(id: string, payload: Partial<ShippingMethod>) {
    return http<ShippingMethod>(`/api/admin/store/shipping-methods/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteShippingMethod(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/shipping-methods/${id}`, { method: "DELETE" });
  },
  async listPaymentProviders() {
    return http<PaymentProvider[]>("/api/admin/store/payment-providers");
  },
  async upsertPaymentProvider(payload: Partial<PaymentProvider> & { id?: string }) {
    if (payload.id) {
      return http<PaymentProvider>(`/api/admin/store/payment-providers/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }
    return http<PaymentProvider>("/api/admin/store/payment-providers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async deletePaymentProvider(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/payment-providers/${id}`, { method: "DELETE" });
  },
  async listCoupons() {
    return http<Coupon[]>("/api/admin/store/coupons");
  },
  async createCoupon(payload: Partial<Coupon>) {
    return http<Coupon>("/api/admin/store/coupons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateCoupon(id: string, payload: Partial<Coupon>) {
    return http<Coupon>(`/api/admin/store/coupons/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteCoupon(id: string) {
    return http<{ success: boolean }>(`/api/admin/store/coupons/${id}`, { method: "DELETE" });
  },
};
