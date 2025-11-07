import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Cart, CartItemInput } from "./api";
import { storefrontApi } from "./api";
import { trackStorefrontEvent } from "./tracking";

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  addItem: (item: CartItemInput) => Promise<void>;
  updateItem: (productId: string, quantity: number, variantId?: string | null) => Promise<void>;
  removeItem: (productId: string, variantId?: string | null) => Promise<void>;
  applyCoupon: (code: string | null) => Promise<void>;
  selectShippingMethod: (methodId: string | null) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  touch: (next?: Cart | null) => void;
  markAbandoned: () => void;
  resumePrompt: CartSnapshot | null;
  dismissResumePrompt: () => void;
}

const STORAGE_CART_ID = "dermosul_store_cart_id";
const STORAGE_CART_TOKEN = "dermosul_store_cart_session";
const STORAGE_CART_SNAPSHOT = "dermosul_cart_snapshot";
const STORAGE_CART_LAST_ACTIVE = "dermosul_cart_last_active";
const STORAGE_CART_ABANDONED = "dermosul_cart_abandoned";

type CartSnapshot = {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    priceCents: number;
    imageUrl?: string | null;
  }>;
  totalCents: number;
  updatedAt: string;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumePrompt, setResumePrompt] = useState<CartSnapshot | null>(null);

  const identifiers = useMemo(() => {
    const cartId = localStorage.getItem(STORAGE_CART_ID);
    const sessionToken = localStorage.getItem(STORAGE_CART_TOKEN);
    return { cartId, sessionToken };
  }, []);

  useEffect(() => {
    try {
      const abandonedFlag = localStorage.getItem(STORAGE_CART_ABANDONED);
      const snapshotRaw = localStorage.getItem(STORAGE_CART_SNAPSHOT);
      if (abandonedFlag && snapshotRaw) {
        const parsed = JSON.parse(snapshotRaw) as CartSnapshot;
        setResumePrompt(parsed);
      }
    } catch (err) {
      console.warn("Falha ao restaurar snapshot do carrinho", err);
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadSnapshot(): CartSnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_CART_SNAPSHOT);
      if (!raw) return null;
      return JSON.parse(raw) as CartSnapshot;
    } catch (err) {
      console.warn("Falha ao ler snapshot do carrinho", err);
      return null;
    }
  }

  function saveSnapshot(nextCart: Cart | null) {
    if (!nextCart || !nextCart.items || nextCart.items.length === 0) {
      localStorage.removeItem(STORAGE_CART_SNAPSHOT);
      return;
    }
    const snapshot: CartSnapshot = {
      items: nextCart.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        quantity: item.quantity,
        priceCents: item.unitPriceCents,
        imageUrl: item.product.imageUrl ?? item.product.images?.[0]?.url ?? null,
      })),
      totalCents: nextCart.totalCents,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_CART_SNAPSHOT, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("Falha ao salvar snapshot do carrinho", err);
    }
  }

  function touch(nextCart?: Cart | null) {
    try {
      localStorage.setItem(STORAGE_CART_LAST_ACTIVE, Date.now().toString());
      localStorage.removeItem(STORAGE_CART_ABANDONED);
    } catch (err) {
      console.warn("Falha ao atualizar estado do carrinho", err);
    }
    if (resumePrompt) {
      setResumePrompt(null);
    }
    if (nextCart && nextCart.items.length === 0) {
      localStorage.removeItem(STORAGE_CART_SNAPSHOT);
    }
  }

  function markAbandoned() {
    if (!cart || !cart.items || cart.items.length === 0) return;
    saveSnapshot(cart);
    try {
      localStorage.setItem(STORAGE_CART_ABANDONED, Date.now().toString());
    } catch (err) {
      console.warn("Falha ao marcar carrinho abandonado", err);
    }
    const snapshot = loadSnapshot();
    if (snapshot) {
      setResumePrompt(snapshot);
    }
  }

  function dismissResumePrompt() {
    try {
      localStorage.removeItem(STORAGE_CART_ABANDONED);
    } catch (err) {
      console.warn("Falha ao limpar flag de abandono", err);
    }
    setResumePrompt(null);
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      let response: Cart | null = null;
      if (identifiers.cartId || identifiers.sessionToken) {
        try {
          response = await storefrontApi.getCart({ cartId: identifiers.cartId, sessionToken: identifiers.sessionToken });
        } catch (err: any) {
          console.warn("Falha ao carregar carrinho existente", err);
        }
      }
      if (!response) {
        response = await storefrontApi.upsertCart({ cartId: identifiers.cartId || undefined, sessionToken: identifiers.sessionToken || undefined, items: [] });
      }
      persistIdentifiers(response);
      setCart(response);
      saveSnapshot(response);
      touch(response);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar carrinho.");
    } finally {
      setLoading(false);
    }
  }

  async function mutateCart(payload: Parameters<typeof storefrontApi.upsertCart>[0]) {
    setLoading(true);
    setError(null);
    try {
      const response = await storefrontApi.upsertCart({
        cartId: cart?.id || identifiers.cartId || undefined,
        sessionToken: cart?.sessionToken || identifiers.sessionToken || undefined,
        ...payload,
      });
      persistIdentifiers(response);
      setCart(response);
      saveSnapshot(response);
      touch(response);
      return response;
    } catch (err: any) {
      setError(err?.message || "Falha ao atualizar carrinho.");
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function addItem(item: CartItemInput) {
    const normalizedVariantId = item.variantId ?? null;
    const items = normalizeItems(cart);
    const existingIndex = items.findIndex(
      (entry) => entry.productId === item.productId && entry.variantId === normalizedVariantId
    );
    if (existingIndex >= 0) {
      items[existingIndex] = { ...items[existingIndex], quantity: items[existingIndex].quantity + item.quantity };
    } else {
      items.push({ productId: item.productId, variantId: normalizedVariantId, quantity: item.quantity });
    }
    const updated = await mutateCart({ items });
    if (updated) {
      trackStorefrontEvent({
        eventType: 'ADD_TO_CART',
        productId: item.productId,
        cartId: updated.id,
        metadata: { quantity: item.quantity, variantId: normalizedVariantId },
      });
    }
  }

  async function updateItem(productId: string, quantity: number, variantId?: string | null) {
    const normalizedQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
    if (normalizedQuantity <= 0) {
      await removeItem(productId, variantId);
      return;
    }

    const normalizedVariantId = variantId ?? null;
    const items = normalizeItems(cart).map((entry) =>
      entry.productId === productId && entry.variantId === normalizedVariantId
        ? { ...entry, quantity: normalizedQuantity }
        : entry
    );

    await mutateCart({ items });
  }

  async function removeItem(productId: string, variantId?: string | null) {
    const normalizedVariantId = variantId ?? null;
    const items = normalizeItems(cart).filter(
      (entry) => !(entry.productId === productId && entry.variantId === normalizedVariantId)
    );
    await mutateCart({ items });
  }

  async function selectShippingMethod(methodId: string | null) {
    await mutateCart({ shippingMethodId: methodId });
  }

  async function applyCoupon(code: string | null) {
    await mutateCart({ couponCode: code });
  }

  function reset() {
    localStorage.removeItem(STORAGE_CART_ID);
    localStorage.removeItem(STORAGE_CART_TOKEN);
    localStorage.removeItem(STORAGE_CART_SNAPSHOT);
    localStorage.removeItem(STORAGE_CART_LAST_ACTIVE);
    localStorage.removeItem(STORAGE_CART_ABANDONED);
    setCart(null);
    setResumePrompt(null);
  }

  const value: CartContextValue = {
    cart,
    loading,
    error,
    addItem,
    updateItem,
    removeItem,
    applyCoupon,
    selectShippingMethod,
    reset,
    refresh,
    touch,
    markAbandoned,
    resumePrompt,
    dismissResumePrompt,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart deve ser utilizado dentro de CartProvider");
  }
  return context;
}

function persistIdentifiers(cart: Cart) {
  if (cart.id) {
    localStorage.setItem(STORAGE_CART_ID, cart.id);
  }
  if (cart.sessionToken) {
    localStorage.setItem(STORAGE_CART_TOKEN, cart.sessionToken);
  }
}

function normalizeItems(cart: Cart | null): CartItemInput[] {
  if (cart?.items) {
    return cart.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
    }));
  }
  return [];
}
