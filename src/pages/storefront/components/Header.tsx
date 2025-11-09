import { FormEvent, MouseEvent, useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStorefrontContext } from "../StorefrontContext";
import { useCart } from "../CartContext";
import { StoreTextBlocks } from "../../Store/api";
import type { StorefrontMenu } from "../api";
import { STORE_BRANDS } from "../brandData";

const FALLBACK_CATEGORIES = [
  { label: "Tratamento", href: "/c/tratamento" },
  { label: "Limpeza", href: "/c/limpeza" },
  { label: "Hidratação", href: "/c/hidratacao" },
  { label: "Proteção", href: "/c/protecao" },
  { label: "Prevenção", href: "/c/prevencao" },
  { label: "Correção", href: "/c/correcao" },
  { label: "Reparação", href: "/c/reparacao" },
  { label: "Mais vendidos", href: "/colecoes/mais-vendidos" },
  { label: "Conheça a Dermosul", href: "/pg/sobre" },
];

const HIDDEN_MENU_LABELS = new Set(["newsletter"]);
const CATEGORY_ORDER = new Map(
  FALLBACK_CATEGORIES.map((category, index) => [category.label.trim().toLowerCase(), index])
);
const MENU_TAGLINES = new Map<string, string>([
  ["tratamento", "Rotinas completas para tratar cada etapa da pele."],
  ["limpeza", "Texturas que limpam bem e deixam o rosto confortável."],
  ["hidratação", "Hidratantes que seguram água sem pesar ou engordurar."],
  ["proteção", "Filtro, antioxidante e defesa diária contra luz e poluição."],
  ["prevenção", "Ativos que mantêm a pele firme antes dos sinais aparecerem."],
  ["correção", "Fórmulas diretas para manchas, acne e textura irregular."],
  ["reparação", "Socorro imediato para acalmar e reconstruir a barreira."],
  ["mais vendidos", "Os queridinhos que a comunidade recompra sem pensar."],
  ["conheça a dermosul", "Nossa história, fórmulas exclusivas e especialistas."],
]);

function isHiddenMenuLabel(label: string | null | undefined) {
  if (!label) return false;
  return HIDDEN_MENU_LABELS.has(label.trim().toLowerCase());
}

function useAnnouncement(textBlocks: StoreTextBlocks | null | undefined) {
  if (!textBlocks?.announcement?.enabled) return null;
  return {
    message: textBlocks.announcement.message || "Dermosul • Beleza feita no Brasil",
    ctaLabel: textBlocks.announcement.ctaLabel || "Saiba mais",
    ctaHref: textBlocks.announcement.ctaHref || "/pg/sobre",
  };
}

