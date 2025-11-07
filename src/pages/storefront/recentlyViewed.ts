import type { ProductDetail, ProductSummary } from "../Store/api";

const STORAGE_KEY = "dermosul_recent_products";
const EVENT_KEY = "dermosul:recent-products";
const MAX_ITEMS = 8;

export type RecentProduct = {
  id: string;
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  viewedAt: string;
};

function readStorage(): RecentProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProduct[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.id && item.slug && item.name && typeof item.price === "number");
  } catch (err) {
    console.warn("Falha ao carregar itens recentes", err);
    return [];
  }
}

function writeStorage(items: RecentProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new CustomEvent(EVENT_KEY));
  } catch (err) {
    console.warn("Falha ao salvar itens recentes", err);
  }
}

export function getRecentlyViewedProducts(): RecentProduct[] {
  return readStorage();
}

export function subscribeToRecentProducts(callback: () => void) {
  function handler() {
    callback();
  }
  window.addEventListener(EVENT_KEY, handler);
  return () => window.removeEventListener(EVENT_KEY, handler);
}

export function addRecentlyViewedProduct(product: ProductDetail | ProductSummary) {
  if (typeof window === "undefined") return;
  const current = readStorage();
  const now = new Date().toISOString();
  const imageUrl = product.images && product.images.length > 0 ? product.images[0].url : null;
  const summary: RecentProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: 'brand' in product ? product.brand : undefined,
    price: product.price,
    compareAtPrice: 'compareAtPrice' in product ? product.compareAtPrice || null : null,
    imageUrl,
    viewedAt: now,
  };

  const filtered = current.filter((item) => item.id !== summary.id);
  const updated = [summary, ...filtered].sort((a, b) => (a.viewedAt < b.viewedAt ? 1 : -1));
  writeStorage(updated);
}

export function recentProductsToSummaries(items: RecentProduct[]): ProductSummary[] {
  return items.map((item, index) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    brand: item.brand || 'Dermosul',
    sku: `recent-${index}-${item.id}`,
    price: item.price,
    compareAtPrice: item.compareAtPrice ?? null,
    active: true,
    stockQuantity: 0,
    images: item.imageUrl
      ? [{ id: `recent-img-${index}-${item.id}`, url: item.imageUrl, alt: item.name, position: index }]
      : [],
  }));
}
