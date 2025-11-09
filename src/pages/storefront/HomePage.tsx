import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import ProductGrid from "./components/ProductGrid";
import ProductRail from "./components/ProductRail";
import { useStorefrontContext } from "./StorefrontContext";
import { useRecommendations } from "./useRecommendations";
import { storefrontApi } from "./api";
import { usePageMeta } from "./usePageMeta";
import type { HomeLayoutSection, ProductSummary } from "../Store/api";
import {
  FALLBACK_HOME_LAYOUT,
  FALLBACK_PRODUCTS,
  FALLBACK_COLLECTION_DATA,
} from "./fallbackData";
import { useProductLikes } from "./ProductLikesContext";

const SLIDER_INTERVAL = 4000;

type HeroSlide = {
  id?: string;
  desktop: string;
  mobile: string;
};

const FALLBACK_HERO_SLIDES: HeroSlide[] = Array.from({ length: 10 }, (_, index) => ({
  desktop: `/banner/bd${index + 1}.jpeg`,
  mobile: `/banner/bc${index + 1}.jpeg`,
}));

function normalizeBannerUrl(url?: string | null): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace(/^\/+/, "/");
      const shouldStripHost =
        pathname.startsWith("/banner/") ||
        pathname.startsWith("/uploads/") ||
        pathname.startsWith("/public/") ||
        (typeof window !== "undefined" && parsed.origin === window.location.origin);
      if (shouldStripHost) {
        return pathname;
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }

  const withoutPublic = trimmed.replace(/^public\//i, "");
  if (withoutPublic.startsWith("/")) return withoutPublic;
  return `/${withoutPublic.replace(/^\/+/, "")}`;
}

