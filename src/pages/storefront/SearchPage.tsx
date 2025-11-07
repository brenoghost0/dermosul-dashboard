import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import ProductGrid from "./components/ProductGrid";
import { ProductSortBar, SortValue, PRODUCT_SORT_OPTIONS } from "./components/ProductSortBar";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { storefrontApi } from "./api";
import type { ProductSummary } from "../Store/api";

export default function SearchPage() {
  const { settings } = useStorefrontContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const sortParam = searchParams.get("sort") as SortValue | null;
  const sort = PRODUCT_SORT_OPTIONS.some((option) => option.value === sortParam) ? (sortParam as SortValue) : "relevance";
  const page = Number(searchParams.get("page") || 1);
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<{ page: number; totalPages: number }>({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const resultsAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!query) {
        setResults([]);
        setMeta({ page: 1, totalPages: 1 });
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await storefrontApi.listProducts({ q: query, sort, page, pageSize: 12 });
        setResults(data.items);
        setMeta({ page: data.page, totalPages: data.totalPages });
      } catch (err: any) {
        setError(err?.message || "Falha ao realizar busca.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [query, sort, page]);

  useEffect(() => {
    if (loading || !query) return;
    const target = resultsAnchorRef.current;
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, query]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && query ? `${origin}/buscar?q=${encodeURIComponent(query)}` : origin), [origin, query]);
  const description = query
    ? `Cuidados Dermosul que combinam com “${query}”.`
    : settings?.defaultDescription || "Descubra fórmulas Dermosul pensadas para o dia a dia.";
  const image = settings?.metaImageUrl || "/media/dermosul/og-image.png";

  usePageMeta({
    title: query ? `Busca por ${query} | Dermosul` : "Buscar cuidados Dermosul",
    description,
    image,
    url: pageUrl,
  });

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main ref={resultsAnchorRef} className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-violet-900">
          {query ? `Resultados para “${query}”` : "Encontre o cuidado que combina com você"}
        </h1>
        <ProductSortBar
          value={sort}
          onChange={(next) =>
            setSearchParams((current) => {
              const params = new URLSearchParams(current);
              params.set("sort", next);
              params.set("page", "1");
              return params;
            })
          }
        />
        {loading && <p className="mt-4 text-sm text-zinc-500">Procurando cuidados Dermosul...</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && <ProductGrid products={results} />}
        {meta.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
            <span>
              Página {meta.page} de {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setSearchParams((current) => {
                    const params = new URLSearchParams(current);
                    params.set("page", String(Math.max(meta.page - 1, 1)));
                    return params;
                  })
                }
                disabled={meta.page === 1}
                className="rounded-full border border-zinc-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() =>
                  setSearchParams((current) => {
                    const params = new URLSearchParams(current);
                    params.set("page", String(Math.min(meta.page + 1, meta.totalPages)));
                    return params;
                  })
                }
                disabled={meta.page === meta.totalPages}
                className="rounded-full border border-zinc-200 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </main>
      <StorefrontFooter />
    </div>
  );
}
