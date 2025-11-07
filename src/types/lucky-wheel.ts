export type LuckyWheelPrizeType =
  | "PERCENT_DISCOUNT"
  | "AMOUNT_DISCOUNT"
  | "FREE_SHIPPING"
  | "FREE_ORDER"
  | "MESSAGE"
  | "CUSTOM";

export interface LuckyWheelPrizeLimit {
  daily?: number | null;
  monthly?: number | null;
  total?: number | null;
}

export interface LuckyWheelPrizeCouponConfig {
  type: "PERCENT" | "AMOUNT";
  value: number;
  autoApply?: boolean;
  durationMinutes?: number | null;
}

export interface LuckyWheelPrize {
  id: string;
  label: string;
  description?: string;
  type: LuckyWheelPrizeType;
  probability: number;
  enabled?: boolean;
  coupon?: LuckyWheelPrizeCouponConfig | null;
  freeShipping?: boolean;
  freeOrder?: boolean;
  message?: string;
  customPayload?: Record<string, unknown> | null;
  resultMessage?: string;
  sliceColor?: string;
  textColor?: string;
  icon?: string | null;
  limit?: LuckyWheelPrizeLimit | null;
}

export interface LuckyWheelDesign {
  overlayColor?: string;
  overlayOpacity?: number;
  blurRadius?: number;
  borderColor?: string;
  wheelBackground?: string;
  wheelShadow?: string;
  pointerColor?: string;
  pointerShadow?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonShadow?: string;
  highlightColor?: string;
  wheelGlowColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  showLogo?: boolean;
  sound?: {
    enabled: boolean;
    spin?: string | null;
    win?: string | null;
    lose?: string | null;
  };
}

export interface LuckyWheelLimits {
  globalDaily?: number | null;
  globalMonthly?: number | null;
  perPrize?: Record<string, LuckyWheelPrizeLimit | undefined>;
}

export interface LuckyWheelDisplayRules {
  showOn: Array<"cart" | "checkout" | "post_purchase">;
  frequency: "once_per_session" | "once_per_customer" | "always";
  showAgainAfterHours?: number | null;
  perSessionMaxSpins?: number | null;
  requireAuth?: boolean;
}

export interface LuckyWheelMessages {
  winDefault: string;
  loseDefault: string;
  almostThere: string;
  alreadyPlayed: string;
  blocked: string;
  [prizeId: string]: string | undefined;
}

export interface LuckyWheelSettings {
  enabled: boolean;
  headline: string;
  subheadline?: string;
  description?: string;
  ctaLabel: string;
  buttonLabel: string;
  prizes: LuckyWheelPrize[];
  design: LuckyWheelDesign;
  limits: LuckyWheelLimits;
  displayRules: LuckyWheelDisplayRules;
  messages: LuckyWheelMessages;
  analytics?: {
    enableTracking?: boolean;
  };
}

export interface LuckyWheelPublicState {
  settings: LuckyWheelSettings;
  alreadyPlayed: boolean;
  blockedReason?: string | null;
  lastResult?: LuckyWheelSpinResult | null;
  sessionPerks?: {
    freeShippingGranted?: boolean;
    freeOrderGranted?: boolean;
  } | null;
}

export interface LuckyWheelSpinPayload {
  cartId?: string | null;
  sessionId?: string | null;
  customerId?: string | null;
  ipAddress?: string | null;
}

export interface LuckyWheelSpinResult {
  prize: LuckyWheelPrize;
  message: string;
  couponCode?: string | null;
  couponType?: "PERCENT" | "AMOUNT" | null;
  couponValue?: number | null;
  freeShipping?: boolean;
  freeOrder?: boolean;
  autoApplyCoupon?: boolean;
  rotationDegrees: number;
  metadata?: Record<string, unknown>;
}