export default function HomePage() {
  const { settings } = useStorefrontContext();
  const location = useLocation();
  const layout = useMemo<HomeLayoutSection[]>(() => {
    const source = settings?.homeLayout && settings.homeLayout.length > 0 ? settings.homeLayout : FALLBACK_HOME_LAYOUT;
    return source.map((section) => {
      if (section.id === "featured-collection") {
        const currentTitle = typeof section.title === "string" ? section.title.trim() : "";
        if (!currentTitle || currentTitle === "Lançamentos Dermosul") {
          return { ...section, title: "Novidades em Dermocosméticos" };
        }
      }
      return section;
    });
  }, [settings?.homeLayout]);

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(FALLBACK_HERO_SLIDES);
  const [loadingHero, setLoadingHero] = useState(true);
  const [sectionProducts, setSectionProducts] = useState<Record<string, ProductSummary[]>>({});
  const [loadingSections, setLoadingSections] = useState(false);
  const {
    data: recommendations,
    loading: recommendationsLoading,
  } = useRecommendations(8);
  const { getTopLovedProducts, seedProducts } = useProductLikes();

  const candidateProducts = useMemo(() => {
    const map = new Map<string, ProductSummary>();
    Object.values(sectionProducts).forEach((list) => {
      list.forEach((product) => {
        if (!map.has(product.id)) {
          map.set(product.id, product);
        }
      });
    });
    (recommendations?.trending ?? []).forEach((product) => {
      if (!map.has(product.id)) map.set(product.id, product);
    });
    (recommendations?.newArrivals ?? []).forEach((product) => {
      if (!map.has(product.id)) map.set(product.id, product);
    });
    (recommendations?.customerFavorites ?? []).forEach((product) => {
      if (!map.has(product.id)) map.set(product.id, product);
    });
    const list = Array.from(map.values());
    return list;
  }, [sectionProducts, recommendations?.trending, recommendations?.newArrivals, recommendations?.customerFavorites]);

  useEffect(() => {
    if (candidateProducts.length > 0) {
      seedProducts(candidateProducts, { maxLikes: 2999 });
    }
  }, [candidateProducts, seedProducts]);

  const mostLovedProducts = useMemo(() => {
    const topLoved = getTopLovedProducts(candidateProducts, 8);
    if (topLoved.length > 0) return topLoved;
    return recommendations?.trending ?? candidateProducts.slice(0, 8);
  }, [getTopLovedProducts, candidateProducts, recommendations?.trending]);

  useEffect(() => {
    let isMounted = true;
    async function loadHeroBanners() {
      try {
        const response = await storefrontApi.listBanners({ kind: "HERO", activeOnly: true });
        const active = response.filter((banner) => banner.active !== false);
        if (!isMounted) return;
        if (active.length > 0) {
          const mapped = active.map<HeroSlide>((banner, idx) => {
            const fallback = FALLBACK_HERO_SLIDES[idx % FALLBACK_HERO_SLIDES.length];
            const desktop = normalizeBannerUrl(banner.imageUrl) || fallback.desktop;
            const mobile = normalizeBannerUrl(banner.mobileImageUrl || banner.imageUrl) || fallback.mobile || desktop;
            return {
              id: banner.id,
              desktop,
              mobile,
            };
          });
          setHeroSlides(mapped);
        } else {
          setHeroSlides(FALLBACK_HERO_SLIDES);
        }
      } catch (error) {
        console.warn("Falha ao carregar banners do hero", error);
        if (isMounted) {
          setHeroSlides(FALLBACK_HERO_SLIDES);
        }
      } finally {
        if (isMounted) {
          setLoadingHero(false);
        }
      }
    }
    loadHeroBanners();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const focusSection = (location.state as { focusSection?: string; focusTimestamp?: number } | null)?.focusSection;
    if (!focusSection) return;
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("dermosul:scroll-to", {
        detail: { target: focusSection },
      })
    );
  }, [location.state]);

  useEffect(() => {
    let isMounted = true;
    async function loadSections() {
      setLoadingSections(true);
      const result: Record<string, ProductSummary[]> = {};
      for (const section of layout) {
        if (section.enabled === false || section.type !== "product-grid") continue;
        try {
          let items: ProductSummary[] = [];
          if (section.collectionSlug) {
            const response = await storefrontApi.getCollectionProducts(section.collectionSlug, {
              page: 1,
              pageSize: section.limit ?? 8,
              sort: "relevance",
            });
            items = response.items;
          } else if (section.categorySlug) {
            const response = await storefrontApi.getCategoryProducts(section.categorySlug, {
              page: 1,
              pageSize: section.limit ?? 8,
              sort: "relevance",
            });
            items = response.items;
          } else {
            const response = await storefrontApi.listProducts({
              page: 1,
              pageSize: section.limit ?? 8,
              sort: "relevance",
            });
            items = response.items;
          }
          result[section.id] = items.length > 0 ? items : FALLBACK_COLLECTION_DATA[section.id] || FALLBACK_PRODUCTS;
        } catch {
          result[section.id] = FALLBACK_COLLECTION_DATA[section.id] || FALLBACK_PRODUCTS;
        }
      }
      if (isMounted) {
        setSectionProducts(result);
        setLoadingSections(false);
      }
    }
    loadSections();
    return () => {
      isMounted = false;
    };
  }, [layout]);

  const metaImage = settings?.metaImageUrl || heroSlides[0]?.desktop || "/media/dermosul/og-image.png";
  usePageMeta({
    title: settings?.seoSettings?.defaultTitle || settings?.defaultTitle || "Dermosul – Dermocosméticos para a rotina real",
    description:
      settings?.seoSettings?.defaultDescription ||
      settings?.defaultDescription ||
      "Dermosul conecta você às maiores marcas de dermocosméticos do Brasil, com curadoria especializada.",
    image: metaImage,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="pt-10 space-y-6">
          <HeroBannerSlider slides={heroSlides} loading={loadingHero} />
          <HeroHighlightBar />
        </section>
        {!recommendationsLoading && (
          <section className="mt-12 grid gap-10" data-section-id="home-products">
            {mostLovedProducts.length ? (
              <ProductRail
                title="Os mais amados agora"
                products={mostLovedProducts}
                emptyState="Assim que surgirem queridinhos, mostramos aqui."
              />
            ) : null}
            {recommendations?.newArrivals?.length ? (
              <ProductRail
                title="Acabou de chegar"
                products={recommendations.newArrivals}
                emptyState="Fique de olho: novidades Dermosul chegam fresquinhas por aqui."
              />
            ) : null}
            {recommendations?.customerFavorites?.length ? (
              <ProductRail
                title="Pensado para você"
                products={recommendations.customerFavorites}
                emptyState="Quando cruzarmos seus favoritos, eles aparecem neste espaço."
              />
            ) : null}
          </section>
        )}

        <section className="mt-12 grid gap-12">
          {layout
            .filter((section) => section.enabled !== false && section.id !== "hero")
            .map((section) => (
              <SectionRenderer
                key={section.id}
                section={section}
                products={sectionProducts[section.id] || []}
                loading={loadingSections}
              />
            ))}
        </section>
      </main>
      <StorefrontFooter />
    </div>
  );
}

