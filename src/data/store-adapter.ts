import { prisma } from "../db/prisma.js";
import { Prisma } from "@prisma/client";
import type { BannerKind, Coupon, ProductVariant } from "@prisma/client";
import dayjs from "dayjs";
import { generateUniqueId, generateShortId, generateUniqueNumericOrderId } from "../utils/index.js";
import { getPaymentProvider } from "../lib/payment/index.js";
import type { PaymentRequest } from "../lib/payment/types.js";
import type {
  LuckyWheelSettings,
  LuckyWheelPrize,
  LuckyWheelSpinResult,
  LuckyWheelSpinPayload,
  LuckyWheelPublicState,
  LuckyWheelPrizeType,
  LuckyWheelDisplayRules,
  LuckyWheelLimits,
} from "../types/lucky-wheel";

type CartProductContext = {
  categories: string[];
  collections: string[];
};

type CouponTargetsSet = {
  products: Set<string>;
  collections: Set<string>;
  categories: Set<string>;
  excludedProducts: Set<string>;
};

type CouponEvaluationContext = {
  cart: CartWithRelations;
  subtotalCents: number;
  customerId?: string | null;
  strict?: boolean;
  productContext?: Map<string, CartProductContext>;
};

type ResolvedCouponPayload = {
  coupon: Coupon;
  discountCents: number;
  productContext?: Map<string, CartProductContext>;
};

const validateCpf = (cpf: string): boolean => {
  const cleanedCpf = cpf.replace(/\D/g, "");
  if (cleanedCpf.length !== 11 || /^(\d)\1+$/.test(cleanedCpf)) {
    return false;
  }
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanedCpf.substring(9, 10))) {
    return false;
  }
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanedCpf.substring(10, 11))) {
    return false;
  }
  return true;
};

const DEFAULT_TYPOGRAPHY = Object.freeze({
  heading: {
    fontFamily: "Montserrat",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: "0em",
  },
});

const DEFAULT_BRAND_COLORS = Object.freeze({
  primary: "#6C4AB6",
  secondary: "#452A8B",
  accent: "#C8B0F4",
});

const DEFAULT_CATEGORIES = Object.freeze([
  { name: "Tratamento", slug: "tratamento", description: "Cuidados que transformam sua pele todos os dias." },
  { name: "Limpeza", slug: "limpeza", description: "Limpeza sensorial, eficaz e com ativos dermatológicos." },
  { name: "Hidratação", slug: "hidratacao", description: "Texturas inteligentes para manter barreira e equilíbrio da pele." },
  { name: "Proteção", slug: "protecao", description: "Fotoproteção e blindagem urbana para todos os tipos de pele." },
  { name: "Prevenção", slug: "prevencao", description: "Cuidados preventivos que prolongam resultados e juventude da pele." },
  { name: "Correção", slug: "correcao", description: "Soluções corretivas indicadas pelos nossos especialistas Dermosul." },
  { name: "Reparação", slug: "reparacao", description: "Reparação intensiva para resgatar vitalidade e conforto da pele." },
]);

const DEFAULT_TEXT_BLOCKS = Object.freeze({
  announcement: {
    enabled: true,
    message: "As marcas queridinhas da nossa comunidade com preço especial Dermosul.",
    ctaLabel: "Ver novidades",
    ctaHref: "/colecoes/mais-vendidos",
  },
  hero: {
    tag: "beleza brasileira",
    title: "Seu momento de cuidado começa aqui",
    subtitle:
      "Fórmulas assinadas pelos especialistas Dermosul, pensadas para a rotina real e sem complicação.",
    ctaPrimary: { label: "Explorar cuidados", href: "/colecoes/mais-vendidos" },
    ctaSecondary: { label: "Receber novidades", href: "/pg/club-vantagens" },
  },
  highlights: {
    title: "Escolhas Dermosul",
    subtitle: "Produtos que entregam resultado e abraçam sua pele no dia a dia.",
  },
  newsletter: {
    title: "Receba primeiro",
    subtitle: "Histórias, dicas e lançamentos fresquinhos direto no seu e-mail.",
    placeholder: "Digite seu e-mail",
    ctaLabel: "Quero começar",
    legalText: "Prometemos enviar só o que faz bem pra sua pele.",
  },
  footer: {
    description:
      "A Dermosul conecta ciência e carinho para criar cuidados que abraçam cada pele brasileira.",
    contactEmail: "ofertas@dermosul.com.br",
    contactPhone: "+55 11 4000-0000",
    serviceHours: "Seg a Sex, 9h às 18h",
    address: "Av. das Clínicas, 240 - São Paulo/SP",
  },
  trustbar: [
    { icon: "shield-check", label: "Desenvolvido com dermatologistas" },
    { icon: "leaf", label: "Texturas leves e veganas" },
    { icon: "sparkles", label: "Resultados reais, sem exageros" },
  ],
  checkout: {
    pixMessage: "Pix aprovado, a gente já prepara seu pedido com todo carinho.",
    cardMessage: "Cartão de crédito com parcelamento leve, rapidinho e seguro.",
    successMessage: "Pedido confirmado! Obrigada por confiar seus cuidados à Dermosul.",
  },
});

const DEFAULT_HOME_LAYOUT = Object.freeze([
  { id: "announcement-bar", type: "announcement", enabled: true },
  { id: "hero", type: "hero", enabled: true },
  {
    id: "featured-collection",
    type: "product-grid",
    title: "Novidades em Dermocosméticos",
    collectionSlug: "novidades",
    limit: 8,
  },
  {
    id: "bestsellers",
    type: "product-grid",
    title: "Os mais pedidos",
    collectionSlug: "mais-vendidos",
    limit: 8,
  },
  { id: "banner-strip", type: "banner", bannerKind: "STRIP", enabled: true },
  {
    id: "testimonials",
    type: "testimonials",
    enabled: true,
    source: "default",
  },
  { id: "newsletter", type: "newsletter", enabled: true },
]);

const DEFAULT_SEO_SETTINGS = Object.freeze({
  defaultTitle: "Dermosul | Beleza que conversa com a sua pele",
  defaultDescription:
    "Cuidados criados por especialistas Dermosul para acompanhar cada etapa da sua rotina, com texturas leves e resultados reais.",
  ogTitle: "Dermosul • Cuidados que abraçam sua pele",
  ogDescription:
    "Uma curadoria de fórmulas exclusivas, pensada por dermatologistas brasileiros para o seu dia a dia.",
  metaImageUrl: "/media/dermosul/og-image.png",
  twitterCard: "summary_large_image",
});

const DEFAULT_DOMAIN_SETTINGS = Object.freeze({
  primaryDomain: "",
  subdomain: "store.dermosul.com.br",
  previewDomain: "https://preview.dermosul.com.br",
  customDomains: [] as string[],
});

const DEFAULT_INTEGRATIONS = Object.freeze({
  googleAnalyticsId: "",
  googleTagManagerId: "",
  metaPixelId: "",
  tiktokPixelId: "",
  pinterestTagId: "",
  emailMarketing: {
    provider: "rd-station",
    apiKey: "",
    listId: "",
  },
  whatsappBusiness: {
    number: "+55 11 4000-0000",
    message: "Olá! Quero falar com a Dermosul.",
  },
  customScripts: [] as Array<{ id: string; position: "head" | "body"; code: string }>,
});

const DEFAULT_CHECKOUT_SETTINGS = Object.freeze({
  shipping: {
    freeShippingOverCents: 40000,
    allowPickup: false,
    deliveryEstimateText: "Entrega em até 5 dias úteis nas capitais.",
  },
  payment: {
    availableMethods: ["pix", "cartao"] as Array<"pix" | "cartao">,
    defaultStatus: "aguardando_pagamento" as const,
    manualPix: {
      enabled: false,
      instructions: "Envie o comprovante via WhatsApp para agilizar a confirmação.",
    },
  },
  notifications: {
    sendEmail: true,
    sendWhatsapp: true,
  },
});

const DEFAULT_LUCKY_WHEEL_SETTINGS: LuckyWheelSettings = {
  enabled: true,
  headline: "Roleta da Sorte Dermosul",
  subheadline: "Um mimo pra você.",
  description:
    "Gire e descubra cuidados presentes da Dermosul. Cada prêmio foi criado para deixar sua experiência ainda mais especial.",
  ctaLabel: "Liberamos presentes exclusivos hoje",
  buttonLabel: "GIRAR ROLETA",
  prizes: [
    {
      id: "frete-gratis",
      label: "Frete grátis",
      type: "FREE_SHIPPING" as const,
      probability: 12,
      freeShipping: true,
      sliceColor: "#F4ECFF",
      textColor: "#5136A8",
      icon: "sparkles",
      resultMessage: "🎉 Parabéns! Você ganhou frete grátis nesta compra!",
      limit: { daily: null, monthly: null, total: null },
    },
    {
      id: "cupom-10",
      label: "10% OFF",
      type: "PERCENT_DISCOUNT" as const,
      probability: 24,
      coupon: { type: "PERCENT" as const, value: 10, autoApply: true, durationMinutes: 1440 },
      sliceColor: "#EAF4FF",
      textColor: "#3D3993",
      icon: "badge-percent",
      resultMessage: "💜 Você ganhou 10% OFF — já aplicamos o carinho no carrinho!",
      limit: { daily: null, monthly: null, total: null },
    },
    {
      id: "cupom-20",
      label: "20% OFF",
      type: "PERCENT_DISCOUNT" as const,
      probability: 18,
      coupon: { type: "PERCENT" as const, value: 20, autoApply: true, durationMinutes: 1440 },
      sliceColor: "#FFF0F8",
      textColor: "#5D38A9",
      icon: "stars",
      resultMessage: "💸 Incrível! Cupom de 20% OFF aplicado automaticamente.",
      limit: { daily: null, monthly: null, total: null },
    },
    {
      id: "cupom-30",
      label: "30% OFF",
      type: "PERCENT_DISCOUNT" as const,
      probability: 8,
      coupon: { type: "PERCENT" as const, value: 30, autoApply: true, durationMinutes: 1440 },
      sliceColor: "#FEF5E7",
      textColor: "#6A3FE4",
      icon: "gift",
      resultMessage: "🎁 Surpresa! Você levou 30% OFF nesta compra de carinho.",
      limit: { daily: null, monthly: null, total: null },
    },
    {
      id: "pedido-gratis",
      label: "Pedido 100% grátis",
      type: "FREE_ORDER" as const,
      probability: 4,
      freeOrder: true,
      sliceColor: "#EAF7F6",
      textColor: "#4527A0",
      icon: "crown",
      resultMessage: "🌟 UAU! Transformamos esse pedido em 100% Dermosul por nossa conta.",
      limit: { daily: 1, monthly: 10, total: null },
    },
    {
      id: "tente-novamente",
      label: "Tente novamente",
      type: "MESSAGE" as const,
      probability: 34,
      message: "😢 Que pena! Tente novamente na próxima compra.",
      sliceColor: "#F9F7FF",
      textColor: "#7C70B8",
      resultMessage: "😢 Que pena! Tente novamente na próxima compra.",
      limit: { daily: null, monthly: null, total: null },
    },
  ],
  design: {
    overlayColor: "rgba(9, 7, 19, 0.75)",
    overlayOpacity: 0.72,
    blurRadius: 22,
    borderColor: "#BFA8FF",
    wheelBackground: "#FFFFFF",
    wheelShadow: "0 60px 140px rgba(47, 18, 89, 0.28)",
    pointerColor: "#D9B76E",
    pointerShadow: "0 12px 30px rgba(217, 183, 110, 0.35)",
    buttonColor: "#6B3DE4",
    buttonTextColor: "#FFFFFF",
    buttonShadow: "0 25px 70px rgba(107, 61, 228, 0.45)",
    highlightColor: "#F5E9FF",
    wheelGlowColor: "rgba(191, 168, 255, 0.55)",
    fontFamily: "'Poppins', 'Outfit', sans-serif",
    logoUrl: null,
    showLogo: true,
    sound: {
      enabled: true,
      spin: null,
      win: null,
      lose: null,
    },
  },
  limits: {
    globalDaily: null,
    globalMonthly: null,
    perPrize: {},
  },
  displayRules: {
    showOn: ["cart"],
    frequency: "once_per_session",
    showAgainAfterHours: 24,
    perSessionMaxSpins: 1,
    requireAuth: false,
  },
  messages: {
    winDefault: "🎉 Parabéns! Você ganhou frete grátis nesta compra!",
    loseDefault: "😢 Que pena! Tente novamente na próxima compra.",
    almostThere: "✨ Quase lá! Não desista — sua sorte pode mudar!",
    alreadyPlayed: "Você já recebeu um presente Dermosul nesta sessão.",
    blocked: "Voltamos em breve com novas premiações Dermosul.",
  },
  analytics: {
    enableTracking: true,
  },
};

