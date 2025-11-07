import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import ProductRail from "./components/ProductRail";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { useProduct } from "./useProduct";
import type { ProductDetail, ProductSummary } from "../Store/api";
import { useCart } from "./CartContext";
import { useRecommendations } from "./useRecommendations";
import { emitAddedToCartEvent } from "./utils/cartEvents";
import { trackStorefrontEvent } from "./tracking";
import {
  addRecentlyViewedProduct,
  getRecentlyViewedProducts,
  subscribeToRecentProducts,
  recentProductsToSummaries,
  RecentProduct,
} from "./recentlyViewed";

const NUM_RECOMMENDATIONS = 6;
const NUM_RECENTLY_VIEWED = 6;

export default function ProductPage() {
  const { settings } = useStorefrontContext();
  const { slug } = useParams<{ slug: string }>();
  const { product, loading, error } = useProduct(slug);
  const { cart, addItem, loading: cartLoading } = useCart();

  const [recentItems, setRecentItems] = useState<RecentProduct[]>([]);
  const { data: recommendationData, loading: loadingRecommendations } = useRecommendations(NUM_RECOMMENDATIONS);
  const productFocusRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToProduct = useRef(false);

  useEffect(() => {
    const update = () => setRecentItems(getRecentlyViewedProducts());
    update();
    const unsubscribe = subscribeToRecentProducts(update);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!product) return;
    addRecentlyViewedProduct(product);
    setRecentItems(getRecentlyViewedProducts());
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    trackStorefrontEvent({
      eventType: 'VIEW_PRODUCT',
      productId: product.id,
      cartId: cart?.id,
      metadata: { slug: product.slug },
    });
  }, [product?.id, product?.slug, cart?.id]);

  useEffect(() => {
    hasScrolledToProduct.current = false;
  }, [slug]);

  useEffect(() => {
    if (!product || hasScrolledToProduct.current) return;
    const target = productFocusRef.current;
    if (!target) return;
    hasScrolledToProduct.current = true;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [product?.id]);

  const complementProducts = useMemo(() => {
    if (!recommendationData) return [] as ProductSummary[];
    const pool = [
      ...(recommendationData.cartComplements ?? []),
      ...(recommendationData.customerFavorites ?? []),
      ...(recommendationData.trending ?? []),
      ...(recommendationData.newArrivals ?? []),
    ];
    const seen = new Set<string>();
    const selected: ProductSummary[] = [];
    for (const item of pool) {
      if (item.id === product?.id) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      selected.push(item);
      if (selected.length >= NUM_RECOMMENDATIONS) break;
    }
    return selected;
  }, [recommendationData, product?.id]);

  const primaryImage = product?.images?.[0]?.url || "/media/placeholder-product.svg";
  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const productUrl = useMemo(() => (origin && slug ? `${origin}/p/${slug}` : origin), [origin, slug]);
  const productJsonLd = product && productUrl
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || product.descriptionHtml || settings?.defaultDescription || "Cuidado Dermosul.",
        image: (product.images || []).map((image) => image.url),
        brand: {
          "@type": "Brand",
          name: product.brand || "Dermosul",
        },
        sku: product.sku,
        offers: {
          "@type": "Offer",
          priceCurrency: "BRL",
          price: (product.price / 100).toFixed(2),
          availability: product.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: productUrl,
        },
      }
    : null;

  usePageMeta({
    title: product?.name ? `${product.name} | Dermosul` : "Produto Dermosul",
    description: product?.description || settings?.defaultDescription || "Cuidados Dermosul feitos por especialistas para a rotina brasileira.",
    image: primaryImage,
    url: productUrl,
    type: "Product",
    jsonLd: productJsonLd,
  });

  const recentSummaries = useMemo(() => {
    const converted = recentProductsToSummaries(recentItems);
    return converted.filter((item) => item.id !== product?.id).slice(0, NUM_RECENTLY_VIEWED);
  }, [recentItems, product?.id]);

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        {loading && <p className="text-sm text-zinc-500">Preparando os detalhes deste cuidado...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && product && (
          <div ref={productFocusRef} className="grid gap-8 lg:grid-cols-2">
            <ProductGallery product={product} />
            <ProductDetails product={product} addItem={addItem} cartLoading={cartLoading} />
          </div>
        )}

        {recentSummaries.length > 0 && (
          <div className="mt-12">
            <ProductRail title="Você visitou recentemente" products={recentSummaries} />
          </div>
        )}

        <div className="mt-12">
          {loadingRecommendations ? (
            <section className="rounded-3xl border border-violet-100 bg-white p-6 text-sm text-zinc-500">
              Buscando sugestões Dermosul que combinam com esse cuidado...
            </section>
          ) : (
            complementProducts.length > 0 && (
              <ProductRail
                title="Combine com esse cuidado"
                products={complementProducts}
                emptyState="Dê uma olhada na vitrine Dermosul para encontrar outros favoritos."
              />
            )
          )}
        </div>
      </main>
      <StorefrontFooter />
    </div>
  );
}

