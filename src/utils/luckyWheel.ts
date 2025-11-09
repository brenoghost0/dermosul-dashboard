import type {
  LuckyWheelDisplayRules,
  LuckyWheelLimits,
  LuckyWheelPrize,
  LuckyWheelPrizeLimit,
  LuckyWheelPrizeType,
  LuckyWheelSettings,
} from "../types/lucky-wheel";

const basePrizeLimit = (limit?: LuckyWheelPrizeLimit | null): LuckyWheelPrizeLimit => ({
  daily: limit?.daily ?? null,
  monthly: limit?.monthly ?? null,
  total: limit?.total ?? null,
});

const createId = () => {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `prize_${Math.random().toString(36).slice(2, 10)}`;
};

const basePrize = (prize: Partial<LuckyWheelPrize> & { id?: string; label?: string }): LuckyWheelPrize => {
  const type: LuckyWheelPrizeType = prize.type ?? "MESSAGE";
  const sliceColor = prize.sliceColor ?? "#F4ECFF";
  const textColor = prize.textColor ?? "#4A3AA1";

  const icon =
    prize.icon === undefined
      ? "sparkles"
      : prize.icon === null || prize.icon === "" || prize.icon === "refresh"
      ? null
      : prize.icon;

  const normalized: LuckyWheelPrize = {
    id: prize.id ?? createId(),
    label: prize.label ?? "Prêmio Dermosul",
    description: prize.description ?? "",
    type,
    probability: typeof prize.probability === "number" ? prize.probability : 0,
    enabled: prize.enabled !== false,
    sliceColor,
    textColor,
    icon,
    message: prize.message,
    resultMessage: prize.resultMessage,
    freeShipping: prize.freeShipping ?? type === "FREE_SHIPPING",
    freeOrder: prize.freeOrder ?? type === "FREE_ORDER",
    customPayload: prize.customPayload ?? null,
    limit: basePrizeLimit(prize.limit),
    coupon: null,
  };

  if (type === "PERCENT_DISCOUNT" || type === "AMOUNT_DISCOUNT") {
    const couponType = type === "AMOUNT_DISCOUNT" ? "AMOUNT" : "PERCENT";
    const value =
      typeof prize.coupon?.value === "number" && prize.coupon.value > 0
        ? Math.round(prize.coupon.value)
        : couponType === "AMOUNT"
        ? 5000
        : 10;
    normalized.coupon = {
      type: couponType,
      value,
      autoApply: prize.coupon?.autoApply ?? true,
      durationMinutes:
        prize.coupon?.durationMinutes === null || prize.coupon?.durationMinutes === undefined
          ? null
          : Math.max(1, Math.floor(prize.coupon.durationMinutes)),
    };
  }

  return normalized;
};

const baseLimits = (limits?: LuckyWheelLimits | null): LuckyWheelLimits => ({
  globalDaily: limits?.globalDaily ?? null,
  globalMonthly: limits?.globalMonthly ?? null,
  perPrize: limits?.perPrize ? { ...limits.perPrize } : {},
});

const baseDisplayRules = (rules?: LuckyWheelDisplayRules | null): LuckyWheelDisplayRules => ({
  showOn: Array.isArray(rules?.showOn) && rules!.showOn.length > 0 ? (rules!.showOn as any) : ["cart"],
  frequency: rules?.frequency ?? "once_per_session",
  showAgainAfterHours: rules?.showAgainAfterHours ?? 24,
  perSessionMaxSpins: rules?.perSessionMaxSpins ?? 1,
  requireAuth: rules?.requireAuth ?? false,
});