const ALLOWED_WHEEL_PAGES = new Set(["cart", "checkout", "post_purchase"]);
const ALLOWED_WHEEL_FREQUENCIES = new Set(["once_per_session", "once_per_customer", "always"]);

const TEST_CARD_NUMBER = (process.env.TEST_CARD_NUMBER || "4111111111111111").replace(/\D/g, "");
const TEST_CARD_CVV = (process.env.TEST_CARD_CVV || "").replace(/\D/g, "");
const TEST_CARD_CPF = (process.env.TEST_CARD_CPF || "").replace(/\D/g, "");
const ALLOWED_PRIZE_TYPES = new Set<LuckyWheelPrizeType>([
  "PERCENT_DISCOUNT",
  "AMOUNT_DISCOUNT",
  "FREE_SHIPPING",
  "FREE_ORDER",
  "MESSAGE",
  "CUSTOM",
]);

const cloneLuckyWheelSettings = (): LuckyWheelSettings =>
  JSON.parse(JSON.stringify(DEFAULT_LUCKY_WHEEL_SETTINGS)) as LuckyWheelSettings;

const sanitizeNullableNumber = (value: unknown, fallback: number | null = null): number | null => {
  if (value === undefined || value === null || value === "") {
    return fallback ?? null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback ?? null;
  }
  return Math.floor(parsed);
};

const sanitizeProbability = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Number(parsed.toFixed(4));
};

const sanitizeShowOn = (value: unknown, fallback: Array<"cart" | "checkout" | "post_purchase">): Array<"cart" | "checkout" | "post_purchase"> => {
  if (!Array.isArray(value)) return [...fallback];
  const sanitized = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter((item): item is "cart" | "checkout" | "post_purchase" => ALLOWED_WHEEL_PAGES.has(item));
  return sanitized.length > 0 ? sanitized : [...fallback];
};

function sanitizePrize(raw: any, fallback?: LuckyWheelPrize): LuckyWheelPrize | null {
  const base: LuckyWheelPrize =
    fallback !== undefined
      ? JSON.parse(JSON.stringify(fallback))
      : {
          id: generateShortId(),
          label: "Presente Dermosul",
          description: "",
          type: "MESSAGE",
          probability: 0,
          enabled: true,
          message: "✨ Quase lá! Não desista — sua sorte pode mudar!",
          sliceColor: "#F9F7FF",
          textColor: "#6B3DE4",
          icon: "sparkles",
          coupon: null,
          freeShipping: false,
          freeOrder: false,
          customPayload: null,
          resultMessage: undefined,
          limit: { daily: null, monthly: null, total: null },
        };

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const result = { ...base };

  if (typeof raw.id === "string" && raw.id.trim()) {
    result.id = raw.id.trim();
  } else if (!result.id) {
    result.id = generateShortId();
  }

  if (typeof raw.label === "string" && raw.label.trim()) {
    result.label = raw.label.trim();
  }

  if (typeof raw.description === "string") {
    result.description = raw.description;
  }

  if (typeof raw.enabled === "boolean") {
    result.enabled = raw.enabled;
  }

  if (typeof raw.message === "string") {
    result.message = raw.message;
  }

  if (typeof raw.resultMessage === "string") {
    result.resultMessage = raw.resultMessage;
  }

  if (typeof raw.sliceColor === "string") {
    result.sliceColor = raw.sliceColor;
  }

  if (typeof raw.textColor === "string") {
    result.textColor = raw.textColor;
  }

  if (raw.icon === null) {
    result.icon = null;
  } else if (typeof raw.icon === "string") {
    const trimmed = raw.icon.trim();
    result.icon = trimmed === "" || trimmed === "refresh" ? null : trimmed;
  }

  const typeCandidate = typeof raw.type === "string" ? raw.type.trim().toUpperCase() : null;
  if (typeCandidate && ALLOWED_PRIZE_TYPES.has(typeCandidate as LuckyWheelPrizeType)) {
    result.type = typeCandidate as LuckyWheelPrizeType;
  }

  result.probability = sanitizeProbability(raw.probability, result.probability ?? 0);

  if (raw.customPayload && typeof raw.customPayload === "object") {
    result.customPayload = raw.customPayload as Record<string, unknown>;
  } else if (raw.customPayload === null) {
    result.customPayload = null;
  }

  if (raw.limit && typeof raw.limit === "object") {
    result.limit = {
      daily: sanitizeNullableNumber(raw.limit.daily, result.limit?.daily ?? null),
      monthly: sanitizeNullableNumber(raw.limit.monthly, result.limit?.monthly ?? null),
      total: sanitizeNullableNumber(raw.limit.total, result.limit?.total ?? null),
    };
  } else if (raw.limit === null) {
    result.limit = { daily: null, monthly: null, total: null };
  }

  if (raw.coupon === null) {
    result.coupon = null;
  } else if (raw.coupon && typeof raw.coupon === "object") {
    const couponRaw = raw.coupon as Record<string, unknown>;
    const couponType =
      couponRaw.type === "AMOUNT"
        ? "AMOUNT"
        : couponRaw.type === "PERCENT"
        ? "PERCENT"
        : result.coupon?.type ?? (result.type === "AMOUNT_DISCOUNT" ? "AMOUNT" : "PERCENT");
    const couponValue = Number(couponRaw.value);
    if (Number.isFinite(couponValue) && couponValue > 0) {
      result.coupon = {
        type: couponType,
        value: couponType === "AMOUNT" ? Math.round(couponValue) : Math.round(couponValue),
        autoApply: couponRaw.autoApply === undefined ? result.coupon?.autoApply ?? true : Boolean(couponRaw.autoApply),
        durationMinutes:
          couponRaw.durationMinutes === null || couponRaw.durationMinutes === undefined
            ? null
            : Math.max(1, Math.floor(Number(couponRaw.durationMinutes) || 0)) || null,
      };
    }
  }

  if (raw.freeShipping !== undefined) {
    result.freeShipping = Boolean(raw.freeShipping);
  } else if (result.type === "FREE_SHIPPING") {
    result.freeShipping = true;
  }

  if (raw.freeOrder !== undefined) {
    result.freeOrder = Boolean(raw.freeOrder);
  } else if (result.type === "FREE_ORDER") {
    result.freeOrder = true;
  }

  return result;
}

const sanitizeLimits = (raw: unknown, fallback: LuckyWheelLimits): LuckyWheelLimits => {
  const result: LuckyWheelLimits = {
    globalDaily: fallback?.globalDaily ?? null,
    globalMonthly: fallback?.globalMonthly ?? null,
    perPrize: { ...(fallback?.perPrize ?? {}) },
  };

  if (!raw || typeof raw !== "object") {
    return result;
  }

  const payload = raw as Record<string, unknown>;

  result.globalDaily = sanitizeNullableNumber(payload.globalDaily, result.globalDaily ?? null);
  result.globalMonthly = sanitizeNullableNumber(payload.globalMonthly, result.globalMonthly ?? null);

  if (payload.perPrize && typeof payload.perPrize === "object") {
    const perPrizeRaw = payload.perPrize as Record<string, any>;
    for (const [prizeId, limits] of Object.entries(perPrizeRaw)) {
      if (!limits || typeof limits !== "object") continue;
      result.perPrize![prizeId] = {
        daily: sanitizeNullableNumber(limits.daily, result.perPrize?.[prizeId]?.daily ?? null),
        monthly: sanitizeNullableNumber(limits.monthly, result.perPrize?.[prizeId]?.monthly ?? null),
        total: sanitizeNullableNumber(limits.total, result.perPrize?.[prizeId]?.total ?? null),
      };
    }
  }

  return result;
};

const sanitizeDisplayRules = (raw: unknown, fallback: LuckyWheelDisplayRules): LuckyWheelDisplayRules => {
  const result: LuckyWheelDisplayRules = { ...fallback };
  if (!raw || typeof raw !== "object") {
    return result;
  }
  const payload = raw as Record<string, unknown>;
  result.showOn = sanitizeShowOn(payload.showOn, result.showOn);
  const frequency = typeof payload.frequency === "string" ? payload.frequency.trim().toLowerCase() : "";
  if (ALLOWED_WHEEL_FREQUENCIES.has(frequency)) {
    result.frequency = frequency as LuckyWheelDisplayRules["frequency"];
  }
  result.showAgainAfterHours = sanitizeNullableNumber(payload.showAgainAfterHours, result.showAgainAfterHours ?? null);
  result.perSessionMaxSpins = sanitizeNullableNumber(payload.perSessionMaxSpins, result.perSessionMaxSpins ?? null);
  if (payload.requireAuth !== undefined) {
    result.requireAuth = Boolean(payload.requireAuth);
  }
  if (!result.showOn || result.showOn.length === 0) {
    result.showOn = ["cart"];
  }
  return result;
};

const normalizeLuckyWheelSettings = (raw: unknown): LuckyWheelSettings => {
  const settings = cloneLuckyWheelSettings();
  if (!raw || typeof raw !== "object") {
    return settings;
  }

  const payload = raw as Partial<LuckyWheelSettings>;

  if (typeof payload.enabled === "boolean") {
    settings.enabled = payload.enabled;
  }

  if (typeof payload.headline === "string" && payload.headline.trim()) {
    settings.headline = payload.headline.trim();
  }

  if (typeof payload.subheadline === "string") {
    settings.subheadline = payload.subheadline;
  }

  if (typeof payload.description === "string") {
    settings.description = payload.description;
  }

  if (typeof payload.ctaLabel === "string" && payload.ctaLabel.trim()) {
    settings.ctaLabel = payload.ctaLabel.trim();
  }

  if (typeof payload.buttonLabel === "string" && payload.buttonLabel.trim()) {
    settings.buttonLabel = payload.buttonLabel.trim();
  }

  if (Array.isArray(payload.prizes) && payload.prizes.length > 0) {
    const sanitized: LuckyWheelPrize[] = payload.prizes
      .map((prize, index) => sanitizePrize(prize, settings.prizes[index]))
      .filter((value): value is LuckyWheelPrize => Boolean(value));
    if (sanitized.length > 0) {
      settings.prizes = sanitized;
    }
  }

  if (payload.design && typeof payload.design === "object") {
    settings.design = {
      ...settings.design,
      ...payload.design,
      sound: {
        ...settings.design.sound,
        ...(payload.design.sound ?? {}),
        enabled:
          payload.design.sound && payload.design.sound.enabled !== undefined
            ? Boolean(payload.design.sound.enabled)
            : settings.design.sound?.enabled ?? false,
      },
    };
  }

  settings.limits = sanitizeLimits(payload.limits, settings.limits);
  settings.displayRules = sanitizeDisplayRules(payload.displayRules, settings.displayRules);
  settings.messages = { ...settings.messages, ...(payload.messages ?? {}) };
  settings.analytics = { ...settings.analytics, ...(payload.analytics ?? {}) };

  return settings;
};

const serializeLuckyWheelSettings = (settings: LuckyWheelSettings): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;

const resolveLimitValue = (values: Array<number | null | undefined>): number | null => {
  const eligible = values
    .map((value) => (typeof value === "number" && value >= 0 ? Math.floor(value) : null))
    .filter((value): value is number => value !== null);
  if (eligible.length === 0) return null;
  return Math.min(...eligible);
};

const getTimeThreshold = (hours: number | null | undefined): Date | undefined => {
  if (hours === undefined || hours === null) return undefined;
  const parsed = Number(hours);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return dayjs().subtract(parsed, "hour").toDate();
};

const countSpins = (where: Prisma.LuckyWheelSpinWhereInput) =>
  prisma.luckyWheelSpin.count({ where });

