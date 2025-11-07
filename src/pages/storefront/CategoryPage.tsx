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
import type { Category, ProductSummary } from "../Store/api";
import { useRecommendations } from "./useRecommendations";
import { trackStorefrontEvent } from "./tracking";
import { useProductLikes } from "./ProductLikesContext";
import { replaceProtocolTerms } from "./utils/text";

export default function CategoryPage() {
  const { settings } = useStorefrontContext();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number }>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    data: recommendationData,
    loading: loadingRecommendations,
  } = useRecommendations(6);
  const categoryDescription = useMemo(() => {
    const description = category?.description?.trim();
    if (!description) return null;
    return replaceProtocolTerms(description);
  }, [category?.description]);
  const { getTopLovedProducts, seedProducts } = useProductLikes();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollPendingRef = useRef(false);

  useEffect(() => {
    scrollPendingRef.current = true;
  }, [slug]);

  useEffect(() => {
    async function loadCategory() {
      try {
        const categories = await storefrontApi.listCategories();
        const match = categories.find((cat) => cat.slug === slug);
        setCategory(match || null);
      } catch (err) {
        console.warn("Falha ao carregar categorias", err);
      }
    }
    loadCategory();
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
        const data = await storefrontApi.getCategoryProducts(slug, { page, pageSize: 12, sort });
        setProducts(data.items);
        setMeta({ page: data.page, totalPages: data.totalPages });
      } catch (err: any) {
        setError(err?.message || "Falha ao carregar produtos da categoria.");
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
    if (!slug) return;
    trackStorefrontEvent({
      eventType: 'VIEW_CATEGORY',
      metadata: { slug, name: category?.name ?? null },
    });
  }, [slug, category?.name]);

  function changePage(newPage: number) {
    scrollPendingRef.current = true;
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
    scrollPendingRef.current = true;
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set("sort", next);
      params.set("page", "1");
      return params;
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && slug ? `${origin}/c/${slug}` : origin), [origin, slug]);
  const fallbackDescription = settings?.defaultDescription || "Conheça cuidados Dermosul feitos para diferentes objetivos de pele.";
  const title = category?.name ? `${category.name} | Dermosul` : "Cuidados Dermosul";
  const description = category?.description || fallbackDescription;
  const image = settings?.metaImageUrl || "/media/dermosul/og-image.png";
  const jsonLd = category && pageUrl
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
              name: category.name,
              item: pageUrl,
            },
          ],
        },
      ]
    : null;

  usePageMeta({ title, description, image, url: pageUrl, type: "CollectionPage", jsonLd });

  const trendingProducts = recommendationData?.trending ?? [];
  const topLovedProducts = useMemo(() => {
    const loved = getTopLovedProducts(products, 8);
    if (loved.length > 0) return loved;
    return trendingProducts;
  }, [getTopLovedProducts, products, trendingProducts]);
  const complements = recommendationData?.cartComplements ?? [];

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
            Início
          </Link>
          <span className="mx-2 text-violet-400">/</span>
          <span>{category?.name || "Categoria"}</span>
        </nav>

        <header className="mt-4 mb-6">
          <h1 className="text-2xl font-semibold text-violet-900">{category?.name || "Cuidados Dermosul"}</h1>
          {categoryDescription && <p className="mt-2 max-w-2xl text-sm text-violet-700">{categoryDescription}</p>}
        </header>

        <ProductSortBar value={sortValue} onChange={handleSortChange} />
        {loading && <p className="text-sm text-zinc-500">Buscando os produtos dessa categoria...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={gridRef} id="categoria-produtos" className="mt-4">
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
              title="Combine com esses cuidados"
              products={complements}
              emptyState="Assim que você escolher produtos, trazemos sugestões que combinam com eles."
            />
          </div>
        )}

        {!loadingRecommendations && topLovedProducts.length > 0 && (
          <div className="mt-10">
            <ProductRail
              title="Os mais amados agora"
              products={topLovedProducts}
              emptyState="Quando surgirem novos queridinhos, eles aparecem aqui."
            />
          </div>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
}
