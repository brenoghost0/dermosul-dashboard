import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import ProductRail from "./components/ProductRail";
import { useCart } from "./CartContext";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { useRecommendations } from "./useRecommendations";
import { LuckyWheelExperience } from "./components/LuckyWheelExperience";

export default function CartPage() {
  const { settings } = useStorefrontContext();
  const { cart, loading, error, updateItem, removeItem, applyCoupon } = useCart();

  const subtotal = cart?.subtotalCents || 0;
  const discount = cart?.discountCents || 0;
  const shipping = cart?.shippingCents ?? null;
  const total = cart?.totalCents || 0;

  const items = useMemo(() => cart?.items || [], [cart?.items]);
  const {
    data: recommendationData,
    loading: loadingRecommendations,
  } = useRecommendations(6);
  const complements = recommendationData?.cartComplements ?? [];
  const trendingProducts = recommendationData?.trending ?? [];
  const contentRef = useRef<HTMLDivElement | null>(null);

  const homeHref = useMemo(() => {
    const domains = settings?.domainSettings;
    const primary = domains?.primaryDomain ? domains.primaryDomain.trim() : "";
    const preview = domains?.previewDomain ? domains.previewDomain.trim() : "";
    const configured = primary || preview || "/";
    if (typeof window !== "undefined" && window.location.hostname === "localhost" && /^https?:/i.test(configured)) {
      return "/";
    }
    return configured;
  }, [settings?.domainSettings]);
  const homeIsExternal = useMemo(() => /^https?:/i.test(homeHref), [homeHref]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  usePageMeta({
    title: "Carrinho Dermosul | Dermosul",
    description: "Revise seus cuidados Dermosul antes de finalizar a compra.",
    image: settings?.metaImageUrl || "/media/dermosul/og-image.png",
    url: origin ? `${origin}/carrinho` : origin,
  });

  useEffect(() => {
    if (loading || typeof window === "undefined" || !contentRef.current) return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const top = contentRef.current.getBoundingClientRect().top + window.scrollY;
    const offset = Math.max(top - 120, 0);
    window.scrollTo({
      top: offset,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [loading, items.length]);

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      {items.length > 0 && (
        <LuckyWheelExperience cartId={cart?.id ?? undefined} sessionToken={cart?.sessionToken ?? undefined} onApplyCoupon={(code) => applyCoupon(code)} />
      )}
      <main className="mx-auto max-w-5xl px-4 py-10" data-section-id="cart-products">
        <h1 className="text-2xl font-semibold text-violet-900">Carrinho Dermosul</h1>
        {loading && <p className="mt-4 text-sm text-zinc-500">Atualizando carrinho...</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div ref={contentRef}>
          {items.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-violet-100 bg-white p-8 text-sm text-violet-700">
              <p>Seu carrinho está vazio por enquanto.</p>
              {homeIsExternal ? (
                <a href={homeHref} className="mt-3 inline-flex text-violet-600 hover:text-violet-800">
                  Ver produtos Dermosul
                </a>
              ) : (
                <Link to={homeHref} className="mt-3 inline-flex text-violet-600 hover:text-violet-800">
                  Ver produtos Dermosul
                </Link>
              )}
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 rounded-3xl border border-violet-100 bg-white p-4 sm:flex-row sm:items-center sm:gap-5"
                  >
                    <div className="flex flex-none justify-center sm:justify-start">
                      <img
                        src={item.product.imageUrl || item.product.images?.[0]?.url || "/media/placeholder-product.svg"}
                        alt={item.product.name}
                        loading="lazy"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (!target.dataset.fallbackLoaded) {
                            target.dataset.fallbackLoaded = "true";
                            target.src = "/media/placeholder-product.svg";
                          }
                        }}
                        className="h-24 w-24 rounded-2xl border border-violet-100 object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-violet-900">{item.product.name}</h2>
                        <p className="text-xs text-violet-600">SKU {item.product.sku}</p>
                      </div>
                      <div className="flex flex-col gap-2 text-xs text-violet-700 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2">
                          Qtde
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.productId, Number(event.target.value), item.variantId ?? null)
                            }
                            className="w-20 rounded border border-violet-200 px-2 py-1"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId ?? null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-base font-semibold text-violet-900 sm:min-w-[6rem]">
                      {formatCurrency(item.totalPriceCents)}
                    </div>
                  </div>
                ))}
              </div>

              <aside className="space-y-4 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-violet-900">Resumo</h2>
                <div className="space-y-2 text-sm text-violet-700">
                  <Row label="Subtotal" value={formatCurrency(subtotal)} />
                  {discount > 0 && <Row label="Descontos" value={`- ${formatCurrency(discount)}`} />}
                  <Row label="Frete" value={shipping !== null ? formatCurrency(shipping) : "Calculado no checkout"} />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-1 border-t border-violet-100 pt-3 text-sm font-semibold text-violet-900">
                  <span>Total</span>
                  <span className="text-base">{formatCurrency(total)}</span>
                </div>
                <Link
                  to="/checkout"
                  className="inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
                >
                  Finalizar compra
                </Link>
              </aside>
            </div>
          )}
        </div>

        {!loadingRecommendations && (complements.length > 0 || trendingProducts.length > 0) && (
          <div className="mt-12 space-y-10">
            {complements.length > 0 && (
              <ProductRail
                title="Leve também"
                products={complements}
                emptyState="Assim que você adicionar produtos, trazemos sugestões que combinam com eles."
              />
            )}
            {trendingProducts.length > 0 && (
              <ProductRail
                title="Quem comprou este produto também levou"
                products={trendingProducts}
                emptyState="Quando chegarem novos destaques, eles aparecem aqui."
              />
            )}
          </div>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
      <span className="text-violet-600">{label}</span>
      <span className="font-medium text-violet-900">{value}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