const getGlobalLimitStatus = async (settings: LuckyWheelSettings) => {
  const startOfToday = dayjs().startOf("day").toDate();
  const startOfMonth = dayjs().startOf("month").toDate();
  const [dailyCount, monthlyCount] = await Promise.all([
    settings.limits.globalDaily != null
      ? countSpins({ createdAt: { gte: startOfToday } })
      : Promise.resolve(0),
    settings.limits.globalMonthly != null
      ? countSpins({ createdAt: { gte: startOfMonth } })
      : Promise.resolve(0),
  ]);

  const globalDailyLimit = settings.limits.globalDaily ?? null;
  const globalMonthlyLimit = settings.limits.globalMonthly ?? null;

  if (globalDailyLimit != null && dailyCount >= globalDailyLimit) {
    return { blocked: true, reason: "limit_daily" as const };
  }
  if (globalMonthlyLimit != null && monthlyCount >= globalMonthlyLimit) {
    return { blocked: true, reason: "limit_monthly" as const };
  }
  return { blocked: false as const };
};

const getPrizeCounters = async (prizeId: string) => {
  const startOfToday = dayjs().startOf("day").toDate();
  const startOfMonth = dayjs().startOf("month").toDate();
  const [total, daily, monthly] = await Promise.all([
    countSpins({ prizeId }),
    countSpins({ prizeId, createdAt: { gte: startOfToday } }),
    countSpins({ prizeId, createdAt: { gte: startOfMonth } }),
  ]);
  return { total, daily, monthly };
};

const isPrizeWithinLimits = async (prize: LuckyWheelPrize, settings: LuckyWheelSettings): Promise<boolean> => {
  if (prize.enabled === false || prize.probability <= 0) {
    return false;
  }
  const perPrizeLimits = settings.limits.perPrize?.[prize.id] ?? null;
  const effectiveDailyLimit = resolveLimitValue([prize.limit?.daily, perPrizeLimits?.daily]);
  const effectiveMonthlyLimit = resolveLimitValue([prize.limit?.monthly, perPrizeLimits?.monthly]);
  const effectiveTotalLimit = resolveLimitValue([prize.limit?.total, perPrizeLimits?.total]);

  if (effectiveDailyLimit == null && effectiveMonthlyLimit == null && effectiveTotalLimit == null) {
    return true;
  }

  const counters = await getPrizeCounters(prize.id);

  if (effectiveTotalLimit != null && counters.total >= effectiveTotalLimit) {
    return false;
  }
  if (effectiveDailyLimit != null && counters.daily >= effectiveDailyLimit) {
    return false;
  }
  if (effectiveMonthlyLimit != null && counters.monthly >= effectiveMonthlyLimit) {
    return false;
  }
  return true;
};

const computeEligiblePrizes = async (settings: LuckyWheelSettings): Promise<LuckyWheelPrize[]> => {
  const eligible: LuckyWheelPrize[] = [];
  for (const prize of settings.prizes) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPrizeWithinLimits(prize, settings)) {
      eligible.push(prize);
    }
  }
  return eligible;
};

const hasUserPlayedRecently = async (
  context: LuckyWheelSpinPayload,
  settings: LuckyWheelSettings,
  maxSpins: number
) => {
  if (!Number.isFinite(maxSpins) || maxSpins <= 0) {
    return false;
  }
  const threshold = getTimeThreshold(settings.displayRules.showAgainAfterHours);
  const where: Prisma.LuckyWheelSpinWhereInput = {};
  if (settings.displayRules.frequency === "once_per_customer" && context.customerId) {
    where.customerId = context.customerId;
  } else if (context.sessionId) {
    where.sessionId = context.sessionId;
  } else if (context.cartId) {
    where.cartId = context.cartId;
  } else if (context.ipAddress) {
    where.ipAddress = context.ipAddress;
  } else {
    return false;
  }
  if (threshold) {
    where.createdAt = { gte: threshold };
  }
  const count = await countSpins(where);
  return count >= maxSpins;
};

type DefaultHeroBanner = {
  id: string;
  kind: BannerKind;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  imageUrl: string;
  mobileImageUrl: string;
  position: number;
  active: boolean;
};

const DEFAULT_HERO_BANNERS: DefaultHeroBanner[] = Array.from({ length: 10 }, (_, index) => ({
  id: `banner-hero-${index}`,
  kind: "HERO",
  title: null,
  subtitle: null,
  ctaLabel: null,
  ctaHref: null,
  imageUrl: `/banner/bd${index + 1}.jpeg`,
  mobileImageUrl: `/banner/bc${index + 1}.jpeg`,
  position: index,
  active: true,
}));

const generateCartSessionToken = () => `cart_${generateUniqueId()}`;

const SELECT_PRODUCT_SUMMARY = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  active: true,
  stockQuantity: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true,
};

const IMAGE_SELECT = { id: true, url: true, alt: true, position: true } as const;
const VARIANT_SELECT = { id: true, name: true, sku: true, price: true, stock: true, attributes: true } as const;
const RECO_PRODUCT_SELECT = {
  ...SELECT_PRODUCT_SUMMARY,
  images: {
    orderBy: { position: "asc" as const },
    take: 1,
    select: IMAGE_SELECT,
  },
} as const;

type RecommendationProduct = Prisma.ProductGetPayload<{ select: typeof RECO_PRODUCT_SELECT }>;

type OrderStatus = Prisma.OrderUncheckedCreateInput["status"];
type StorefrontEventType = Prisma.StorefrontEventCreateInput["eventType"];

const SELECT_PRODUCT_DETAIL = {
  ...SELECT_PRODUCT_SUMMARY,
  description: true,
  descriptionHtml: true,
  images: {
    orderBy: { position: "asc" as const },
    select: IMAGE_SELECT,
  },
  variants: {
    orderBy: { name: "asc" as const },
    select: VARIANT_SELECT,
  },
  productLinks: {
    orderBy: { position: "asc" as const },
    select: {
      position: true,
      categoryId: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
  collectionLinks: {
    orderBy: { position: "asc" as const },
    select: {
      position: true,
      collectionId: true,
      collection: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

const CART_PRODUCT_SELECT = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  sku: true,
  price: true,
  compareAtPrice: true,
  images: { orderBy: { position: "asc" as const }, select: IMAGE_SELECT },
} as const;

const CART_INCLUDE = {
  items: {
    include: {
      product: { select: CART_PRODUCT_SELECT },
      variant: { select: VARIANT_SELECT },
    },
    orderBy: { createdAt: "asc" as const },
  },
  coupon: true,
  shippingMethod: true,
} as const;

type CartWithRelations = Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>;

type CartItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

type CartAddressInput = {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
};

type UpsertCartInput = {
  cartId?: string | null;
  sessionToken?: string | null;
  items?: CartItemInput[];
  couponCode?: string | null;
  shippingMethodId?: string | null;
  shippingAddress?: CartAddressInput | null;
  billingAddress?: CartAddressInput | null;
};

type CheckoutCustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  document: string;
  birthDate?: string;
  gender?: string | null;
};

type CheckoutPayload = {
  cartId: string;
  sessionToken?: string | null;
  customer: CheckoutCustomerInput;
  shippingAddress: CartAddressInput;
  billingAddress?: CartAddressInput | null;
  shippingMethodId: string;
  paymentMethod: "pix" | "cartao";
  paymentDetails?: {
    installments?: number;
    creditCard?: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      cvv: string;
    };
  } | null;
  couponCode?: string | null;
  notes?: string | null;
  perks?: {
    freeShipping?: boolean;
    freeOrder?: boolean;
  };
};

const normalizeCep = (value?: string | null) => (value ? value.replace(/\D/g, "").slice(0, 8) : "");

const sanitizeCartAddress = (input?: CartAddressInput | null) => {
  if (!input) return null;
  return {
    name: input.name?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    document: input.document?.replace(/\D/g, "") || null,
    postalCode: normalizeCep(input.postalCode),
    street: input.street?.trim() || "",
    number: input.number?.trim() || "",
    complement: input.complement?.trim() || null,
    district: input.district?.trim() || "",
    city: input.city?.trim() || "",
    state: input.state?.trim()?.toUpperCase() || "",
  };
};

const sanitizePhone = (value?: string | null) => (value ? value.replace(/\D/g, "") : "");

const mergeMetadata = (base: any, patch: any) => {
  const baseObject = base && typeof base === "object" ? base : {};
  const patchObject = patch && typeof patch === "object" ? patch : {};
  return { ...baseObject, ...patchObject };
};

type ZipRangeConfig =
  | { mode?: "all" }
  | { prefixes: string[] }
  | { ranges: Array<{ from: string; to: string }> }
  | { list: string[] };

function matchesZipRange(config: ZipRangeConfig | null | undefined, postalCode: string) {
  if (!config) return true;
  const sanitized = normalizeCep(postalCode);
  if (!sanitized) return true;

  if (Array.isArray((config as any)?.prefixes)) {
    const prefixes = (config as any).prefixes as string[];
    return prefixes.some((prefix) => sanitized.startsWith(prefix.replace(/\D/g, "")));
  }

  if (Array.isArray((config as any)?.ranges)) {
    const ranges = (config as any).ranges as Array<{ from: string; to: string }>;
    const value = Number(sanitized);
    return ranges.some((range) => {
      const start = Number(normalizeCep(range.from));
      const end = Number(normalizeCep(range.to));
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return value >= start && value <= end;
    });
  }

  if (Array.isArray((config as any)?.list)) {
    const list = (config as any).list as string[];
    return list.map((item) => normalizeCep(item)).includes(sanitized);
  }

  return true;
}

export const calculateShippingForMethod = (
  method: { flatPriceCents: number; freeOverCents: number | null },
  subtotalCents: number
) => {
  if (!method) return 0;
  if (method.freeOverCents && subtotalCents >= method.freeOverCents) {
    return 0;
  }
  return Math.max(method.flatPriceCents || 0, 0);
};

const toIdSet = (values?: string[] | null) =>
  new Set((values ?? []).map((value) => value?.trim()).filter((value): value is string => Boolean(value && value.length > 0)));

const buildCouponTargets = (coupon: Coupon): CouponTargetsSet => ({
  products: toIdSet(coupon.targetProductIds),
  collections: toIdSet(coupon.targetCollectionIds),
  categories: toIdSet(coupon.targetCategoryIds),
  excludedProducts: toIdSet(coupon.excludedProductIds),
});

async function buildCartProductContext(tx: Prisma.TransactionClient, cart: CartWithRelations) {
  const ids = Array.from(new Set(cart.items.map((item) => item.productId)));
  if (ids.length === 0) {
    return new Map<string, CartProductContext>();
  }
  const products = await tx.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      categoryId: true,
      productLinks: { select: { categoryId: true } },
      collectionLinks: { select: { collectionId: true } },
    },
  });
  const map = new Map<string, CartProductContext>();
  for (const product of products) {
    const categorySet = new Set<string>();
    if (product.categoryId) {
      categorySet.add(product.categoryId);
    }
    product.productLinks?.forEach((link) => {
      if (link.categoryId) {
        categorySet.add(link.categoryId);
      }
    });
    const collectionSet = new Set<string>();
    product.collectionLinks?.forEach((link) => {
      if (link.collectionId) {
        collectionSet.add(link.collectionId);
      }
    });
    map.set(product.id, {
      categories: Array.from(categorySet),
      collections: Array.from(collectionSet),
    });
  }
  return map;
}

const cartMatchesTargets = (
  cart: CartWithRelations,
  targets: CouponTargetsSet,
  productContext: Map<string, CartProductContext>
) => {
  const hasSpecificTargets =
    targets.products.size > 0 || targets.collections.size > 0 || targets.categories.size > 0;

  for (const item of cart.items) {
    if (targets.excludedProducts.has(item.productId)) {
      return false;
    }
  }

  if (!hasSpecificTargets) {
    return true;
  }

  return cart.items.some((item) => {
    if (targets.products.has(item.productId)) {
      return true;
    }
    const context = productContext.get(item.productId);
    if (!context) {
      return false;
    }
    const matchesCollection =
      targets.collections.size === 0
        ? false
        : context.collections.some((id) => targets.collections.has(id));
    if (matchesCollection) {
      return true;
    }
    const matchesCategory =
      targets.categories.size === 0
        ? false
        : context.categories.some((id) => targets.categories.has(id));
    return matchesCategory;
  });
};

export const computeCouponDiscount = (
  type: "PERCENT" | "AMOUNT",
  value: number,
  subtotalCents: number,
  options?: { maxDiscountCents?: number | null }
) => {
  if (subtotalCents <= 0 || value <= 0) {
    return 0;
  }
  let rawDiscount = 0;
  if (type === "PERCENT") {
    const discount = Math.floor((subtotalCents * value) / 100);
    rawDiscount = Math.max(discount, 0);
  } else {
    rawDiscount = Math.max(value, 0);
  }
  const capped =
    options?.maxDiscountCents && options.maxDiscountCents > 0
      ? Math.min(rawDiscount, options.maxDiscountCents)
      : rawDiscount;
  return Math.min(subtotalCents, capped);
};

