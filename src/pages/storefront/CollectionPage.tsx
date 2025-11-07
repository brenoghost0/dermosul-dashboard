import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import ProductGrid from "./components/ProductGrid";
import { ProductSortBar, SortValue, PRODUCT_SORT_OPTIONS } from "./components/ProductSortBar";
import ProductRail from "./components/ProductRail";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { storefrontApi } from "./api";
import type { ProductSummary, Collection } from "../Store/api";
import { useRecommendations } from "./useRecommendations";
import { trackStorefrontEvent } from "./tracking";
import { useProductLikes } from "./ProductLikesContext";
import { replaceProtocolTerms } from "./utils/text";

export default function CollectionPage() {
  const { settings } = useStorefrontContext();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number }>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    data: recommendationData,
    loading: loadingRecommendations,
  } = useRecommendations(6);
  const { getTopLovedProducts, seedProducts } = useProductLikes();

  useEffect(() => {
    async function loadCollection() {
      if (!slug) return;
      try {
        const data = await storefrontApi.getCollection(slug);
        setCollection(data);
      } catch (err) {
        console.warn("Falha ao carregar coleção", err);
        setCollection(null);
      }
    }
    loadCollection();
  }, [slug]);

  useEffect(() => {
    async function loadProducts() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      const page = Number(searchParams.get("page") || 1);
      const sortParam = searchParams.get("sort") as SortValue | null;
      const sort = PRODUCT_SORT_OPTIONS.some((option) => option.value === sortParam) ? sortParam! : "relevance";
      try {
        const response = await storefrontApi.getCollectionProducts(slug, { page, pageSize: 12, sort });
        setProducts(response.items);
        setMeta({ page: response.page, totalPages: response.totalPages });
      } catch (err: any) {
        setError(err?.message || "Falha ao carregar produtos da coleção.");
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [slug, searchParams]);

  useEffect(() => {
    if (products.length > 0) {
      seedProducts(products);
    }
  }, [products, seedProducts]);

  useEffect(() => {
    if (!collection) return;
    trackStorefrontEvent({
      eventType: 'VIEW_CATEGORY',
      collectionId: collection.id,
      metadata: { slug: collection.slug, name: collection.name },
    });
  }, [collection?.id, collection?.slug, collection?.name]);

  function changePage(newPage: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("page", String(newPage));
      return params;
    });
  }

  const sortValue = (() => {
    const current = searchParams.get("sort") as SortValue | null;
    return PRODUCT_SORT_OPTIONS.some((option) => option.value === current) ? (current as SortValue) : "relevance";
  })();

  function handleSortChange(next: SortValue) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("sort", next);
      params.set("page", "1");
      return params;
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && slug ? `${origin}/colecoes/${slug}` : origin), [origin, slug]);
  const fallbackDescription = settings?.defaultDescription || "Seleções Dermosul com curadoria clínica e resultados comprovados.";
  const title = collection?.name ? `${collection.name} | Dermosul` : "Coleções Dermosul";
  const description = replaceProtocolTerms(collection?.description || fallbackDescription);
  const image = settings?.metaImageUrl || "/media/dermosul/og-image.png";
  const jsonLd = collection && pageUrl
    ? [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: title,
          description,
          url: pageUrl,
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: origin,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: collection.name,
              item: pageUrl,
            },
          ],
        },
      ]
    : null;

  usePageMeta({ title, description, image, url: pageUrl, type: "CollectionPage", jsonLd });

  const complements = recommendationData?.cartComplements ?? [];
  const trendingProducts = recommendationData?.trending ?? [];
  const topLovedProducts = useMemo(() => {
    const loved = getTopLovedProducts(products, 8);
    if (loved.length > 0) return loved;
    return trendingProducts;
  }, [getTopLovedProducts, products, trendingProducts]);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollPendingRef = useRef(false);

  useEffect(() => {
    scrollPendingRef.current = true;
  }, [slug]);

  useEffect(() => {
    if (!loading && !error) {
      scrollPendingRef.current = true;
    }
  }, [loading, error]);

  useEffect(() => {
    if (loading || error || !gridRef.current || !scrollPendingRef.current) return;
    scrollPendingRef.current = false;
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const top = gridRef.current.getBoundingClientRect().top + window.scrollY;
    const offset = Math.max(top - 120, 0);
    window.scrollTo({
      top: offset,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [loading, error, products.length]);

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <nav className="text-xs text-violet-600">
          <Link to="/" className="hover:text-violet-800">
            Home
          </Link>
          <span className="mx-2 text-violet-400">/</span>
          <span>{collection?.name || "Coleção"}</span>
        </nav>

        <header className="mt-4 mb-6">
          <h1 className="text-2xl font-semibold text-violet-900">{collection?.name || "Coleções Dermosul"}</h1>
          {collection?.description && (
            <p className="mt-2 max-w-2xl text-sm text-violet-700">{replaceProtocolTerms(collection.description)}</p>
          )}
        </header>

        <ProductSortBar value={sortValue} onChange={handleSortChange} />
        {loading && <p className="text-sm text-zinc-500">Carregando produtos...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={gridRef} className="mt-4">
          {!loading && !error && <ProductGrid products={products} />}
        </div>

        {meta.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
            <span>
              Página {meta.page} de {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => changePage(Math.max(meta.page - 1, 1))}
                disabled={meta.page === 1}
                className="rounded-full border border-zinc-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => changePage(Math.min(meta.page + 1, meta.totalPages))}
                disabled={meta.page === meta.totalPages}
                className="rounded-full border border-zinc-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

        {!loadingRecommendations && complements.length > 0 && (
          <div className="mt-10">
            <ProductRail
              title="Combine com esse cuidado"
              products={complements}
              emptyState="Quando você adicionar produtos, sugerimos combinações que fazem sentido com eles."
            />
          </div>
        )}

        {!loadingRecommendations && topLovedProducts.length > 0 && (
          <div className="mt-10">
            <ProductRail
              title="Os mais amados agora"
              products={topLovedProducts}
              emptyState="Assim que novos queridinhos aparecerem, mostramos aqui."
            />
          </div>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
}
