import { useEffect, useMemo, useState } from "react";
import { storefrontApi, type RecommendationSections } from "./api";
import { useCart } from "./CartContext";
import { getSessionId } from "./tracking";
import { FALLBACK_PRODUCTS } from "./fallbackData";

export function useRecommendations(limit = 8) {
  const { cart } = useCart();
  const [data, setData] = useState<RecommendationSections | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useMemo(() => getSessionId(), []);

  const cartSignature = useMemo(() => {
    if (!cart || !cart.items) return "empty";
    return cart.items
      .map((item) => `${item.productId}:${item.quantity}`)
      .sort()
      .join("|");
  }, [cart?.items]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await storefrontApi.getRecommendations({
          cartId: cart?.id,
          sessionId,
          limit,
        });
        if (!cancelled) {
          setData(response);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Falha ao carregar recomendações.");
          const fallback: RecommendationSections = {
            trending: FALLBACK_PRODUCTS,
            newArrivals: FALLBACK_PRODUCTS,
            cartComplements: FALLBACK_PRODUCTS,
            customerFavorites: FALLBACK_PRODUCTS,
          };
          setData(fallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cart?.id, cartSignature, sessionId, limit]);

  return { data, loading, error };
}