function mapCart(cart: CartWithRelations) {
  const couponSummary = cart.coupon
    ? {
        id: cart.coupon.id,
        code: cart.coupon.code,
        type: cart.coupon.type,
        value: cart.coupon.value,
        name: cart.coupon.name,
        description: cart.coupon.description,
        freeShipping: cart.coupon.freeShipping,
        minSubtotalCents: cart.coupon.minSubtotalCents,
        maxDiscountCents: cart.coupon.maxDiscountCents,
        usageLimit: cart.coupon.usageLimit,
        usageCount: cart.coupon.usageCount,
        perCustomerLimit: cart.coupon.perCustomerLimit,
        startsAt: cart.coupon.startsAt,
        endsAt: cart.coupon.endsAt,
      }
    : null;

  return {
    id: cart.id,
    sessionToken: cart.sessionToken,
    currency: cart.currency,
    subtotalCents: cart.subtotalCents,
    discountCents: cart.discountCents,
    shippingCents: cart.shippingCents,
    totalCents: cart.totalCents,
    couponDiscountCents: cart.discountCents,
    freeShippingApplied: Boolean(cart.coupon?.freeShipping),
    coupon: couponSummary,
    shippingMethod: cart.shippingMethod
      ? {
          id: cart.shippingMethod.id,
          name: cart.shippingMethod.name,
          carrier: cart.shippingMethod.carrier,
          flatPriceCents: cart.shippingMethod.flatPriceCents,
          freeOverCents: cart.shippingMethod.freeOverCents,
          deliveryEtaText: cart.shippingMethod.deliveryEtaText,
        }
      : null,
    shippingAddress: cart.shippingAddress ?? null,
    billingAddress: cart.billingAddress ?? null,
    items: cart.items.map((item) => {
      const productImages = (item.product.images ?? []).filter((img) => img?.url);
      const primaryProductImage =
        productImages.find((img) => img.url && !img.url.includes('placeholder-product')) ||
        productImages[0] ||
        null;
      const snapshotImage =
        (item as any)?.productSnapshot && typeof (item as any).productSnapshot === 'object'
          ? ((item as any).productSnapshot as any).imageUrl ?? null
          : null;
      const resolvedImageUrl = primaryProductImage?.url ?? snapshotImage ?? null;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalPriceCents: item.totalPriceCents,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          brand: item.product.brand,
          sku: item.product.sku,
          price: item.product.price,
          compareAtPrice: item.product.compareAtPrice,
          imageUrl: resolvedImageUrl,
          images: productImages,
        },
        variant: item.variant
          ? {
              id: item.variant.id,
              name: item.variant.name,
              sku: item.variant.sku,
              price: item.variant.price,
              stock: item.variant.stock,
            }
          : null,
      };
    }),
  };
}

type CartIdentifiers = { cartId?: string | null; sessionToken?: string | null };

async function loadCart(tx: Prisma.TransactionClient, identifiers: CartIdentifiers) {
  const { cartId, sessionToken } = identifiers;
  if (cartId) {
    return tx.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE });
  }
  if (sessionToken) {
    return tx.cart.findUnique({ where: { sessionToken }, include: CART_INCLUDE });
  }
  return null;
}

async function loadCartOrThrow(tx: Prisma.TransactionClient, identifiers: CartIdentifiers, errorMessage = "Carrinho não encontrado.") {
  const cart = await loadCart(tx, identifiers);
  if (!cart) {
    throw new Error(errorMessage);
  }
  return cart;
}

async function resolveProductAndVariant(tx: Prisma.TransactionClient, input: CartItemInput) {
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    include: {
      images: { orderBy: { position: "asc" as const }, take: 1, select: IMAGE_SELECT },
      variants: { select: VARIANT_SELECT },
    },
  });
  if (!product || !product.active) {
    throw new Error("Produto não encontrado ou inativo.");
  }

  let variant: ProductVariant | null = null;
  if (input.variantId) {
    variant = await tx.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant || variant.productId !== product.id) {
      throw new Error("Variação inválida para o produto selecionado.");
    }
    if (variant.stock <= 0) {
      throw new Error("Variação sem estoque disponível.");
    }
  }

  if (!variant && product.stockQuantity <= 0) {
    throw new Error("Produto sem estoque disponível.");
  }

  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const unitPriceCents = variant?.price ?? product.price;
  const totalPriceCents = unitPriceCents * quantity;

  return {
    product,
    variant,
    quantity,
    unitPriceCents,
    totalPriceCents,
    productSnapshot: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      sku: product.sku,
      imageUrl: product.images?.[0]?.url ?? null,
    },
  };
}

async function resolveCoupon(
  tx: Prisma.TransactionClient,
  couponCode: string,
  context: CouponEvaluationContext
): Promise<ResolvedCouponPayload> {
  if (!couponCode) {
    throw new Error("Informe um cupom válido.");
  }
  const sanitized = couponCode.trim().toUpperCase();
  if (!sanitized) {
    throw new Error("Cupom inválido.");
  }

  const now = new Date();
  const coupon = await tx.coupon.findFirst({
    where: {
      code: sanitized,
      active: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
  });

  if (!coupon) {
    throw new Error("Cupom inválido ou expirado.");
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw new Error("Este presente Dermosul já atingiu o limite de utilizações.");
  }

  const productContext = context.productContext ?? (await buildCartProductContext(tx, context.cart));
  const targets = buildCouponTargets(coupon);

  if (!cartMatchesTargets(context.cart, targets, productContext)) {
    throw new Error("Este cupom não se aplica aos itens do carrinho.");
  }

  if (coupon.minSubtotalCents && context.subtotalCents < coupon.minSubtotalCents) {
    const minimum = (coupon.minSubtotalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    throw new Error(`Valor mínimo para usar este cupom: ${minimum}.`);
  }

  if (coupon.perCustomerLimit) {
    if (!context.customerId) {
      if (context.strict) {
        throw new Error("Identifique-se para usar este cupom.");
      }
    } else {
      const perCustomerUsage = await tx.couponRedemption.count({
        where: { couponId: coupon.id, customerId: context.customerId },
      });
      if (perCustomerUsage >= coupon.perCustomerLimit) {
        throw new Error("Você já utilizou este presente Dermosul.");
      }
    }
  }

  if (coupon.newCustomerOnly) {
    if (!context.customerId) {
      if (context.strict) {
        throw new Error("Disponível apenas para a primeira compra.");
      }
    } else {
      const existingOrders = await tx.order.count({
        where: { customerId: context.customerId, status: { not: "cancelado" } },
      });
      if (existingOrders > 0) {
        throw new Error("Disponível apenas para a primeira compra.");
      }
    }
  }

  const discountCents = computeCouponDiscount(coupon.type, coupon.value, context.subtotalCents, {
    maxDiscountCents: coupon.maxDiscountCents ?? undefined,
  });

  if (discountCents <= 0 && !coupon.freeShipping) {
    throw new Error("Não foi possível aplicar este cupom.");
  }

  return { coupon, discountCents, productContext };
}

export async function getCart(params: CartIdentifiers) {
  const { cartId, sessionToken } = params;
  if (!cartId && !sessionToken) {
    return null;
  }
  const cart = cartId
    ? await prisma.cart.findUnique({ where: { id: cartId }, include: CART_INCLUDE })
    : sessionToken
    ? await prisma.cart.findUnique({ where: { sessionToken }, include: CART_INCLUDE })
    : null;
  if (!cart) return null;
  return mapCart(cart);
}

export async function upsertCart(input: UpsertCartInput) {
  return prisma.$transaction(async (tx) => {
    const identifiers: CartIdentifiers = {
      cartId: input.cartId?.trim() || undefined,
      sessionToken: input.sessionToken?.trim() || undefined,
    };

    let cart = await loadCart(tx, identifiers);
    if (!cart) {
      const sessionToken = identifiers.sessionToken ?? generateCartSessionToken();
      cart = await tx.cart.create({
        data: {
          sessionToken,
          currency: "BRL",
          subtotalCents: 0,
          discountCents: 0,
          shippingCents: 0,
          totalCents: 0,
        },
        include: CART_INCLUDE,
      });
    }

    const sessionToken = cart.sessionToken ?? identifiers.sessionToken ?? generateCartSessionToken();
    if (!cart.sessionToken || cart.sessionToken !== sessionToken) {
      cart = await tx.cart.update({
        where: { id: cart.id },
        data: { sessionToken },
        include: CART_INCLUDE,
      });
    }

    let subtotalCents = cart.items.reduce((sum, item) => sum + item.totalPriceCents, 0);

    if (Array.isArray(input.items)) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      let tempSubtotal = 0;
      const records: Array<Prisma.CartItemCreateManyInput> = [];

      for (const raw of input.items) {
        const resolved = await resolveProductAndVariant(tx, raw);
        tempSubtotal += resolved.totalPriceCents;
        records.push({
          cartId: cart.id,
          productId: resolved.product.id,
          variantId: resolved.variant?.id ?? null,
          quantity: resolved.quantity,
          unitPriceCents: resolved.unitPriceCents,
          totalPriceCents: resolved.totalPriceCents,
          productSnapshot: resolved.productSnapshot as Prisma.InputJsonValue,
        });
      }

      if (records.length > 0) {
        await tx.cartItem.createMany({ data: records });
      }
      subtotalCents = tempSubtotal;
      cart = await loadCartOrThrow(tx, { cartId: cart.id }, "Falha ao carregar o carrinho atualizado.");
    }

    let productContext = await buildCartProductContext(tx, cart);
    subtotalCents = cart.items.reduce((sum, item) => sum + item.totalPriceCents, 0);

    const previousCouponCode = cart.coupon?.code ?? null;
    let discountCents = cart.discountCents;
    let couponFreeShipping = Boolean(cart.coupon?.freeShipping);
    let couponUpdate: Prisma.CartUpdateInput["coupon"] | undefined;

    if (input.couponCode !== undefined) {
      if (input.couponCode) {
        const resolved = await resolveCoupon(tx, input.couponCode, {
          cart,
          subtotalCents,
          customerId: cart.customerId,
          productContext,
        });
        couponUpdate = { connect: { id: resolved.coupon.id } };
        discountCents = resolved.discountCents;
        couponFreeShipping = resolved.coupon.freeShipping;
        productContext = resolved.productContext ?? productContext;
      } else {
        couponUpdate = { disconnect: true };
        discountCents = 0;
        couponFreeShipping = false;
      }
    } else if (previousCouponCode) {
      try {
        const resolved = await resolveCoupon(tx, previousCouponCode, {
          cart,
          subtotalCents,
          customerId: cart.customerId,
          productContext,
        });
        discountCents = resolved.discountCents;
        couponFreeShipping = resolved.coupon.freeShipping;
        productContext = resolved.productContext ?? productContext;
      } catch {
        couponUpdate = { disconnect: true };
        discountCents = 0;
        couponFreeShipping = false;
      }
    }

    let shippingMethodRecord = cart.shippingMethod ?? null;
    if (input.shippingMethodId !== undefined) {
      if (input.shippingMethodId) {
        const method = await tx.shippingMethod.findUnique({ where: { id: input.shippingMethodId } });
        if (!method || !method.active) {
          throw new Error("Método de frete inválido.");
        }
        shippingMethodRecord = method;
      } else {
        shippingMethodRecord = null;
      }
    }

    const shippingAddressToUse =
      input.shippingAddress !== undefined
        ? sanitizeCartAddress(input.shippingAddress)
        : cart.shippingAddress
        ? sanitizeCartAddress(cart.shippingAddress as CartAddressInput)
        : null;

    if (shippingMethodRecord && shippingAddressToUse) {
      const allowed = matchesZipRange(
        (shippingMethodRecord.zipRange as ZipRangeConfig) ?? null,
        shippingAddressToUse.postalCode || ""
      );
      if (!allowed) {
        throw new Error("Método de frete indisponível para o CEP informado.");
      }
    }

    let shippingCents = shippingMethodRecord
      ? calculateShippingForMethod(
          {
            flatPriceCents: shippingMethodRecord.flatPriceCents,
            freeOverCents: shippingMethodRecord.freeOverCents,
          },
          Math.max(subtotalCents - discountCents, 0)
        )
      : 0;

    if (couponFreeShipping) {
      shippingCents = 0;
    }

    const totalCents = Math.max(subtotalCents - discountCents + shippingCents, 0);

    const updateData: Prisma.CartUpdateInput = {
      subtotalCents,
      discountCents,
      shippingCents,
      totalCents,
      sessionToken,
    };

    if (couponUpdate) {
      updateData.coupon = couponUpdate;
    }

    if (input.shippingAddress !== undefined) {
      updateData.shippingAddress = shippingAddressToUse ? shippingAddressToUse : Prisma.JsonNull;
    }

    if (input.billingAddress !== undefined) {
      const billingAddressToUse = input.billingAddress ? sanitizeCartAddress(input.billingAddress) : null;
      updateData.billingAddress = billingAddressToUse ? billingAddressToUse : Prisma.JsonNull;
    }

    if (input.shippingMethodId !== undefined) {
      updateData.shippingMethod = shippingMethodRecord
        ? { connect: { id: shippingMethodRecord.id } }
        : { disconnect: true };
    }

    const updated = await tx.cart.update({
      where: { id: cart.id },
      data: updateData,
      include: CART_INCLUDE,
    });

    return mapCart(updated);
  });
}

const mapPaymentMethodEnum = (method: "pix" | "cartao") => {
  switch (method) {
    case "pix":
      return "pix";
    case "cartao":
      return "cartao";
    default:
      return "desconhecido";
  }
};

const mapGatewayStatusToPaymentStatus = (status?: string | null) => {
  const normalized = (status || "").toUpperCase();
  if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "TEST_APPROVED"].includes(normalized)) return "confirmado";
  if (normalized === "AWAITING_RISK_ANALYSIS") return "analise";
  if (normalized === "PENDING") return "pendente";
  return normalized ? normalized.toLowerCase() : "pendente";
};