export const DEFAULT_LUCKY_WHEEL_SETTINGS: LuckyWheelSettings = {
  enabled: true,
  headline: "Roleta da Sorte Dermosul",
  subheadline: "Um mimo pra você.",
  description: "Gire e descubra na hora qual presente Dermosul liberou especialmente pra você hoje.",
  ctaLabel: "Um mimo só pra você",
  buttonLabel: "GIRAR AGORA",
  prizes: [],
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

const withFallbackPrizes = (prizes?: LuckyWheelPrize[] | null): LuckyWheelPrize[] => {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return [
      basePrize({
        id: "frete-gratis",
        label: "Frete grátis",
        type: "FREE_SHIPPING",
        probability: 12,
        freeShipping: true,
        icon: "sparkles",
        sliceColor: "#F4ECFF",
        textColor: "#5136A8",
        resultMessage: "🎉 Parabéns! Você ganhou frete grátis nesta compra!",
      }),
      basePrize({
        id: "cupom-10",
        label: "10% OFF",
        type: "PERCENT_DISCOUNT",
        probability: 24,
        coupon: { type: "PERCENT", value: 10, autoApply: true, durationMinutes: 1440 },
        icon: "badge-percent",
        sliceColor: "#EAF4FF",
        textColor: "#3D3993",
        resultMessage: "💜 Você ganhou 10% OFF — já aplicamos o carinho no carrinho!",
      }),
      basePrize({
        id: "cupom-20",
        label: "20% OFF",
        type: "PERCENT_DISCOUNT",
        probability: 18,
        coupon: { type: "PERCENT", value: 20, autoApply: true, durationMinutes: 1440 },
        icon: "stars",
        sliceColor: "#FFF0F8",
        textColor: "#5D38A9",
        resultMessage: "💸 Incrível! Cupom de 20% OFF aplicado automaticamente.",
      }),
      basePrize({
        id: "cupom-30",
        label: "30% OFF",
        type: "PERCENT_DISCOUNT",
        probability: 8,
        coupon: { type: "PERCENT", value: 30, autoApply: true, durationMinutes: 1440 },
        icon: "gift",
        sliceColor: "#FEF5E7",
        textColor: "#6A3FE4",
        resultMessage: "🎁 Surpresa! Você levou 30% OFF nesta compra de carinho.",
      }),
      basePrize({
        id: "pedido-gratis",
        label: "Pedido 100% grátis",
        type: "FREE_ORDER",
        probability: 4,
        freeOrder: true,
        icon: "crown",
        sliceColor: "#EAF7F6",
        textColor: "#4527A0",
        resultMessage: "🌟 UAU! Transformamos esse pedido em 100% Dermosul por nossa conta.",
        limit: { daily: 1, monthly: 10, total: null },
      }),
      basePrize({
        id: "tente-novamente",
        label: "Tente novamente",
        type: "MESSAGE",
        probability: 34,
        message: "😢 Que pena! Tente novamente na próxima compra.",
        sliceColor: "#F9F7FF",
        textColor: "#7C70B8",
        resultMessage: "😢 Que pena! Tente novamente na próxima compra.",
      }),
    ];
  }

  return prizes.map((prize) => basePrize(prize));
};

export const normalizeLuckyWheelSettings = (raw?: LuckyWheelSettings | null): LuckyWheelSettings => {
  if (!raw) {
    return {
      ...DEFAULT_LUCKY_WHEEL_SETTINGS,
      prizes: withFallbackPrizes(),
    };
  }

  const legacySubheadline = "Luxo minimalista com brindes que abraçam sua rotina.";
  const legacyDescription =
    "Gire e descubra cuidados presentes da Dermosul. Cada prêmio foi criado para deixar sua experiência ainda mais especial.";
  const legacyCta = "Liberamos presentes exclusivos hoje";
  const legacyButton = "GIRAR ROLETA";

  const sanitizedSubheadline =
    raw.subheadline && raw.subheadline.trim() === legacySubheadline ? DEFAULT_LUCKY_WHEEL_SETTINGS.subheadline : raw.subheadline;
  const sanitizedDescription =
    raw.description && raw.description.trim() === legacyDescription ? DEFAULT_LUCKY_WHEEL_SETTINGS.description : raw.description;
  const sanitizedCta = raw.ctaLabel && raw.ctaLabel.trim() === legacyCta ? DEFAULT_LUCKY_WHEEL_SETTINGS.ctaLabel : raw.ctaLabel;
  const sanitizedButton =
    raw.buttonLabel && raw.buttonLabel.trim() === legacyButton ? DEFAULT_LUCKY_WHEEL_SETTINGS.buttonLabel : raw.buttonLabel;

  return {
    enabled: raw.enabled ?? true,
    headline: raw.headline ?? DEFAULT_LUCKY_WHEEL_SETTINGS.headline,
    subheadline: sanitizedSubheadline ?? DEFAULT_LUCKY_WHEEL_SETTINGS.subheadline,
    description: sanitizedDescription ?? DEFAULT_LUCKY_WHEEL_SETTINGS.description,
    ctaLabel: sanitizedCta ?? DEFAULT_LUCKY_WHEEL_SETTINGS.ctaLabel,
    buttonLabel: sanitizedButton ?? DEFAULT_LUCKY_WHEEL_SETTINGS.buttonLabel,
    prizes: withFallbackPrizes(raw.prizes),
    design: (() => {
      const baseSound = DEFAULT_LUCKY_WHEEL_SETTINGS.design.sound ?? {
        enabled: true,
        spin: null,
        win: null,
        lose: null,
      };
      return {
        ...DEFAULT_LUCKY_WHEEL_SETTINGS.design,
        ...(raw.design ?? {}),
        sound: {
          ...baseSound,
          ...(raw.design?.sound ?? {}),
          enabled: raw.design?.sound?.enabled ?? baseSound.enabled,
        },
      };
    })(),
    limits: {
      ...DEFAULT_LUCKY_WHEEL_SETTINGS.limits,
      ...baseLimits(raw.limits),
    },
    displayRules: baseDisplayRules(raw.displayRules),
    messages: {
      ...DEFAULT_LUCKY_WHEEL_SETTINGS.messages,
      ...(raw.messages ?? {}),
    },
    analytics: {
      ...DEFAULT_LUCKY_WHEEL_SETTINGS.analytics,
      ...(raw.analytics ?? {}),
    },
  };
};

export const normalizePrizeCollection = (prizes: LuckyWheelPrize[]): LuckyWheelPrize[] =>
  prizes.map((prize) => basePrize(prize));