export default function StorefrontHeader() {
  const { settings, headerMenu } = useStorefrontContext();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const announcement = useAnnouncement(settings?.textBlocks || null);
  const cartCount = useMemo(() => (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0), [cart?.items]);

  const requestProductFocus = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("dermosul:scroll-to", {
        detail: { target: "home-products" },
      })
    );
  }, []);

  const handleLogoClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (location.pathname === "/") {
        requestProductFocus();
        return;
      }

      navigate("/", {
        state: { focusSection: "home-products", focusTimestamp: Date.now() },
      });
    },
    [location.pathname, navigate, requestProductFocus]
  );

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (search.trim()) {
      navigate(`/buscar?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <header className="border-b border-violet-100 bg-white">
      {announcement && (
        <div className="bg-violet-600 px-4 py-2 text-center text-xs text-white">
          <span>{announcement.message}</span>
          <Link to={announcement.ctaHref} className="ml-2 underline">
            {announcement.ctaLabel}
          </Link>
        </div>
      )}
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-5">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" onClick={handleLogoClick} className="flex items-center gap-2 text-violet-800">
            <span className="text-xl font-semibold">Dermosul</span>
            <span className="text-xs uppercase tracking-wide text-violet-500">store</span>
          </Link>
          <Link
            to="/carrinho"
            className={`group relative inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-[0_18px_45px_-22px_rgba(79,70,229,0.55)] ring-2 ring-violet-200 transition hover:-translate-y-0.5 hover:shadow-[0_24px_55px_-25px_rgba(79,70,229,0.65)] hover:ring-violet-300 ${
              cartCount > 0 ? "animate-cart-icon" : ""
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6h15l-1.5 9h-12z" />
                <path d="M6 6l-1-3H3" />
                <circle cx="9" cy="20" r="1.25" />
                <circle cx="18" cy="20" r="1.25" />
              </svg>
            </span>
            <div className="flex flex-col leading-tight text-right">
              <span className="text-[10px] uppercase tracking-[0.28em] text-slate-500 group-hover:text-slate-600">Carrinho</span>
              <span className="text-[14px] font-semibold text-violet-700 group-hover:text-violet-800">Ver itens</span>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-inner">
              {cartCount}
            </span>
          </Link>
        </div>
        <div className="flex items-start justify-between gap-3 md:items-center">
          <form onSubmit={handleSearch} className="flex w-full max-w-lg items-center gap-2 rounded-full border border-violet-200 px-4 py-2 text-sm">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="O que você procura hoje?"
              aria-label="Buscar produtos Dermosul"
              className="flex-1 border-none outline-none"
            />
            <button type="submit" className="rounded-full bg-violet-600 px-3 py-1 text-xs font-medium text-white">
              Pesquisar
            </button>
          </form>
        </div>
      </div>
      <BrandRibbon />
      <MegaMenu headerMenu={headerMenu} />
    </header>
  );
}

function MegaMenu({ headerMenu }: { headerMenu: StorefrontMenu | null }) {
  const topLevel = useMemo(() => {
    const items = (headerMenu?.items || []).filter(
      (item) => !item.parentId && !isHiddenMenuLabel(item.label)
    );

    return items.sort((a, b) => {
      const aKey = a.label?.trim().toLowerCase() ?? "";
      const bKey = b.label?.trim().toLowerCase() ?? "";
      const aOrder = CATEGORY_ORDER.get(aKey);
      const bOrder = CATEGORY_ORDER.get(bKey);

      if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return a.position - b.position;
    });
  }, [headerMenu?.items]);

  const groups = useMemo(() => {
    const allItems = headerMenu?.items || [];
    const accentPhrases = ["Essenciais Dermosul", "Para todos os momentos", "Recomendados pelos especialistas", "Favoritos da comunidade"];

    const resolveChildren = (parentId: string) =>
      allItems
        .filter((child) => child.parentId === parentId)
        .sort((a, b) => a.position - b.position)
        .map((child) => ({ href: child.href, label: child.label }))
        .filter((child) => !isHiddenMenuLabel(child.label));

    const dynamicGroups = new Map<
      string,
      { title: string; accent: string; highlightHref: string; items: Array<{ href: string; label: string }> }
    >();

    topLevel.forEach((highlight, index) => {
      const key = highlight.label?.trim().toLowerCase() ?? "";
      const children = resolveChildren(highlight.id);
      const items = children.length ? children : [{ href: highlight.href, label: highlight.label }];

      if (!items.length || isHiddenMenuLabel(highlight.label)) return;

      dynamicGroups.set(key, {
        title: highlight.label,
        accent: accentPhrases[index % accentPhrases.length],
        highlightHref: highlight.href,
        items,
      });
    });

    const orderedGroups = FALLBACK_CATEGORIES.map((category, index) => {
      const key = category.label.trim().toLowerCase();
      const accent = accentPhrases[index % accentPhrases.length];
      const dynamic = dynamicGroups.get(key);

      if (dynamic) {
        return { ...dynamic, accent };
      }

      return {
        title: category.label,
        accent,
        highlightHref: category.href,
        items: [{ href: category.href, label: category.label }],
      };
    });

    const extras = Array.from(dynamicGroups.entries())
      .filter(([key]) => !CATEGORY_ORDER.has(key))
      .map(([_, group]) => group);

    return [...orderedGroups, ...extras]
      .filter((group) => group.items.length)
      .map((group) => {
        const titleKey = group.title.trim().toLowerCase();
        return {
          ...group,
          primaryHref: group.highlightHref,
          tagline: MENU_TAGLINES.get(titleKey) ?? "Curadoria clínica para rotina inteligente.",
        };
      })
      .slice(0, 8);
  }, [headerMenu?.items, topLevel]);

  const categoryChips = useMemo(() => {
    const allItems = headerMenu?.items || [];
    const aggregated = topLevel
      .flatMap((parent) => {
        const primary = [{ label: parent.label, href: parent.href, position: parent.position }];
        const children = allItems
          .filter((child) => child.parentId === parent.id)
          .sort((a, b) => a.position - b.position)
          .map((child) => ({ label: child.label, href: child.href, position: child.position + parent.position / 10 }));
        return [...primary, ...children];
      })
      .filter((item) => Boolean(item.href && item.label) && !isHiddenMenuLabel(item.label)) as {
        label: string;
        href: string;
        position: number;
      }[];

    const merged = new Map<string, { label: string; href: string; position: number }>();
    aggregated.forEach((item) => {
      const key = item.label.trim().toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    });

    FALLBACK_CATEGORIES.forEach((fallback, index) => {
      const key = fallback.label.trim().toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, { label: fallback.label, href: fallback.href, position: index });
      }
    });

    const ordered = Array.from(merged.values()).sort((a, b) => {
      const aOrder = CATEGORY_ORDER.get(a.label.trim().toLowerCase());
      const bOrder = CATEGORY_ORDER.get(b.label.trim().toLowerCase());
      if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;
      return a.position - b.position;
    });

    return ordered
      .slice(0, 12)
      .map(({ label, href }) => ({ label, href }));
  }, [headerMenu?.items, topLevel]);

  const handleChatCTA = useCallback(() => {
    if (typeof window === "undefined") return;
    const detail = {
      detail: {
        prompt: "Olá! Quero tirar dúvidas com a dermatologista virtual da Dermosul.",
        source: "mega-menu",
      },
    };
    window.dispatchEvent(new CustomEvent("dermosul:chat:open", detail));
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("dermosul:chat:open", detail));
    }
  }, []);

  return (
    <div className="relative border-t border-transparent bg-gradient-to-b from-[#f8f5ff] via-white to-white">
      <nav
        className="relative mx-auto max-w-6xl px-4 py-10 text-violet-700"
        aria-label="Mapa de categorias Dermosul"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.5fr)]">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            {groups.map((group, index) => {
              const titleKey = group.title.trim().toLowerCase();
              const exploreLabel =
                titleKey === "mais vendidos"
                  ? "Explorar mais vendidos"
                  : `Explorar ${group.title.toLowerCase()}`;
              return (
                <div
                  key={`${group.title}-${index}`}
                  className="flex flex-col justify-between rounded-2xl border border-[#ebe2ff] bg-white p-5 shadow-[0_4px_16px_rgba(99,60,201,0.08)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(107,61,228,0.12)]"
                >
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-300">
                      {group.accent}
                    </p>
                    <h3 className="text-lg font-semibold text-[#331d77] tracking-[0.08em]">
                      {group.title.toUpperCase()}
                    </h3>
                    <p className="text-sm leading-snug text-[#5d4a99]">{group.tagline}</p>
                  </div>
                  <Link
                    to={group.primaryHref}
                    className="mt-6 inline-flex items-center justify-between rounded-full bg-[#f2ecff] px-4 py-2 text-sm font-semibold text-[#5d34c5] transition-all duration-200 hover:bg-[#e8ddff] hover:translate-x-1"
                  >
                    {exploreLabel}
                    <span aria-hidden="true" className="text-base">
                      →
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
          <aside className="relative overflow-hidden rounded-[32px] border border-transparent bg-gradient-to-br from-[#d0c1ff]/60 via-white to-[#f7f2ff] p-[2px] shadow-[0_30px_70px_-40px_rgba(68,33,158,0.9)]">
            <div className="relative flex h-full flex-col justify-between rounded-[30px] bg-gradient-to-br from-[#faf5ff] via-white to-[#f1e8ff] p-6 text-[#422980]">
              <div className="pointer-events-none absolute inset-0 opacity-60">
                <div className="absolute -right-16 top-6 h-48 w-48 rounded-full bg-gradient-to-br from-[#b599ff] to-transparent blur-3xl" />
                <div className="absolute -bottom-12 left-0 h-40 w-40 rounded-full bg-gradient-to-br from-[#7d5df7]/60 to-transparent blur-2xl" />
              </div>
              <div className="relative space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#6c4af6] shadow-[0_4px_16px_rgba(97,64,220,0.15)]">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ffb347] to-[#ffcc33] animate-pulse" />
                  Dermatologista virtual
                </span>
                <h4 className="text-2xl font-black uppercase leading-tight tracking-[0.18em] text-transparent bg-gradient-to-r from-[#4c1d95] via-[#5b21b6] to-[#7c3aed] bg-clip-text">
                  Converse com nossa especialista
                </h4>
                <p className="text-sm leading-relaxed text-[#5b469d]">
                  Atendimento instantâneo com inteligência dermatológica exclusiva Dermosul. Recomendações sob medida,
                  resultados acompanhados em tempo real.
                </p>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-[#7a5bff]">
                  <span>Resposta em segundos</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] animate-ping" />
                </div>
              </div>
              <button
                type="button"
                onClick={handleChatCTA}
                className="group relative mt-6 inline-flex items-center justify-between overflow-hidden rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-18px_rgba(91,33,182,0.8)] transition duration-200 hover:scale-[1.015]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#6d28d9] via-[#7c3aed] to-[#a855f7]" />
                <span className="absolute inset-0 bg-white/40 opacity-0 blur-xl transition group-hover:opacity-40" />
                <span className="relative">Converse agora</span>
                <span aria-hidden="true" className="relative text-base">
                  →
                </span>
              </button>
            </div>
          </aside>
        </div>
      </nav>
    </div>
  );
}

function BrandRibbon() {
  return (
    <div className="border-t border-b border-violet-100 bg-gradient-to-r from-white via-[#f8f6ff] to-white">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3 text-xs">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.35em] text-violet-400">
          Marcas
        </span>
        {STORE_BRANDS.map((brand) => (
          <Link
            key={brand.label}
            to={brand.href}
            className="whitespace-nowrap rounded-full border border-transparent bg-white/80 px-3 py-1 text-[12px] font-semibold text-violet-700 shadow-[0_6px_15px_-12px_rgba(76,56,205,0.6)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-900"
          >
            {brand.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