const isGatewayStatusPaid = (status?: string | null) => {
  const normalized = (status || "").toUpperCase();
  return ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "TEST_APPROVED"].includes(normalized);
};

export async function checkoutCart(payload: CheckoutPayload) {
  const paymentProvider = getPaymentProvider();

  const transactionResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const cart = await loadCart(tx, {
      cartId: payload.cartId,
      sessionToken: payload.sessionToken ?? null,
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Carrinho vazio. Adicione itens antes de finalizar a compra.");
    }

    const shippingAddress = sanitizeCartAddress(payload.shippingAddress);
    if (!shippingAddress) {
      throw new Error("Endereço de entrega inválido.");
    }

    const billingAddress = payload.billingAddress ? sanitizeCartAddress(payload.billingAddress) : null;

    const shippingMethod = await tx.shippingMethod.findUnique({ where: { id: payload.shippingMethodId } });
    if (!shippingMethod || !shippingMethod.active) {
      throw new Error("Método de frete inválido ou indisponível.");
    }

    if (!matchesZipRange((shippingMethod.zipRange as ZipRangeConfig) ?? null, shippingAddress.postalCode || "")) {
      throw new Error("Método de frete indisponível para o CEP informado.");
    }

    const subtotalCents = cart.items.reduce((sum, item) => sum + item.totalPriceCents, 0);

    let coupon = cart.coupon ?? null;
    let discountCents = cart.discountCents;
    let couponFreeShipping = Boolean(cart.coupon?.freeShipping);
    let productContext = await buildCartProductContext(tx, cart);

    const perkFlags = {
      freeShipping: Boolean(payload.perks?.freeShipping),
      freeOrder: Boolean(payload.perks?.freeOrder),
    };

    const document = payload.customer.document.replace(/\D/g, "");
    if (!validateCpf(document)) {
      throw new Error("CPF inválido.");
    }

    const normalizedEmail = payload.customer.email.trim().toLowerCase();
    const normalizedPhone = sanitizePhone(payload.customer.phone);

    let existingCustomer = await tx.customer.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { cpf: document }],
      },
    });

    const customerData = {
      firstName: payload.customer.firstName.trim(),
      lastName: payload.customer.lastName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      cpf: document,
      birthDate: payload.customer.birthDate ?? "1990-01-01",
      gender: payload.customer.gender ?? null,
    };

    if (existingCustomer) {
      existingCustomer = await tx.customer.update({ where: { id: existingCustomer.id }, data: customerData });
    } else {
      existingCustomer = await tx.customer.create({ data: customerData });
    }

    const couponContext: CouponEvaluationContext = {
      cart,
      subtotalCents,
      customerId: existingCustomer.id,
      productContext,
      strict: true,
    };

    if (payload.couponCode) {
      const resolved = await resolveCoupon(tx, payload.couponCode, couponContext);
      coupon = resolved.coupon;
      discountCents = resolved.discountCents;
      couponFreeShipping = resolved.coupon.freeShipping;
      productContext = resolved.productContext ?? productContext;
    } else if (coupon) {
      try {
        const resolved = await resolveCoupon(tx, coupon.code, couponContext);
        discountCents = resolved.discountCents;
        couponFreeShipping = resolved.coupon.freeShipping;
        productContext = resolved.productContext ?? productContext;
      } catch {
        coupon = null;
        discountCents = 0;
        couponFreeShipping = false;
      }
    }

    let shippingCents = calculateShippingForMethod(
      { flatPriceCents: shippingMethod.flatPriceCents, freeOverCents: shippingMethod.freeOverCents },
      Math.max(subtotalCents - discountCents, 0)
    );
    if (perkFlags.freeShipping || couponFreeShipping) {
      shippingCents = 0;
    }
    if (perkFlags.freeOrder) {
      discountCents = subtotalCents;
    }

    const totalCents = Math.max(subtotalCents - discountCents + shippingCents, 0);

    const orderId = await generateUniqueNumericOrderId(tx);
    const orderNumber = generateShortId(9);
    const externalReference = `store-${orderNumber}`;
    const paymentRecordId = generateUniqueId();
    const initialOrderStatus = "aguardando_pagamento";

    const baseMetadata = {
      cartId: cart.id,
      coupon: coupon
        ? { code: coupon.code, type: coupon.type, value: coupon.value, freeShipping: coupon.freeShipping }
        : null,
      notes: payload.notes || null,
      luckyWheelPerks: perkFlags,
    };

    await tx.order.create({
      data: {
        id: orderId,
        number: orderNumber,
        externalReference,
        customer: { connect: { id: existingCustomer.id } },
        status: initialOrderStatus,
        category: "Store Dermosul",
        currency: "BRL",
        subtotalAmount: subtotalCents,
        discountAmount: discountCents,
        shippingAmount: shippingCents,
        totalAmount: totalCents,
        metadata: baseMetadata as Prisma.InputJsonValue,
        items: {
          create: cart.items.map((item) => ({
            qty: item.quantity,
            unitPrice: item.unitPriceCents,
            totalPrice: item.totalPriceCents,
            product: { connect: { id: item.productId } },
            ...(item.variantId ? { variant: { connect: { id: item.variantId } } } : {}),
          })),
        },
        payments: {
          create: {
            id: paymentRecordId,
            paymentMethod: mapPaymentMethodEnum(payload.paymentMethod),
            paidAmount: 0,
            status: "pendente",
          },
        },
      },
    });

    await tx.address.create({
      data: {
        customer: { connect: { id: existingCustomer.id } },
        order: { connect: { id: orderId } },
        kind: "SHIPPING",
        name: shippingAddress.name ?? `${customerData.firstName} ${customerData.lastName}`.trim(),
        cpfCnpj: document,
        phone: normalizedPhone,
        cep: shippingAddress.postalCode,
        zip: shippingAddress.postalCode,
        street: shippingAddress.street,
        number: shippingAddress.number,
        complement: shippingAddress.complement,
        district: shippingAddress.district,
        city: shippingAddress.city,
        state: shippingAddress.state,
      },
    });

    if (billingAddress) {
      await tx.address.create({
        data: {
          customer: { connect: { id: existingCustomer.id } },
          order: { connect: { id: orderId } },
          kind: "BILLING",
          name: billingAddress.name ?? `${customerData.firstName} ${customerData.lastName}`.trim(),
          cpfCnpj: document,
          phone: normalizedPhone,
          cep: billingAddress.postalCode,
          zip: billingAddress.postalCode,
          street: billingAddress.street,
          number: billingAddress.number,
          complement: billingAddress.complement,
          district: billingAddress.district,
          city: billingAddress.city,
          state: billingAddress.state,
        },
      });
    }

    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    if (coupon) {
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } },
      });
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orderId,
          customerId: existingCustomer.id,
          amountCents: discountCents,
          freeShipping: coupon.freeShipping || perkFlags.freeShipping,
          metadata: {
            source: "checkout",
          },
        },
      });
    }

    const appliedCoupon = coupon
      ? {
        id: coupon.id,
        code: coupon.code,
        freeShipping: coupon.freeShipping,
        discountCents,
      }
      : null;

    return {
      orderId,
      orderNumber,
      orderStatus: initialOrderStatus,
      totals: {
        subtotalCents,
        discountCents,
        shippingCents,
        totalCents,
      },
      customer: {
        name: `${customerData.firstName} ${customerData.lastName}`.trim() || customerData.firstName || "Cliente Dermosul",
        email: customerData.email,
        cpf: customerData.cpf,
        phone: customerData.phone,
      },
      externalReference,
      paymentRecordId,
      paymentMethod: payload.paymentMethod,
      baseMetadata,
      cartId: cart.id,
      appliedCoupon,
      cartItems: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };
  });

  const amount = Number((transactionResult.totals.totalCents / 100).toFixed(2));
  const paymentRequest: PaymentRequest = {
    amount,
    customer: transactionResult.customer,
    externalReference: transactionResult.externalReference,
  };

  const restoreInventory = async () => {
    for (const item of transactionResult.cartItems) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
  };

  if (payload.paymentMethod === "cartao") {
    const creditCard = payload.paymentDetails?.creditCard;
    if (!creditCard) {
      throw new Error("Dados do cartão de crédito não fornecidos.");
    }
    paymentRequest.creditCard = {
      holderName: creditCard.holderName,
      number: creditCard.number.replace(/\D/g, ""),
      expiryMonth: creditCard.expiryMonth,
      expiryYear: creditCard.expiryYear,
      cvv: creditCard.cvv.replace(/\D/g, ""),
    };
    if (payload.paymentDetails?.installments && payload.paymentDetails.installments > 1) {
      paymentRequest.installments = payload.paymentDetails.installments;
    }
  }

  let gatewayPaymentId: string | null = null;
  let gatewayStatus: string | null = null;
  let orderStatus = transactionResult.orderStatus;
  let paymentStatusLabel = "pendente";
  let paidAmount = 0;
  let pixPayload: { qrCode: string; copyPaste: string } | null = null;

  const isTestCard =
    transactionResult.paymentMethod === "cartao" &&
    paymentRequest.creditCard &&
    paymentRequest.creditCard.number === TEST_CARD_NUMBER &&
    (!TEST_CARD_CVV || paymentRequest.creditCard.cvv === TEST_CARD_CVV);

  const isTestCustomer =
    transactionResult.customer?.cpf && TEST_CARD_CPF && transactionResult.customer.cpf.replace(/\D/g, "") === TEST_CARD_CPF;

  if (transactionResult.paymentMethod === "pix") {
    const pixResponse = await paymentProvider.createPixPayment(paymentRequest);
    if (!pixResponse.success || !pixResponse.qrCode || !pixResponse.copyPaste) {
      await prisma.order.update({ where: { id: transactionResult.orderId }, data: { status: "cancelado" } });
      await prisma.payment.update({ where: { id: transactionResult.paymentRecordId }, data: { status: "cancelado" } });
      await restoreInventory();
      throw new Error(pixResponse.message || "Falha ao gerar pagamento Pix. Tente novamente.");
    }
    gatewayPaymentId = pixResponse.gatewayPaymentId || null;
    gatewayStatus = pixResponse.status || "PENDING";
    paymentStatusLabel = mapGatewayStatusToPaymentStatus(gatewayStatus);
    const qrImage = pixResponse.qrCode.startsWith("data:image")
      ? pixResponse.qrCode
      : `data:image/png;base64,${pixResponse.qrCode}`;
    pixPayload = {
      qrCode: qrImage,
      copyPaste: pixResponse.copyPaste || "",
    };

    await prisma.order.update({
      where: { id: transactionResult.orderId },
      data: {
        metadata: mergeMetadata(transactionResult.baseMetadata, {
          paymentGateway: {
            provider: "asaas",
            method: "pix",
            externalReference: transactionResult.externalReference,
            gatewayPaymentId,
            gatewayStatus,
          },
        }) as Prisma.InputJsonValue,
      },
    });

    await prisma.payment.update({
      where: { id: transactionResult.paymentRecordId },
      data: {
        status: paymentStatusLabel,
      },
    });

    await prisma.cartItem.deleteMany({ where: { cartId: transactionResult.cartId } });
    await prisma.cart.update({
      where: { id: transactionResult.cartId },
      data: {
        shippingMethod: { disconnect: true },
        shippingAddress: Prisma.JsonNull,
        billingAddress: Prisma.JsonNull,
        subtotalCents: 0,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 0,
        coupon: { disconnect: true },
      },
    });

    return {
      orderId: transactionResult.orderId,
      orderNumber: transactionResult.orderNumber,
      status: orderStatus,
      totals: transactionResult.totals,
      payment: {
        method: transactionResult.paymentMethod,
        status: paymentStatusLabel,
        externalReference: transactionResult.externalReference,
        gatewayPaymentId,
        gatewayStatus,
        pix: pixPayload,
      },
    };
  }

  if (transactionResult.paymentMethod === "cartao" && (isTestCard || isTestCustomer)) {
    gatewayPaymentId = `test-${transactionResult.externalReference}-${Date.now()}`;
    gatewayStatus = "TEST_APPROVED";
    paymentStatusLabel = mapGatewayStatusToPaymentStatus(gatewayStatus);
    orderStatus = "pago";
    paidAmount = transactionResult.totals.totalCents;
  } else if (transactionResult.paymentMethod === "cartao") {
    const cardResponse = await paymentProvider.processPayment(paymentRequest);
    if (!cardResponse.success) {
      await prisma.order.update({ where: { id: transactionResult.orderId }, data: { status: "cancelado" } });
      await prisma.payment.update({ where: { id: transactionResult.paymentRecordId }, data: { status: "cancelado" } });
      await restoreInventory();
      throw new Error(cardResponse.message || "Falha ao processar pagamento com cartão.");
    }

    gatewayPaymentId = cardResponse.gatewayPaymentId || null;
    gatewayStatus = cardResponse.status || "PENDING";
    paymentStatusLabel = mapGatewayStatusToPaymentStatus(gatewayStatus);
    if (isGatewayStatusPaid(gatewayStatus)) {
      orderStatus = "pago";
      paidAmount = transactionResult.totals.totalCents;
    }
  }

  await prisma.order.update({
    where: { id: transactionResult.orderId },
    data: {
      status: orderStatus as OrderStatus,
      metadata: mergeMetadata(transactionResult.baseMetadata, {
        paymentGateway: {
          provider: "asaas",
          method: "cartao",
          externalReference: transactionResult.externalReference,
          gatewayPaymentId,
          gatewayStatus,
        },
      }) as Prisma.InputJsonValue,
    },
  });

  const paymentUpdate: Prisma.PaymentUpdateInput = {
    status: paymentStatusLabel,
  };
  if (paidAmount > 0) {
    paymentUpdate.paidAmount = paidAmount;
  }

  await prisma.payment.update({
    where: { id: transactionResult.paymentRecordId },
    data: paymentUpdate,
  });

  await prisma.cartItem.deleteMany({ where: { cartId: transactionResult.cartId } });
  await prisma.cart.update({
    where: { id: transactionResult.cartId },
    data: {
      shippingMethod: { disconnect: true },
      shippingAddress: Prisma.JsonNull,
      billingAddress: Prisma.JsonNull,
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 0,
      coupon: { disconnect: true },
    },
  });

  return {
    orderId: transactionResult.orderId,
    orderNumber: transactionResult.orderNumber,
    status: orderStatus,
    totals: transactionResult.totals,
    payment: {
      method: transactionResult.paymentMethod,
      status: paymentStatusLabel,
      externalReference: transactionResult.externalReference,
      gatewayPaymentId,
      gatewayStatus,
    },
  };
}

