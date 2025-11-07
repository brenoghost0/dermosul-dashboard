import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ProductSummary } from "../Store/api";

const STORAGE_KEY = "dermosul_product_likes_v1";
const INITIALIZED_KEY = "dermosul_product_likes_initialized_v1";
const MIN_INITIAL_LIKES = 699;
const MAX_INITIAL_LIKES = 2999;
const NEW_PRODUCT_MAX_LIKES = 999;

type LikeEntry = {
  count: number;
  liked: boolean;
};

type LikeState = Record<string, LikeEntry>;

type ProductLikesContextValue = {
  toggleLike: (productId: string) => void;
  isLiked: (productId: string) => boolean;
  likeCount: (productId: string) => number;
  getTopLovedProducts: (products: ProductSummary[], limit: number) => ProductSummary[];
  seedProducts: (products: ProductSummary[], options?: { maxLikes?: number }) => void;
};

const ProductLikesContext = createContext<ProductLikesContextValue | undefined>(undefined);

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureMinimumLikes(state: LikeState, maxLikes: number): LikeState {
  let changed = false;
  const next: LikeState = { ...state };
  Object.entries(next).forEach(([productId, entry]) => {
    if (!entry || entry.count < MIN_INITIAL_LIKES) {
      next[productId] = {
        count: randomBetween(MIN_INITIAL_LIKES, maxLikes),
        liked: entry?.liked ?? false,
      };
      changed = true;
    }
  });
  return changed ? next : state;
}

function seedInitialLikes(existing: LikeState): LikeState {
  if (typeof window === "undefined") return existing;
  try {
    const rawProducts = window.localStorage.getItem("dermosul_products_cache");
    let productIds: string[] = [];
    if (rawProducts) {
      try {
        const parsed = JSON.parse(rawProducts);
        if (Array.isArray(parsed)) {
          productIds = parsed.filter((id) => typeof id === "string");
        }
      } catch (error) {
        console.warn("[likes] falha ao ler cache de produtos", error);
      }
    }

    return seedStateWithIds(existing, productIds, MAX_INITIAL_LIKES);
  } catch (error) {
    console.warn("[likes] falha ao inicializar curtidas", error);
  }
  return existing;
}

function seedInitialLikesWithProducts(existing: LikeState, products: ProductSummary[], maxLikes: number): LikeState {
  const productIds = products.map((product) => product.id);
  return seedStateWithIds(existing, productIds, maxLikes);
}

function seedStateWithIds(existing: LikeState, productIds: string[], maxLikes: number): LikeState {
  let changed = false;
  const nextState: LikeState = { ...existing };

  productIds.forEach((productId) => {
    const entry = nextState[productId];
    if (!entry || entry.count < MIN_INITIAL_LIKES) {
      nextState[productId] = {
        count: randomBetween(MIN_INITIAL_LIKES, maxLikes),
        liked: entry?.liked ?? false,
      };
      changed = true;
    }
  });

  return changed ? nextState : existing;
}

function readStorage(): LikeState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LikeState;
    if (parsed && typeof parsed === "object") {
      return ensureMinimumLikes(parsed, MAX_INITIAL_LIKES);
    }
  } catch (error) {
    console.warn("[likes] falha ao ler storage", error);
  }
  return {};
}

function writeStorage(state: LikeState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[likes] falha ao salvar storage", error);
  }
}

export function ProductLikesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LikeState>(() => (typeof window !== "undefined" ? readStorage() : {}));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedState = readStorage();
    const hasInitialized = window.localStorage.getItem(INITIALIZED_KEY) === "true";
    if (!hasInitialized) {
      const seeded = seedInitialLikes(storedState);
      const normalized = ensureMinimumLikes(seeded, MAX_INITIAL_LIKES);
      setState(normalized);
      writeStorage(normalized);
      try {
        window.localStorage.setItem(INITIALIZED_KEY, "true");
      } catch (error) {
        console.warn("[likes] falha ao marcar inicialização", error);
      }
    } else {
      const normalized = ensureMinimumLikes(storedState, MAX_INITIAL_LIKES);
      setState(normalized);
      writeStorage(normalized);
    }
  }, []);

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const toggleLike = useCallback((productId: string) => {
    setState((prev) => {
      const entry = prev[productId];
      const currentCount = !entry || entry.count < MIN_INITIAL_LIKES ? randomBetween(MIN_INITIAL_LIKES, MAX_INITIAL_LIKES) : entry.count;
      const nextLiked = !entry?.liked;
      const nextCount = Math.max(MIN_INITIAL_LIKES, currentCount + (nextLiked ? 1 : -1));
      return {
        ...prev,
        [productId]: {
          count: nextCount,
          liked: nextLiked,
        },
      };
    });
  }, []);

  const isLiked = useCallback((productId: string) => !!state[productId]?.liked, [state]);

  const likeCount = useCallback(
    (productId: string) => {
      const entry = state[productId];
      if (!entry) {
        return MIN_INITIAL_LIKES;
      }
      return Math.max(entry.count, MIN_INITIAL_LIKES);
    },
    [state]
  );

  const seedProducts = useCallback((products: ProductSummary[], options: { maxLikes?: number } = {}) => {
    if (!products || products.length === 0) return;
    if (typeof window === "undefined") return;
    const maxLikes = options.maxLikes ?? NEW_PRODUCT_MAX_LIKES;
    setState((prev) => {
      const next = seedInitialLikesWithProducts(prev, products, maxLikes);
      if (next === prev) {
        return prev;
      }
      writeStorage(next);
      return next;
    });
  }, []);

  const getTopLovedProducts = useCallback(
    (products: ProductSummary[], limit: number) => {
      if (!products || products.length === 0) return [];
      const unique = new Map<string, ProductSummary>();
      products.forEach((product) => {
        if (!unique.has(product.id)) {
          unique.set(product.id, product);
        }
      });
      const list = Array.from(unique.values());
      const ranked = list
        .map((product) => ({ product, count: state[product.id]?.count ?? 0 }))
        .sort((a, b) => {
          if (b.count === a.count) {
            return a.product.name.localeCompare(b.product.name);
          }
          return b.count - a.count;
        });
      const liked = ranked.filter((item) => item.count > 0).map((item) => item.product).slice(0, limit);
      if (liked.length >= limit) {
        return liked.slice(0, limit);
      }
      const fillers = ranked
        .filter((item) => !liked.some((product) => product.id === item.product.id))
        .map((item) => item.product);
      return [...liked, ...fillers.slice(0, Math.max(0, limit - liked.length))];
    },
    [state]
  );

  const value = useMemo<ProductLikesContextValue>(
    () => ({ toggleLike, isLiked, likeCount, getTopLovedProducts, seedProducts }),
    [toggleLike, isLiked, likeCount, getTopLovedProducts, seedProducts]
  );

  return <ProductLikesContext.Provider value={value}>{children}</ProductLikesContext.Provider>;
}

export function useProductLikes() {
  const context = useContext(ProductLikesContext);
  if (!context) {
    throw new Error("useProductLikes deve ser utilizado dentro de ProductLikesProvider");
  }
  return context;
}