function HeroBannerSlider({ slides, loading }: { slides: HeroSlide[]; loading: boolean }) {
  const [index, setIndex] = useState(0);
  const activeSlides = slides.length > 0 ? slides : FALLBACK_HERO_SLIDES;
  const totalSlides = activeSlides.length;

  useEffect(() => {
    setIndex(0);
  }, [totalSlides]);

  useEffect(() => {
    if (typeof window === "undefined" || totalSlides <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % totalSlides);
    }, SLIDER_INTERVAL);
    return () => window.clearInterval(timer);
  }, [totalSlides]);

  const handleNavigate = (direction: number) => {
    setIndex((prev) => (prev + direction + totalSlides) % totalSlides);
  };

  return (
    <div className="relative overflow-hidden rounded-[36px] bg-neutral-100 shadow-xl" aria-busy={loading}>
      <div className="relative w-full">
        {activeSlides.map((slide, idx) => {
          const isActive = idx === index;
          return (
            <div
              key={slide.id ?? slide.desktop ?? idx}
              className={`transition-opacity duration-500 ease-out ${
                isActive ? "relative block opacity-100" : "absolute inset-0 opacity-0 pointer-events-none"
              }`}
            >
              <picture className="block w-full">
                <source media="(max-width: 767px)" srcSet={slide.mobile} />
                <img
                  src={slide.desktop}
                  alt={`Banner Dermosul ${idx + 1}`}
                  className="mx-auto block w-full max-w-full bg-neutral-100 object-contain"
                  loading="lazy"
                />
              </picture>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => handleNavigate(-1)}
        className="absolute left-6 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400 bg-white/90 text-violet-600 shadow transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
        aria-label="Banner anterior"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M9.667 3.333 5.333 7.667l4.334 4.333"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => handleNavigate(1)}
        className="absolute right-6 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400 bg-white/90 text-violet-600 shadow transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2"
        aria-label="Próximo banner"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="m6.333 3.333 4.334 4.334-4.334 4.333"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-2">
        {activeSlides.map((_, idx) => (
          <button
            key={`indicator-${idx}`}
            type="button"
            onClick={() => setIndex(idx)}
            aria-label={`Selecionar banner ${idx + 1}`}
            className={`h-2.5 w-2.5 rounded-full border transition ${
              idx === index
                ? "scale-110 border-violet-600 bg-violet-600"
                : "border-white/70 bg-white/70 hover:border-violet-400 hover:bg-violet-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function HeroHighlightBar() {
  return (
    <div className="flex justify-center">
      <div className="flex w-full max-w-4xl items-center gap-4 rounded-full bg-violet-600 px-6 py-3 text-white shadow-lg">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
          <svg width="18" height="24" viewBox="0 0 18 24" fill="none" aria-hidden="true">
            <path
              d="M9 1 4.5 8.4a1.5 1.5 0 0 0-.24.81V15a4.74 4.74 0 0 0 4.5 4.95V23h1.5v-3.05A4.74 4.74 0 0 0 13.74 15V9.21c0-.28-.084-.55-.24-.81L9 1Z"
              fill="white"
              opacity="0.85"
            />
          </svg>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.32em]">
          Dermocosméticos para todas as necessidades
        </span>
      </div>
    </div>
  );
}

function SectionRenderer({
  section,
  products,
  loading,
}: {
  section: HomeLayoutSection;
  products: ProductSummary[];
  loading: boolean;
}) {
  if (section.type === "product-grid") {
    return (
      <section className="space-y-4">
        <header className="flex flex-col gap-2">
          {section.title && <h2 className="text-xl font-semibold text-violet-900">{section.title}</h2>}
          {section.subtitle && <p className="text-sm text-violet-600">{section.subtitle}</p>}
        </header>
        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: section.limit ?? 4 }).map((_, idx) => (
              <div key={idx} className="h-64 animate-pulse rounded-2xl border border-violet-100 bg-white/70" />
            ))}
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </section>
    );
  }
  return null;
}