export async function ensureStoreSettings() {
  let settings = await prisma.storeSettings.findUnique({ where: { id: "store" } });
  if (!settings) {
    settings = await prisma.storeSettings.create({
      data: {
        id: "store",
        currency: "BRL",
        defaultTitle: DEFAULT_SEO_SETTINGS.defaultTitle,
        defaultDescription: DEFAULT_SEO_SETTINGS.defaultDescription,
        metaImageUrl: DEFAULT_SEO_SETTINGS.metaImageUrl,
        primaryColor: DEFAULT_BRAND_COLORS.primary,
        secondaryColor: DEFAULT_BRAND_COLORS.secondary,
        accentColor: DEFAULT_BRAND_COLORS.accent,
        typography: DEFAULT_TYPOGRAPHY as Prisma.InputJsonValue,
        textBlocks: DEFAULT_TEXT_BLOCKS as Prisma.InputJsonValue,
        homeLayout: DEFAULT_HOME_LAYOUT as Prisma.InputJsonValue,
        seoSettings: DEFAULT_SEO_SETTINGS as Prisma.InputJsonValue,
        domainSettings: DEFAULT_DOMAIN_SETTINGS as Prisma.InputJsonValue,
        integrations: DEFAULT_INTEGRATIONS as Prisma.InputJsonValue,
        checkoutSettings: DEFAULT_CHECKOUT_SETTINGS as Prisma.InputJsonValue,
        luckyWheelSettings: serializeLuckyWheelSettings(cloneLuckyWheelSettings()),
      },
    });
  } else {
    const updateData: Prisma.StoreSettingsUpdateInput = {};

    if (!settings.defaultTitle) {
      updateData.defaultTitle = DEFAULT_SEO_SETTINGS.defaultTitle;
    }
    if (!settings.defaultDescription) {
      updateData.defaultDescription = DEFAULT_SEO_SETTINGS.defaultDescription;
    }
    if (!settings.metaImageUrl) {
      updateData.metaImageUrl = DEFAULT_SEO_SETTINGS.metaImageUrl;
    }
    if (!settings.primaryColor) {
      updateData.primaryColor = DEFAULT_BRAND_COLORS.primary;
    }
    if (!settings.secondaryColor) {
      updateData.secondaryColor = DEFAULT_BRAND_COLORS.secondary;
    }
    if (!settings.accentColor) {
      updateData.accentColor = DEFAULT_BRAND_COLORS.accent;
    }
    if (!settings.typography) {
      updateData.typography = DEFAULT_TYPOGRAPHY as Prisma.InputJsonValue;
    }
    if (!settings.textBlocks) {
      updateData.textBlocks = DEFAULT_TEXT_BLOCKS as Prisma.InputJsonValue;
    }
    if (!settings.homeLayout) {
      updateData.homeLayout = DEFAULT_HOME_LAYOUT as Prisma.InputJsonValue;
    }
    if (!settings.seoSettings) {
      updateData.seoSettings = DEFAULT_SEO_SETTINGS as Prisma.InputJsonValue;
    }
    if (!settings.domainSettings) {
      updateData.domainSettings = DEFAULT_DOMAIN_SETTINGS as Prisma.InputJsonValue;
    }
    if (!settings.integrations) {
      updateData.integrations = DEFAULT_INTEGRATIONS as Prisma.InputJsonValue;
    }
    if (!settings.checkoutSettings) {
      updateData.checkoutSettings = DEFAULT_CHECKOUT_SETTINGS as Prisma.InputJsonValue;
    }
    const normalizedWheel = normalizeLuckyWheelSettings(settings.luckyWheelSettings);
    if (!settings.luckyWheelSettings || JSON.stringify(settings.luckyWheelSettings) !== JSON.stringify(normalizedWheel)) {
      updateData.luckyWheelSettings = serializeLuckyWheelSettings(normalizedWheel);
    }

    if (Object.keys(updateData).length > 0) {
      settings = await prisma.storeSettings.update({ where: { id: "store" }, data: updateData });
    }
  }

  await ensureDefaultCategories();

  // Normalize featured collection title if legacy value is stored.
  if (Array.isArray(settings.homeLayout)) {
    const normalizedLayout = (settings.homeLayout as any[]).map((section) => {
      if (section && typeof section === "object" && section.id === "featured-collection") {
        const currentTitle = typeof section.title === "string" ? section.title : null;
        if (!currentTitle || currentTitle === "Lançamentos Dermosul") {
          return { ...section, title: "Novidades em Dermocosméticos" };
        }
      }
      return section;
    });
    const layoutChanged = JSON.stringify(normalizedLayout) !== JSON.stringify(settings.homeLayout);
    if (layoutChanged) {
      settings = await prisma.storeSettings.update({
        where: { id: "store" },
        data: { homeLayout: normalizedLayout as Prisma.InputJsonValue },
      });
    }
  }

  return settings;
}

export async function getStoreSettings() {
  return ensureStoreSettings();
}

export async function updateStoreSettings(data: Prisma.StoreSettingsUpdateInput) {
  await ensureStoreSettings();
  return prisma.storeSettings.update({ where: { id: "store" }, data });
}

export async function getLuckyWheelSettings(): Promise<LuckyWheelSettings> {
  const settings = await ensureStoreSettings();
  return normalizeLuckyWheelSettings(settings.luckyWheelSettings);
}

export async function updateLuckyWheelSettings(payload: LuckyWheelSettings): Promise<LuckyWheelSettings> {
  await ensureStoreSettings();
  const sanitized = normalizeLuckyWheelSettings(payload);
  const enabledPrizes = sanitized.prizes.filter((prize) => prize.enabled !== false && prize.probability > 0);
  if (enabledPrizes.length === 0) {
    throw new Error("Configure pelo menos um prêmio ativo com probabilidade maior que zero.");
  }
  const totalWeight = enabledPrizes.reduce((sum, prize) => sum + prize.probability, 0);
  if (totalWeight <= 0) {
    throw new Error("A soma das probabilidades dos prêmios ativos deve ser maior que zero.");
  }
  await prisma.storeSettings.update({
    where: { id: "store" },
    data: { luckyWheelSettings: serializeLuckyWheelSettings(sanitized) },
  });
  return sanitized;
}

type LuckyWheelAvailabilityContext = LuckyWheelSpinPayload & { ipAddress?: string | null };

export async function getLuckyWheelPublicState(
  context: LuckyWheelAvailabilityContext
): Promise<LuckyWheelPublicState> {
  const settings = await getLuckyWheelSettings();
  if (!settings.enabled) {
    return { settings, alreadyPlayed: true, blockedReason: "disabled", lastResult: null };
  }

  if (settings.displayRules.requireAuth && !context.customerId) {
    return { settings, alreadyPlayed: true, blockedReason: "auth_required", lastResult: null };
  }

  const globalStatus = await getGlobalLimitStatus(settings);
  if (globalStatus.blocked) {
    return {
      settings,
      alreadyPlayed: true,
      blockedReason: globalStatus.reason,
      lastResult: null,
    };
  }

  const eligiblePrizes = await computeEligiblePrizes(settings);
  if (eligiblePrizes.length === 0) {
    return { settings, alreadyPlayed: true, blockedReason: "no_prizes", lastResult: null };
  }

  const perSessionLimitRaw = settings.displayRules.perSessionMaxSpins;
  const inferredLimit =
    perSessionLimitRaw && perSessionLimitRaw > 0
      ? perSessionLimitRaw
      : settings.displayRules.frequency === "always"
      ? Number.POSITIVE_INFINITY
      : 1;

  const alreadyPlayed = await hasUserPlayedRecently(context, settings, inferredLimit);

  return {
    settings,
    alreadyPlayed,
    blockedReason: alreadyPlayed ? "already_played" : undefined,
    lastResult: null,
  };
}

const generateCouponCode = (value: number) => {
  const suffix = generateShortId().toUpperCase();
  const padded = String(Math.round(value)).padStart(2, "0");
  return `ROLETA-${padded}-${suffix}`.replace(/[^A-Z0-9-]/g, "").slice(0, 20);
};

const buildRotationDegrees = (prizeIndex: number, totalPrizes: number) => {
  if (totalPrizes <= 0) return 0;
  const baseSegment = 360 / totalPrizes;
  const centerAngle = prizeIndex * baseSegment + baseSegment / 2;
  const baseTurns = 4 + Math.floor(Math.random() * 2); // 4 ou 5 voltas
  const jitter = Math.random() * (baseSegment * 0.2) - baseSegment * 0.1;
  const targetAngle = centerAngle + jitter;
  return baseTurns * 360 + (360 - targetAngle);
};

