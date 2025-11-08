import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../CartContext";
import { useRecommendations } from "../useRecommendations";
import type { ProductSummary } from "../../Store/api";
import type { AddedToCartDetail } from "../utils/cartEvents";
import { emitAddedToCartEvent } from "../utils/cartEvents";

type FlyoutState = {
  product: AddedToCartDetail;
  openedAt: number;
};

export function AddToCartFlyout() {
  const [state, setState] = useState<FlyoutState | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { addItem } = useCart();
  const {
    data: recommendationData,
    loading: loadingRecommendations,
  } = useRecommendations(6);

  const suggestions = useMemo(() => {
    const complements = recommendationData?.cartComplements ?? [];
    if (complements.length > 0) return complements.slice(0, 6);
    const trending = recommendationData?.trending ?? [];
    return trending.slice(0, 6);
  }, [recommendationData?.cartComplements, recommendationData?.trending]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<AddedToCartDetail>).detail;
      if (!detail || detail.origin === "checkout-cross-sell") return;
      setState({ product: detail, openedAt: Date.now() });
    };

    window.addEventListener("dermosul:cart:added", handleEvent);
    document.addEventListener("dermosul:cart:added", handleEvent);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setState(null);
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("dermosul:cart:added", handleEvent);
      document.removeEventListener("dermosul:cart:added", handleEvent);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleClose = useCallback(() => {
    setState(null);
  }, []);

  const handleAddSuggestion = useCallback(
    async (product: ProductSummary) => {
      setAddingId(product.id);
      try {
        await addItem({ productId: product.id, quantity: 1 });
        emitAddedToCartEvent(product, 1);
      } finally {
        setAddingId(null);
      }
    },
    [addItem]
  );

  if (!state) return null;

  const { product } = state;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 px-3 pb-[max(1.25rem,var(--safe-area-inset-bottom,1.25rem))] sm:items-center sm:px-6 sm:pb-6 sm:pt-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-flyout-title"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-w-2xl lg:max-w-3xl"
      >
        <header className="flex items-start gap-3 border-b border-violet-50 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-violet-50">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-14 w-14 object-cover" />
            ) : (
              <span className="text-2xl">🛍️</span>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-violet-400">Adicionado ao carrinho</p>
            <h2 id="cart-flyout-title" className="text-lg font-semibold text-violet-900">
              {product.name}
            </h2>
            <p className="text-sm font-medium text-violet-700">{formatCurrency(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-violet-300 transition hover:text-violet-500"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <section className="max-h-[55vh] overflow-y-auto px-4 py-4 sm:max-h-[45vh] sm:px-6 sm:py-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.32em] text-violet-400">
            Aproveite e leve junto
          </h3>
          {loadingRecommendations ? (
            <p className="mt-4 text-xs text-violet-500">Buscando recomendações...</p>
          ) : suggestions.length === 0 ? (
            <p className="mt-4 text-xs text-violet-500">
              Assim que tivermos sugestões perfeitas para este item, elas aparecem aqui.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <article
                  key={suggestion.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-violet-100/80 bg-violet-50/40 p-4 transition hover:-translate-y-0.5 hover:shadow sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-start gap-3 sm:w-44">
                    <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                      <img
                        src={
                          suggestion.imageUrl ||
                          suggestion.images?.[0]?.url ||
                          "/media/placeholder-product.svg"
                        }
                        alt={suggestion.name}
                        className="h-16 w-16 object-cover"
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (!target.dataset.fallbackLoaded) {
                            target.dataset.fallbackLoaded = "true";
                            target.src = "/media/placeholder-product.svg";
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-violet-500">{suggestion.brand}</p>
                    <p className="text-sm font-semibold text-violet-900 line-clamp-2">{suggestion.name}</p>
                    <p className="text-sm font-medium text-violet-700">{formatCurrency(suggestion.price)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={addingId === suggestion.id}
                    onClick={() => handleAddSuggestion(suggestion)}
                    className="mt-2 inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-0 sm:min-w-[7.5rem]"
                  >
                    {addingId === suggestion.id ? "Adicionando..." : "Adicionar"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-violet-100 bg-violet-50/70 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex w-full items-center justify-center rounded-full border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:text-violet-900 sm:w-auto"
          >
            Continuar comprando
          </button>
          <Link
            to="/carrinho"
            className="inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 sm:w-auto"
            onClick={() => {
              handleClose();
              if (typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("dermosul:scroll-to", { detail: { target: "cart-products" } })
                );
              }
            }}
          >
            Ir para o carrinho
          </Link>
        </footer>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
