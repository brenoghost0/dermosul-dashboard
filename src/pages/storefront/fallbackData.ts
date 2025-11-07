import type {
  StoreSettings,
  StoreTextBlocks,
  HomeLayoutSection,
  ProductSummary,
  Banner,
} from "../Store/api";
import type { StorefrontMenu } from "./api";

const FALLBACK_TEXT_BLOCKS: StoreTextBlocks = {
  announcement: {
    enabled: true,
    message: "As marcas favoritas da comunidade com preço Dermosul",
    ctaLabel: "Ver novidades",
    ctaHref: "/colecoes/mais-vendidos",
  },
  hero: {
    tag: "beleza brasileira",
    title: "Cuidados Dermosul para a sua rotina",
    subtitle: "Fórmulas assinadas por especialistas nacionais, pensadas pra uma pele leve e luminosa.",
    ctaPrimary: { label: "Explorar cuidados", href: "/colecoes/mais-vendidos" },
    ctaSecondary: { label: "Receber novidades", href: "/pg/club-vantagens" },
  },
  highlights: {
    title: "Escolhas Dermosul",
    subtitle: "Uma curadoria com o que há de mais amado pela nossa comunidade.",
  },
};

export const FALLBACK_HOME_LAYOUT: HomeLayoutSection[] = [
  { id: "hero", type: "hero", enabled: true },
  {
    id: "featured",
    type: "product-grid",
    title: "Favoritos do momento",
    enabled: true,
    limit: 4,
  },
  {
    id: "rituals",
    type: "product-grid",
    title: "Cuidados para todo dia",
    enabled: true,
    limit: 4,
  },
];

const FALLBACK_IMAGE = "/media/dermosul/og-image.png";

export const FALLBACK_PRODUCTS: ProductSummary[] = [
  {
    id: "fallback-prod-1",
    name: "Cleanser Clínico 3 em 1",
    slug: "cleanser-clinico",
    brand: "Dermosul",
    sku: "DERMO-DEMO-001",
    price: 12900,
    compareAtPrice: 15900,
    active: true,
    stockQuantity: 999,
    images: [{ id: "img-1", url: FALLBACK_IMAGE, alt: "Produto Dermosul", position: 0 }],
  },
  {
    id: "fallback-prod-2",
    name: "Sérum Rejuvenescedor Max",
    slug: "serum-rejuvenescedor",
    brand: "Dermosul",
    sku: "DERMO-DEMO-002",
    price: 18900,
    compareAtPrice: 0,
    active: true,
    stockQuantity: 999,
    images: [{ id: "img-2", url: FALLBACK_IMAGE, alt: "Produto Dermosul", position: 0 }],
  },
  {
    id: "fallback-prod-3",
    name: "Hydra Booster Clínico",
    slug: "hydra-booster",
    brand: "Dermosul",
    sku: "DERMO-DEMO-003",
    price: 14900,
    compareAtPrice: 0,
    active: true,
    stockQuantity: 999,
    images: [{ id: "img-3", url: FALLBACK_IMAGE, alt: "Produto Dermosul", position: 0 }],
  },
  {
    id: "fallback-prod-4",
    name: "Proteção Solar Inteligente FPS 60",
    slug: "protecao-solar-inteligente",
    brand: "Dermosul",
    sku: "DERMO-DEMO-004",
    price: 9900,
    compareAtPrice: 0,
    active: true,
    stockQuantity: 999,
    images: [{ id: "img-4", url: FALLBACK_IMAGE, alt: "Produto Dermosul", position: 0 }],
  },
];

export const FALLBACK_COLLECTION_DATA: Record<string, ProductSummary[]> = {
  featured: FALLBACK_PRODUCTS,
  rituals: FALLBACK_PRODUCTS.slice().reverse(),
};

export const FALLBACK_BANNERS: Banner[] = [
  {
    id: "banner-fallback-hero",
    kind: "HERO",
    title: "Dermosul em modo demonstração",
    subtitle: "Ative o backend para ver os conteúdos reais da loja.",
    ctaLabel: "Ver instruções",
    ctaHref: "https://github.com/",
    imageUrl: FALLBACK_IMAGE,
    mobileImageUrl: FALLBACK_IMAGE,
    position: 0,
    active: true,
  },
  {
    id: "banner-fallback-strip",
    kind: "STRIP",
    title: "Conteúdo ilustrativo",
    subtitle: "Os produtos reais aparecem assim que os dados forem carregados.",
    ctaLabel: "Saiba mais",
    ctaHref: "https://github.com/",
    imageUrl: FALLBACK_IMAGE,
    position: 1,
    active: true,
  },
];

export const FALLBACK_STORE_SETTINGS: StoreSettings = {
  id: "fallback-store",
  currency: "BRL",
  defaultTitle: "Dermosul • Cuidados que abraçam sua pele",
  defaultDescription: "Uma curadoria Dermosul com fórmulas exclusivas e marcas queridinhas para a rotina brasileira.",
  primaryColor: "#6C4AB6",
  secondaryColor: "#452A8B",
  accentColor: "#C8B0F4",
  metaImageUrl: FALLBACK_IMAGE,
  typography: null,
  textBlocks: FALLBACK_TEXT_BLOCKS,
  homeLayout: FALLBACK_HOME_LAYOUT,
  seoSettings: null,
  domainSettings: null,
  integrations: null,
  checkoutSettings: null,
};

export const FALLBACK_HEADER_MENU: StorefrontMenu = {
  id: "fallback-header",
  key: "HEADER",
  items: [
    { id: "nav-cuidados", label: "Cuidados", href: "/", position: 0 },
    { id: "nav-hidratacao", label: "Hidratação", href: "/", position: 1 },
  ],
};

export const FALLBACK_FOOTER_MENU: StorefrontMenu = {
  id: "fallback-footer",
  key: "FOOTER",
  items: [
    { id: "sobre", label: "Sobre a Dermosul", href: "/pg/sobre", position: 0 },
    { id: "contato", label: "Contato", href: "/pg/contato", position: 1 },
  ],
};