export async function spinLuckyWheel(context: LuckyWheelAvailabilityContext): Promise<LuckyWheelSpinResult> {
  const settings = await getLuckyWheelSettings();
  if (!settings.enabled) {
    const error = new Error("Roleta desabilitada no momento.");
    (error as any).code = "disabled";
    throw error;
  }

  if (settings.displayRules.requireAuth && !context.customerId) {
    const error = new Error("Autenticação necessária para girar a roleta.");
    (error as any).code = "auth_required";
    throw error;
  }

  const globalStatus = await getGlobalLimitStatus(settings);
  if (globalStatus.blocked) {
    const error = new Error("Limite de prêmios atingido por hoje.");
    (error as any).code = globalStatus.reason;
    throw error;
  }

  const perSessionLimitRaw = settings.displayRules.perSessionMaxSpins;
  const inferredLimit =
    perSessionLimitRaw && perSessionLimitRaw > 0
      ? perSessionLimitRaw
      : settings.displayRules.frequency === "always"
      ? Number.POSITIVE_INFINITY
      : 1;

  const alreadyPlayed = await hasUserPlayedRecently(context, settings, inferredLimit);
  if (alreadyPlayed) {
    const error = new Error("Você já girou a roleta recentemente.");
    (error as any).code = "already_played";
    throw error;
  }

  const eligiblePrizes = await computeEligiblePrizes(settings);
  if (eligiblePrizes.length === 0) {
    const error = new Error("Nenhum prêmio disponível no momento.");
    (error as any).code = "no_prizes";
    throw error;
  }

  const weightSum = eligiblePrizes.reduce((sum, prize) => sum + prize.probability, 0);
  if (weightSum <= 0) {
    const error = new Error("Configuração inválida: soma das probabilidades é zero.");
    (error as any).code = "invalid_configuration";
    throw error;
  }

  const draw = Math.random() * weightSum;
  let cursor = 0;
  let selectedPrize = eligiblePrizes[eligiblePrizes.length - 1];
  for (const prize of eligiblePrizes) {
    cursor += prize.probability;
    if (draw <= cursor) {
      selectedPrize = prize;
      break;
    }
  }

  const prizeIndex = settings.prizes.findIndex((prize) => prize.id === selectedPrize.id);
  const rotationDegrees = buildRotationDegrees(prizeIndex >= 0 ? prizeIndex : 0, settings.prizes.length);

  let couponCode: string | null = null;
  let couponType: "PERCENT" | "AMOUNT" | null = null;
  let couponValue: number | null = null;

  if (selectedPrize.coupon && selectedPrize.coupon.value > 0) {
    const coupon = selectedPrize.coupon;
    couponType = coupon.type;
    couponValue = Math.round(coupon.value);
    couponCode = generateCouponCode(couponValue);
    const now = new Date();
    const expiresAt =
      coupon.durationMinutes && Number.isFinite(coupon.durationMinutes)
        ? dayjs(now).add(coupon.durationMinutes, "minute").toDate()
        : null;
    await prisma.coupon.create({
      data: {
        code: couponCode,
        type: coupon.type,
        value: couponValue,
        startsAt: now,
        endsAt: expiresAt,
        active: true,
      },
    });
  }

  const message =
    selectedPrize.resultMessage ||
    settings.messages[selectedPrize.id] ||
    (selectedPrize.type === "MESSAGE"
      ? selectedPrize.message || settings.messages.loseDefault
      : settings.messages.winDefault);

  await prisma.luckyWheelSpin.create({
    data: {
      id: generateUniqueId(),
      customerId: context.customerId ?? null,
      sessionId: context.sessionId ?? null,
      cartId: context.cartId ?? null,
      prizeId: selectedPrize.id,
      prizeLabel: selectedPrize.label,
      prizeType: selectedPrize.type,
      prizePayload: selectedPrize.customPayload as Prisma.InputJsonValue | undefined,
      couponCode,
      freeShipping: Boolean(selectedPrize.freeShipping),
      freeOrder: Boolean(selectedPrize.freeOrder),
      ipAddress: context.ipAddress ?? null,
      metadata: {
        probability: selectedPrize.probability,
        timestamp: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    prize: selectedPrize,
    message,
    couponCode,
    couponType,
    couponValue,
    freeShipping: Boolean(selectedPrize.freeShipping),
    freeOrder: Boolean(selectedPrize.freeOrder),
    autoApplyCoupon: Boolean(selectedPrize.coupon?.autoApply),
    rotationDegrees,
    metadata: {
      prizeIndex,
      totalPrizes: settings.prizes.length,
      spinWeight: weightSum,
      autoApplyCoupon: Boolean(selectedPrize.coupon?.autoApply),
    },
  };
}

async function ensureDefaultCategories() {
  await Promise.all(
    DEFAULT_CATEGORIES.map((category, index) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name, description: category.description, position: index },
        create: { name: category.name, slug: category.slug, description: category.description, position: index },
      })
    )
  );

  const extraCategories = await prisma.category.findMany({
    where: { slug: { notIn: DEFAULT_CATEGORIES.map((item) => item.slug) } },
    orderBy: { name: "asc" },
  });

  if (extraCategories.length > 0) {
    const base = DEFAULT_CATEGORIES.length;
    await Promise.all(
      extraCategories.map((category, idx) =>
        prisma.category.update({
          where: { id: category.id },
          data: { position: base + idx },
        })
      )
    );
  }
}

async function ensureHeroBanners() {
  // Mantém exatamente os 10 banners padrão identificados pelos IDs "banner-hero-*".
  const fallbackIds = DEFAULT_HERO_BANNERS.map((banner) => banner.id);

  await prisma.banner.deleteMany({ where: { kind: "HERO", NOT: { id: { in: fallbackIds } } } });

  for (const fallback of DEFAULT_HERO_BANNERS) {
    await prisma.banner.upsert({
      where: { id: fallback.id },
      update: {},
      create: { ...fallback },
    });
  }
}

export async function listBanners(options?: { kind?: string; activeOnly?: boolean }) {
  if (options?.kind === "HERO") {
    try {
      await ensureHeroBanners();
    } catch (error) {
      console.warn("Falha ao garantir banners padrão do hero", error);
    }
  }
  return prisma.banner.findMany({
    where: {
      ...(options?.kind ? { kind: options.kind as any } : {}),
      ...(options?.activeOnly ? { active: true } : {}),
    },
    orderBy: { position: "asc" as const },
  });
}

export async function createBanner(data: Prisma.BannerCreateInput) {
  return prisma.banner.create({ data });
}

export async function updateBanner(id: string, data: Prisma.BannerUpdateInput) {
  return prisma.banner.update({ where: { id }, data });
}

export async function deleteBanner(id: string) {
  await prisma.banner.delete({ where: { id } });
  return { success: true };
}

export async function listMenus() {
  return prisma.menu.findMany({ include: { items: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } });
}

export async function getMenuByKey(key: string) {
  let menu = await prisma.menu.findUnique({ where: { key: key as any }, include: { items: { orderBy: { position: "asc" } } } });
  if (!menu) {
    menu = await prisma.menu.create({ data: { key: key as any }, include: { items: true } });
  }
  return menu;
}

type MenuItemInput = {
  id?: string;
  label: string;
  href: string;
  position?: number;
  parentId?: string | null;
};

export async function upsertMenuItem(menuId: string, data: MenuItemInput) {
  if (data.id) {
    return prisma.menuItem.update({
      where: { id: data.id },
      data: {
        label: data.label,
        href: data.href,
        position: data.position ?? 0,
        parentId: data.parentId ?? null,
      },
    });
  }
  return prisma.menuItem.create({
    data: {
      menuId,
      label: data.label,
      href: data.href,
      position: data.position ?? 0,
      parentId: data.parentId ?? null,
    },
  });
}

export async function removeMenuItem(id: string) {
  await prisma.menuItem.delete({ where: { id } });
  return { success: true };
}

export async function listCategories() {
  await ensureDefaultCategories();
  return prisma.category.findMany({
    orderBy: [{ position: "asc" as const }, { name: "asc" as const }],
    include: { subcategories: { orderBy: { position: "asc" as const } } },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug }, include: { subcategories: true, products: true } });
}

export async function createCategory(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Prisma.CategoryUpdateInput) {
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({ where: { id } });
  return { success: true };
}

export type ProductSortOption =
  | "relevance"
  | "bestsellers"
  | "rating_desc"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "newest";

export type ListProductsParams = {
  q?: string;
  categoryId?: string;
  collectionId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
  sort?: ProductSortOption;
};

export async function listProducts(params: ListProductsParams = {}) {
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = Math.max(Math.min(params.pageSize ?? 20, 100), 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ProductWhereInput = {};
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { sku: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.active !== undefined) {
    where.active = params.active;
  }
  if (params.categoryId) {
    where.productLinks = { some: { categoryId: params.categoryId } };
  }
  if (params.collectionId) {
    where.collectionLinks = { some: { collectionId: params.collectionId } };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
  switch (params.sort) {
    case "price_asc":
      orderBy.push({ price: "asc" });
      break;
    case "price_desc":
      orderBy.push({ price: "desc" });
      break;
    case "name_asc":
      orderBy.push({ name: "asc" });
      break;
    case "bestsellers":
      orderBy.push({ orderItems: { _count: "desc" } });
      orderBy.push({ createdAt: "desc" });
      break;
    case "rating_desc":
      orderBy.push({ orderItems: { _count: "desc" } });
      orderBy.push({ updatedAt: "desc" });
      break;
    case "newest":
      orderBy.push({ createdAt: "desc" });
      break;
    case "relevance":
    default:
      orderBy.push({ updatedAt: "desc" });
      orderBy.push({ orderItems: { _count: "desc" } });
      break;
  }

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        ...SELECT_PRODUCT_SUMMARY,
        images: { orderBy: { position: "asc" as const }, take: 1, select: IMAGE_SELECT },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({ where: { id }, select: SELECT_PRODUCT_DETAIL });
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug }, select: SELECT_PRODUCT_DETAIL });
}

type UpsertProductInput = {
  id?: string;
  name: string;
  slug: string;
  brand?: string;
  sku: string;
  description?: string;
  descriptionHtml?: string | null;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity?: number;
  active?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  images?: { id?: string; url: string; alt?: string | null; position?: number }[];
  variants?: { id?: string; name: string; sku: string; price?: number | null; stock?: number; attributes?: Record<string, any> }[];
  categoryIds?: string[];
  collectionIds?: string[];
};

export async function upsertProduct(input: UpsertProductInput) {
  const baseData = {
    name: input.name,
    slug: input.slug,
    brand: input.brand ?? "",
    sku: input.sku,
    description: input.description ?? "",
    descriptionHtml: input.descriptionHtml || null,
    price: input.price,
    compareAtPrice: input.compareAtPrice ?? null,
    stockQuantity: input.stockQuantity ?? 0,
    active: input.active ?? true,
    metaTitle: input.metaTitle || null,
    metaDescription: input.metaDescription || null,
  };

  if (input.id) {
    await prisma.product.update({
      where: { id: input.id },
      data: {
        ...baseData,
        images: input.images
          ? {
              deleteMany: {},
              create: input.images.map((image, index) => ({
                url: image.url,
                alt: image.alt || null,
                position: image.position ?? index,
              })),
            }
          : undefined,
        variants: input.variants
          ? {
              deleteMany: {},
              create: input.variants.map((variant) => ({
                name: variant.name,
                sku: variant.sku,
                price: variant.price ?? null,
                stock: variant.stock ?? 0,
                ...(variant.attributes ? { attributes: variant.attributes as Prisma.InputJsonValue } : {}),
              })),
            }
          : undefined,
        productLinks: input.categoryIds
          ? {
              deleteMany: {},
              create: input.categoryIds.map((categoryId, position) => ({ categoryId, position })),
            }
          : undefined,
        collectionLinks: input.collectionIds
          ? {
              deleteMany: {},
              create: input.collectionIds.map((collectionId, position) => ({ collectionId, position })),
            }
          : undefined,
      },
    });
    return getProductById(input.id);
  }

  const created = await prisma.product.create({
    data: {
      ...baseData,
      images: input.images
        ? {
            create: input.images.map((image, index) => ({
              url: image.url,
              alt: image.alt || null,
              position: image.position ?? index,
            })),
          }
        : undefined,
      variants: input.variants
        ? {
            create: input.variants.map((variant) => ({
              name: variant.name,
              sku: variant.sku,
              price: variant.price ?? null,
              stock: variant.stock ?? 0,
              ...(variant.attributes ? { attributes: variant.attributes as Prisma.InputJsonValue } : {}),
            })),
          }
        : undefined,
      productLinks: input.categoryIds
        ? {
            create: input.categoryIds.map((categoryId, position) => ({ categoryId, position })),
          }
        : undefined,
      collectionLinks: input.collectionIds
        ? {
            create: input.collectionIds.map((collectionId, position) => ({ collectionId, position })),
          }
        : undefined,
    },
  });
  return getProductById(created.id);
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  return { success: true };
}