function ProductGallery({ product }: { product: ProductDetail }) {
  const images = product.images && product.images.length ? product.images : null;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images?.[activeIndex]?.url || "/media/placeholder-product.svg";

  return (
    <div className="space-y-4 w-full max-w-lg mx-auto lg:mx-0">
      <div className="w-full rounded-3xl border border-violet-100 bg-white p-4 shadow-sm sm:p-6">
        <div className="aspect-square w-full rounded-2xl bg-violet-50 p-6 sm:p-10">
          <img src={activeImage} alt={product.name} className="h-full w-full object-contain" />
        </div>
      </div>
      {images && images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={image.id ?? `${image.url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveIndex(index);
                  }
                }}
                className={`relative h-20 w-full overflow-hidden rounded-2xl border transition focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-violet-100 sm:h-24 ${
                  isActive ? "border-violet-500" : "border-violet-100 hover:border-violet-300"
                }`}
                aria-label={`Ver imagem ${index + 1} de ${images.length}`}
              >
                <img
                  src={image.url}
                  alt={image.alt || product.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {isActive && (
                  <span className="absolute inset-0 rounded-2xl ring-2 ring-violet-500 ring-offset-2 ring-offset-white pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
      {images && images.length === 1 && (
        <div className="flex gap-3">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-violet-200">
            <img
              src={images[0].url}
              alt={images[0].alt || product.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      )}
      {!images && (
        <div className="flex gap-3">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-violet-200">
            <img
              src="/media/placeholder-product.svg"
              alt="Imagem não disponível"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductDetails({
  product,
  addItem,
  cartLoading,
}: {
  product: ProductDetail;
  addItem: (item: { productId: string; quantity: number }) => Promise<void> | void;
  cartLoading: boolean;
}) {
  const sanitizedHtml = DOMPurify.sanitize(product.descriptionHtml || "");
  const [added, setAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  const handleAddToCart = async () => {
    if (!product || cartLoading) return;
    await addItem({ productId: product.id, quantity: 1 });
    emitAddedToCartEvent(product, 1);
    setAdded(true);
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      setAdded(false);
      resetTimer.current = null;
    }, 2200);
  };

  const isOutOfStock = !product || product.stockQuantity <= 0;

  return (
    <div className="flex flex-col gap-4">
      <nav className="text-xs text-violet-600">
        <Link to="/" className="hover:text-violet-800">
          Início
        </Link>
        <span className="mx-2 text-violet-400">/</span>
        <span>{product.brand || "Dermosul"}</span>
      </nav>
      <h1 className="text-3xl font-semibold text-violet-900">{product.name}</h1>
      <p className="text-sm text-violet-700">{product.description}</p>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-violet-900">{formatCurrency(product.price)}</span>
        {product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="text-sm text-violet-400 line-through">{formatCurrency(product.compareAtPrice)}</span>
        )}
      </div>
      <button
        onClick={isOutOfStock ? undefined : handleAddToCart}
        disabled={cartLoading || !product || isOutOfStock}
        className={`inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-300 disabled:opacity-60 disabled:cursor-not-allowed ${
          isOutOfStock
            ? "bg-zinc-300 text-zinc-700"
            : added
                ? "bg-emerald-500 text-white shadow-[0_12px_28px_-16px_rgba(16,185,129,0.65)] animate-cart-feedback"
                : "bg-violet-600 text-white hover:bg-violet-700"
        } ${cartLoading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {isOutOfStock
          ? "Fora de estoque"
          : added
              ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <span className="text-lg leading-none">✔</span>
                  Produto adicionado
                </span>
              )
              : "adicionar ao carrinho"}
      </button>
      {sanitizedHtml && (
        <article className="prose prose-sm max-w-none text-violet-800" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