export async function listCollections() {
  return prisma.collection.findMany({
    orderBy: [{ position: "asc" as const }, { name: "asc" as const }],
    include: { products: { include: { product: true }, orderBy: { position: "asc" as const } } },
  });
}

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findUnique({ where: { slug }, include: { products: { include: { product: true } } } });
}

export async function createCollection(data: Prisma.CollectionCreateInput) {
  return prisma.collection.create({ data });
}

export async function updateCollection(id: string, data: Prisma.CollectionUpdateInput) {
  return prisma.collection.update({ where: { id }, data });
}

export async function deleteCollection(id: string) {
  await prisma.collection.delete({ where: { id } });
  return { success: true };
}

export async function listPages() {
  return prisma.page.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getPageBySlug(slug: string) {
  return prisma.page.findUnique({ where: { slug } });
}

export async function createPage(data: Prisma.PageCreateInput) {
  return prisma.page.create({ data });
}

export async function updatePage(id: string, data: Prisma.PageUpdateInput) {
  return prisma.page.update({ where: { id }, data });
}

export async function deletePage(id: string) {
  await prisma.page.delete({ where: { id } });
  return { success: true };
}

export async function listShippingMethods() {
  return prisma.shippingMethod.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createShippingMethod(data: Prisma.ShippingMethodCreateInput) {
  return prisma.shippingMethod.create({ data });
}

export async function updateShippingMethod(id: string, data: Prisma.ShippingMethodUpdateInput) {
  return prisma.shippingMethod.update({ where: { id }, data });
}

export async function deleteShippingMethod(id: string) {
  await prisma.shippingMethod.delete({ where: { id } });
  return { success: true };
}

export async function listPaymentProviders() {
  return prisma.paymentProvider.findMany({ orderBy: { createdAt: "asc" } });
}

export async function upsertPaymentProvider(data: Prisma.PaymentProviderUncheckedCreateInput & { id?: string }) {
  if (data.id) {
    return prisma.paymentProvider.update({ where: { id: data.id }, data });
  }
  return prisma.paymentProvider.create({ data });
}

export async function deletePaymentProvider(id: string) {
  await prisma.paymentProvider.delete({ where: { id } });
  return { success: true };
}

export async function listCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCoupon(data: Prisma.CouponCreateInput) {
  return prisma.coupon.create({ data });
}

export async function updateCoupon(id: string, data: Prisma.CouponUpdateInput) {
  return prisma.coupon.update({ where: { id }, data });
}

export async function deleteCoupon(id: string) {
  await prisma.coupon.delete({ where: { id } });
  return { success: true };
}

export async function searchProducts(term: string, limit = 12) {
  return prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
      ],
      active: true,
    },
    take: limit,
    select: {
      ...SELECT_PRODUCT_SUMMARY,
      images: { orderBy: { position: "asc" as const }, take: 1, select: IMAGE_SELECT },
    },
  });
}

export async function listCategoryProducts(slug: string, params: Omit<ListProductsParams, "categoryId"> = {}) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 20, totalPages: 1 };
  return listProducts({ ...params, categoryId: category.id, active: params.active ?? true });
}

export async function listCollectionProducts(slug: string, params: Omit<ListProductsParams, "collectionId"> = {}) {
  const collection = await prisma.collection.findUnique({ where: { slug } });
  if (!collection) return { items: [], total: 0, page: 1, pageSize: params.pageSize ?? 20, totalPages: 1 };
  return listProducts({ ...params, collectionId: collection.id, active: params.active ?? true });
}

export async function getStorefrontSitemapEntries() {
  const [categories, collections, products, pages] = await Promise.all([
    prisma.category.findMany({ select: { slug: true } }),
    prisma.collection.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return { categories, collections, products, pages };
}

export async function generateSitemapXml(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const now = new Date().toISOString();
  type SitemapEntries = Awaited<ReturnType<typeof getStorefrontSitemapEntries>>;
  const entries: SitemapEntries = await getStorefrontSitemapEntries();

  const homeUrl = { loc: `${normalizedBase}/`, lastmod: now, changefreq: 'daily', priority: '1.0' };
  type CategoryEntry = SitemapEntries["categories"][number];
  type CollectionEntry = SitemapEntries["collections"][number];
  type ProductEntry = SitemapEntries["products"][number];
  type PageEntry = SitemapEntries["pages"][number];

  const categoryUrls = entries.categories.map((category: CategoryEntry) => ({
    loc: `${normalizedBase}/c/${category.slug}`,
    lastmod: now,
    changefreq: 'weekly',
    priority: '0.8',
  }));
  const collectionUrls = entries.collections.map((collection: CollectionEntry) => ({
    loc: `${normalizedBase}/colecoes/${collection.slug}`,
    lastmod: collection.updatedAt?.toISOString() || now,
    changefreq: 'weekly',
    priority: '0.7',
  }));
  const productUrls = entries.products.map((product: ProductEntry) => ({
    loc: `${normalizedBase}/p/${product.slug}`,
    lastmod: product.updatedAt?.toISOString() || now,
    changefreq: 'weekly',
    priority: '0.6',
  }));
  const pageUrls = entries.pages.map((page: PageEntry) => ({
    loc: `${normalizedBase}/pg/${page.slug}`,
    lastmod: page.updatedAt?.toISOString() || now,
    changefreq: 'monthly',
    priority: '0.4',
  }));

  const urlset = [homeUrl, ...categoryUrls, ...collectionUrls, ...productUrls, ...pageUrls]
    .map((url) => [
      '    <url>',
      `      <loc>${url.loc}</loc>`,
      `      <lastmod>${url.lastmod}</lastmod>`,
      `      <changefreq>${url.changefreq}</changefreq>`,
      `      <priority>${url.priority}</priority>`,
      '    </url>',
    ].join('\n'))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`;
}

const ensureOrderedProducts = (ids: string[], products: RecommendationProduct[]) => {
  const map = new Map<string, RecommendationProduct>(products.map((product) => [product.id, product] as const));
  const ordered: RecommendationProduct[] = [];
  ids.forEach((id) => {
    const product = map.get(id);
    if (product) {
      ordered.push(product);
    }
  });
  return ordered;
};

const dedupeProducts = (products: RecommendationProduct[]) => {
  const seen = new Set<string>();
  const result: RecommendationProduct[] = [];
  for (const product of products) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    result.push(product);
  }
  return result;
};

export async function logStorefrontEvent(input: {
  sessionId: string;
  eventType: StorefrontEventType;
  productId?: string | null;
  collectionId?: string | null;
  cartId?: string | null;
  customerId?: string | null;
  metadata?: unknown;
}) {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) {
    return null;
  }

  const payload: Prisma.StorefrontEventCreateInput = {
    sessionId,
    eventType: input.eventType,
    metadata:
      input.metadata !== undefined
        ? (input.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull,
  };

  if (input.productId) {
    payload.product = { connect: { id: input.productId } };
  }
  if (input.collectionId) {
    payload.collection = { connect: { id: input.collectionId } };
  }
  if (input.cartId) {
    payload.cart = { connect: { id: input.cartId } };
  }
  if (input.customerId) {
    payload.customer = { connect: { id: input.customerId } };
  }

  try {
    return await prisma.storefrontEvent.create({ data: payload });
  } catch (error) {
    console.warn("[storefront] Falha ao registrar evento", error);
    return null;
  }
}

type RecommendationSections = {
  trending: RecommendationProduct[];
  newArrivals: RecommendationProduct[];
  cartComplements: RecommendationProduct[];
  customerFavorites: RecommendationProduct[];
};

const RECOMMENDATION_WINDOW_DAYS = 45;

export async function getPersonalizedRecommendations(params: {
  sessionId?: string | null;
  cartId?: string | null;
  customerId?: string | null;
  limitPerSection?: number;
}): Promise<RecommendationSections> {
  const limit = Math.max(params.limitPerSection ?? 8, 1);
  const since = new Date();
  since.setDate(since.getDate() - RECOMMENDATION_WINDOW_DAYS);

  const cartProductIds: string[] = await (async () => {
    if (!params.cartId) return [];
    const cart = await prisma.cart.findUnique({
      where: { id: params.cartId },
      include: { items: true },
    });
    const ids = cart?.items
      ?.map((item: { productId: string | null }) => item.productId)
      ?.filter((id): id is string => Boolean(id));
    return ids ?? [];
  })();

  const cartProductIdSet = new Set(cartProductIds);

  const [trendingRaw, newArrivalsRaw, cartComplementRaw, favoritesRaw] = await Promise.all([
    prisma.orderItem
      .groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gte: since } } },
        _sum: { qty: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: limit * 3,
      })
      .then(async (groups: Array<{ productId: string | null }>) => {
        const productIds = groups.map((item: { productId: string | null }) => item.productId).filter(Boolean) as string[];
        if (productIds.length === 0) return [] as RecommendationProduct[];
        const products = await prisma.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
          },
          select: RECO_PRODUCT_SELECT,
        });
        return ensureOrderedProducts(productIds, products);
      }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ createdAt: 'desc' as const }],
      take: limit * 2,
      select: RECO_PRODUCT_SELECT,
    }),
    (async (): Promise<RecommendationProduct[]> => {
      if (cartProductIds.length === 0) return [];

      const [categoryLinks, collectionLinks] = await Promise.all([
        prisma.productCategory.findMany({
          where: { productId: { in: cartProductIds } },
          select: { categoryId: true },
        }),
        prisma.productCollection.findMany({
          where: { productId: { in: cartProductIds } },
          select: { collectionId: true },
        }),
      ]);

      const categoryIds = categoryLinks
        .map((item: { categoryId: string | null }) => item.categoryId)
        .filter((value: string | null): value is string => Boolean(value));
      const collectionIds = collectionLinks
        .map((item: { collectionId: string | null }) => item.collectionId)
        .filter((value: string | null): value is string => Boolean(value));

      const orConditions: Prisma.ProductWhereInput[] = [];
      if (categoryIds.length > 0) {
        orConditions.push({ productLinks: { some: { categoryId: { in: categoryIds } } } });
      }
      if (collectionIds.length > 0) {
        orConditions.push({ collectionLinks: { some: { collectionId: { in: collectionIds } } } });
      }

      if (orConditions.length === 0) {
        return [];
      }

      const products = await prisma.product.findMany({
        where: {
          active: true,
          id: { notIn: cartProductIds },
          OR: orConditions,
        },
        orderBy: [{ updatedAt: 'desc' as const }, { createdAt: 'desc' as const }],
        take: limit * 2,
        select: RECO_PRODUCT_SELECT,
      });

      return products;
    })(),
    (async () => {
      if (!params.customerId) return [] as RecommendationProduct[];

      const recentOrders = await prisma.order.findMany({
        where: { customerId: params.customerId },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const itemsByRecency: string[] = [];
      for (const order of recentOrders) {
        for (const item of order.items) {
          if (!item.productId) continue;
          if (cartProductIdSet.has(item.productId)) continue;
          itemsByRecency.push(item.productId);
        }
      }

      const productIds = Array.from(new Set(itemsByRecency));
      if (productIds.length === 0) return [] as RecommendationProduct[];

      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, active: true },
        select: RECO_PRODUCT_SELECT,
      });
      return ensureOrderedProducts(productIds, products);
    })(),
  ]);

  const trending = dedupeProducts(trendingRaw.filter((product: RecommendationProduct) => !cartProductIdSet.has(product.id))).slice(0, limit);
  const newArrivals = dedupeProducts(newArrivalsRaw.filter((product: RecommendationProduct) => !cartProductIdSet.has(product.id))).slice(0, limit);
  const cartComplements = dedupeProducts(cartComplementRaw).slice(0, limit);
  const customerFavorites = dedupeProducts(favoritesRaw).slice(0, limit);

  return {
    trending,
    newArrivals,
    cartComplements,
    customerFavorites,
  };
}
