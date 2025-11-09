import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { storefrontApi } from "../api";
import type { LuckyWheelPublicState, LuckyWheelSpinResult, LuckyWheelPrize, LuckyWheelSettings } from "../../../types/lucky-wheel";
import { normalizeLuckyWheelSettings } from "../../../utils/luckyWheel";

type LuckyWheelExperienceProps = {
  cartId?: string | null;
  sessionToken?: string | null;
  onApplyCoupon?: (code: string) => Promise<void> | void;
};

type WheelStatus = {
  loading: boolean;
  error: string | null;
  data: LuckyWheelPublicState | null;
};

const easing = "cubic-bezier(0.18, 0.65, 0.19, 0.95)";
const SPIN_DURATION_MS = 7200;
const RESULT_REVEAL_DELAY_MS = 1600;
const LIGHT_COUNT = 24;
const DEFAULT_SLICE_COLORS = ["#00b5e9", "#ff9f1b", "#00a7ff", "#ff4f86", "#80d63d", "#ffda42", "#0091ff", "#ff6b39", "#23c2f3", "#ff8f1f", "#199bff", "#ff4f9f"];
const DEFAULT_FONT_FAMILY = "'Poppins', 'Outfit', sans-serif";
const LABEL_RADIUS = 128;
const ICON_MAP: Record<string, string> = {
  sparkles: "✨",
  stars: "🌟",
  star: "⭐️",
  gift: "🎁",
  crown: "👑",
  trophy: "🏆",
  diamond: "💎",
  heart: "💖",
  "badge-percent": "🏷️",
  ticket: "🎟️",
  truck: "🚚",
  bag: "🛍️",
  fire: "🔥",
};

type ParticlePreset = {
  top: string;
  left: string;
  size: number;
  delay: string;
  duration: string;
  color: string;
  glow: string;
};

const LUCKY_AURORA_PARTICLES: ParticlePreset[] = [
  { top: "8%", left: "12%", size: 32, delay: "0s", duration: "9s", color: "rgba(156, 197, 255, 0.55)", glow: "rgba(156,197,255,0.7)" },
  { top: "18%", left: "78%", size: 42, delay: "1s", duration: "11s", color: "rgba(249, 198, 255, 0.6)", glow: "rgba(249,198,255,0.78)" },
  { top: "34%", left: "6%", size: 26, delay: "2s", duration: "8s", color: "rgba(177, 240, 231, 0.5)", glow: "rgba(177,240,231,0.65)" },
  { top: "65%", left: "14%", size: 38, delay: "1.4s", duration: "10s", color: "rgba(255, 227, 173, 0.45)", glow: "rgba(255,227,173,0.66)" },
  { top: "72%", left: "84%", size: 30, delay: "0.8s", duration: "7s", color: "rgba(147, 182, 255, 0.55)", glow: "rgba(147,182,255,0.75)" },
  { top: "12%", left: "58%", size: 28, delay: "2.3s", duration: "9s", color: "rgba(255, 210, 234, 0.58)", glow: "rgba(255,210,234,0.78)" },
  { top: "48%", left: "90%", size: 36, delay: "1.9s", duration: "12s", color: "rgba(188, 216, 255, 0.62)", glow: "rgba(188,216,255,0.85)" },
  { top: "82%", left: "38%", size: 24, delay: "0.6s", duration: "7.5s", color: "rgba(239, 196, 255, 0.5)", glow: "rgba(239,196,255,0.74)" },
];

type WheelSegment = {
  id: string;
  label: string;
  textColor: string;
  rotation: number;
  icon: string | null;
  sweep: number;
  backgroundColor: string;
};

type FetchOptions = {
  suppressLastResult?: boolean;
};

type InfoTone = "warning" | "success" | "info" | "neutral";

export function LuckyWheelExperience({ cartId, sessionToken, onApplyCoupon }: LuckyWheelExperienceProps) {
  const [status, setStatus] = useState<WheelStatus>({ loading: true, error: null, data: null });
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [activePrizeId, setActivePrizeId] = useState<string | null>(null);
  const [result, setResult] = useState<LuckyWheelSpinResult | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const [hasPresented, setHasPresented] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const timeouts = useRef<number[]>([]);
  const audioCache = useRef<Record<string, HTMLAudioElement>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  }));
  const isMobileViewport = viewport.width <= 768;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartId, sessionToken]);

  const lastKnownResult = useMemo(() => result ?? status.data?.lastResult ?? null, [result, status.data?.lastResult]);

  useEffect(() => {
    if (!status.data) return;
    if (!isMobileViewport || !status.data.settings.enabled) {
      setIsOpen(false);
      return;
    }

    const blocked = status.data.blockedReason ?? null;

    if (lastKnownResult && !dismissed) {
      setIsOpen(true);
      setHasPresented(true);
      return;
    }

    if (blocked && blocked !== "already_played") {
      setIsOpen(false);
      return;
    }

    if (status.data.alreadyPlayed && !lastKnownResult) {
      setIsOpen(false);
      return;
    }

    if (!dismissed && !hasPresented) {
      setIsOpen(true);
      setHasPresented(true);
      return;
    }

    if (dismissed) {
      setIsOpen(false);
    }
  }, [status.data, hasPresented, dismissed, isMobileViewport, lastKnownResult]);

  useEffect(() => {
    if (isOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!status.data) {
      setHasPresented(false);
      setDismissed(false);
    }
  }, [status.data?.settings.headline]);

  useEffect(() => {
    if (status.data && !status.data.alreadyPlayed) {
      setDismissed(false);
    }
  }, [status.data?.alreadyPlayed]);

  useEffect(() => {
    if (!isMobileViewport) {
      setIsOpen(false);
    }
  }, [isMobileViewport]);

  const prizes: LuckyWheelPrize[] = useMemo(() => status.data?.settings.prizes ?? [], [status.data?.settings.prizes]);
  const gradient = useMemo(() => buildConicGradient(prizes), [prizes]);
  const labels = useMemo(() => computeSegmentLabels(prizes), [prizes]);
  const lights = useMemo(
    () =>
      Array.from({ length: LIGHT_COUNT }, (_, index) => ({
        id: index,
        angle: (360 / LIGHT_COUNT) * index,
        radius: index % 2 === 0 ? 202 : 192,
        tone: index % 2 === 0 ? "primary" : "secondary",
      })),
    []
  );
  const pins = useMemo(() => {
    const count = prizes.length || 12;
    const sweep = 360 / count;
    return Array.from({ length: count }, (_, index) => ({
      id: `pin-${index}`,
      angle: index * sweep + sweep * 0.35,
      radius: LABEL_RADIUS + 10,
      color: index % 3 === 0 ? "#1dd2ff" : index % 3 === 1 ? "#ff73aa" : "#ffe26f",
    }));
  }, [prizes.length]);
  const auroraParticles = useMemo(() => LUCKY_AURORA_PARTICLES, []);

  const spinDisabled =
    !status.data || status.data.alreadyPlayed || isSpinning || status.data.blockedReason === "limit_daily" || status.data.blockedReason === "limit_monthly";

  const isCompactLayout = viewport.width < 768;
  const baseWheelSize = 360;
  const minViewportAxis = Math.max(320, Math.min(viewport.width, viewport.height));
  const targetWheelPixels = minViewportAxis * (isCompactLayout ? 0.24 : 0.32); // compact layout gets ~25% shorter wheel
  const wheelScale = isCompactLayout ? Math.min(0.75, Math.max(0.34, targetWheelPixels / baseWheelSize)) : 0.85;
  const wheelContainerStyle: CSSProperties = {
    width: baseWheelSize * wheelScale,
    height: baseWheelSize * wheelScale,
    overflow: "visible",
  };
  const wheelTransformStyle: CSSProperties = {
    transform: `translate(-50%, -50%) scale(${wheelScale})`,
    transformOrigin: "center",
    overflow: "visible",
  };

  useEffect(
    () => () => {
      clearPendingTimeouts();
    },
    []
  );

  function clearPendingTimeouts() {
    timeouts.current.forEach((id) => {
      window.clearTimeout(id);
    });
    timeouts.current = [];
  }

  async function fetchState(options?: FetchOptions) {
    setStatus((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const query = {
        cartId: cartId ?? undefined,
        sessionToken: sessionToken ?? undefined,
      };
      const data = await storefrontApi.getLuckyWheelState(query);
      const normalized: LuckyWheelPublicState = {
        ...data,
        settings: normalizeLuckyWheelSettings(data?.settings),
        lastResult: data?.lastResult ?? null,
      };
      setStatus({ loading: false, error: null, data: normalized });
      if (data.lastResult && !options?.suppressLastResult) {
        setResult(data.lastResult);
        setActivePrizeId(data.lastResult.prize.id);
        setMessageVisible(true);
      }
      if (!data.lastResult && !options?.suppressLastResult) {
        setResult(null);
        setActivePrizeId(null);
        setMessageVisible(false);
      }
    } catch (error: any) {
      setStatus({ loading: false, error: error?.message || "Não foi possível carregar a roleta.", data: null });
    }
  }

  async function handleSpin() {
    if (!status.data || spinDisabled) return;
    clearPendingTimeouts();
    setIsSpinning(true);
    setActivePrizeId(null);
    setMessageVisible(false);
    const soundSettings = status.data.settings.design.sound;
    const soundEnabled = soundSettings?.enabled !== false;
    if (soundEnabled) {
      playSound(soundSettings?.spin, "spin");
    }
    try {
      const response = await storefrontApi.spinLuckyWheel({
        cartId: cartId ?? undefined,
        sessionToken: sessionToken ?? undefined,
      });
      const outcome = response.result;
      setRotation((prev) => prev + outcome.rotationDegrees);
      setStatus((prev) => {
        if (!prev.data) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            alreadyPlayed: true,
            lastResult: outcome,
          },
        };
      });
      const settleTimeout = window.setTimeout(() => {
        setIsSpinning(false);
        setResult(outcome);
        setActivePrizeId(outcome.prize.id);
        const isWin = Boolean(outcome.freeShipping || outcome.freeOrder || outcome.couponCode);
        if (soundEnabled) {
          const winSound = soundSettings?.win || soundSettings?.spin;
          const loseSound = soundSettings?.lose || soundSettings?.win;
          playSound(isWin ? winSound : loseSound, isWin ? "win" : "lose");
        }
        const revealTimeout = window.setTimeout(() => {
          setMessageVisible(true);
          fetchState({ suppressLastResult: true }).catch((err) => {
            console.warn("[lucky-wheel] falha ao atualizar estado após o giro", err);
          });
        }, RESULT_REVEAL_DELAY_MS);
        timeouts.current.push(revealTimeout);
        if (outcome.couponCode && onApplyCoupon) {
          onApplyCoupon(outcome.couponCode).catch((applyError) => {
            console.warn("[lucky-wheel] falha ao aplicar cupom automaticamente", applyError);
          });
        }
      }, SPIN_DURATION_MS);
      timeouts.current.push(settleTimeout);
    } catch (error: any) {
      setIsSpinning(false);
      setStatus((prev) => ({ ...prev, error: error?.message || "Não foi possível girar a roleta." }));
      if (error?.error === "already_played") {
        fetchState();
      }
    }
  }

  function playSound(url?: string | null, fallback?: FallbackSoundType) {
    if (url) {
      try {
        if (!audioCache.current[url]) {
          audioCache.current[url] = new Audio(url);
        }
        audioCache.current[url].currentTime = 0;
        void audioCache.current[url].play().catch(() => {
          if (fallback) {
            playFallbackSound(fallback, audioContextRef);
          }
        });
        return;
      } catch {
        // usa fallback
      }
    }
    if (fallback) {
      playFallbackSound(fallback, audioContextRef);
    }
  }

  function closeOverlay() {
    setIsOpen(false);
    setDismissed(true);
    clearPendingTimeouts();
    scrollToCartProducts();
  }

  if (!status.data || !isOpen || !isMobileViewport || (status.data.alreadyPlayed && !lastKnownResult)) {
    return null;
  }

  const { settings } = status.data;
  const design = settings.design ?? {};
  const disabledMessage =
    status.data.blockedReason && !lastKnownResult ? resolveBlockedCopy(status.data.blockedReason, settings) : null;
  const overlayOpacityBase = design.overlayOpacity ?? 0.9;
  const overlayOpacity = isCompactLayout ? Math.min(overlayOpacityBase, 0.6) : overlayOpacityBase;
  const overlayBlurBase = design.blurRadius ?? 18;
  const overlayBlur = isCompactLayout ? Math.max(8, overlayBlurBase * 0.75) : overlayBlurBase;
  const overlayBackground = withAlpha(design.overlayColor ?? "rgba(4,6,20,0.92)", overlayOpacity);
  const overlayStyle: CSSProperties = {
    backgroundColor: overlayBackground,
    backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 45%), linear-gradient(135deg, rgba(224,235,255,${overlayOpacity}), rgba(220,210,255,${overlayOpacity}), rgba(255,231,250,${overlayOpacity}))`,
    backdropFilter: `blur(${overlayBlur}px)`,
  };
  const cardStyle: CSSProperties = {
    fontFamily: design.fontFamily || DEFAULT_FONT_FAMILY,
    border: "1px solid rgba(255,255,255,0.55)",
    background: "linear-gradient(145deg, rgba(255,255,255,0.92), rgba(245,244,255,0.96), rgba(249,243,255,0.98))",
    boxShadow: "0 55px 120px -60px rgba(143,123,255,0.65)",
    width: isCompactLayout ? "min(78vw, 520px)" : "min(72vw, 760px)",
    padding: isCompactLayout ? "1rem" : "2rem",
    gap: isCompactLayout ? "1.5rem" : "1.75rem",
  };
  const highlightColor = design.highlightColor ?? "#f8c6ff";
  const wheelGlowColor = design.wheelGlowColor ?? "#bfe6ff";
  const pointerColor = design.pointerColor ?? "#f8d57e";
  const buttonColor = design.buttonColor ?? "linear-gradient(120deg, #39e3c3, #7d7bff 45%, #c596ff)";
  const buttonTextColor = design.buttonTextColor ?? "#ffffff";
  const buttonShadow = design.buttonShadow ?? "0 25px 90px -40px rgba(103,118,255,0.85)";
  const wheelBorderColor = withAlpha(design.borderColor ?? "#c1e9ff", 0.85);
  const wheelStyles: CSSProperties = {
    backgroundColor: design.wheelBackground ?? "#ffffff",
    backgroundImage: `${gradient}, radial-gradient(circle at 50% 55%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.42) 52%, rgba(225,222,255,0.22) 100%)`,
    backgroundBlendMode: "normal",
    borderColor: wheelBorderColor,
    boxShadow: `${design.wheelShadow ?? "0 42px 120px rgba(82,129,255,0.3)"}, inset 0 30px 55px rgba(255,255,255,0.42), inset 0 -22px 40px rgba(139,162,255,0.18)`,
  };
  const buttonStyles: CSSProperties | undefined = spinDisabled
    ? undefined
    : {
        background: buttonColor,
        color: buttonTextColor,
        boxShadow: buttonShadow,
      };
  const ctaLabel = settings.ctaLabel?.trim() || "Experiência exclusiva Dermosul";
  const headline = settings.headline?.trim() || "✨ Roleta da Sorte Dermosul";
  const normalizedSubheadline = settings.subheadline?.trim() || "";
  const legacySubheadline = "Mimos leves pra sua rotina real.";
  const subheadlineCopy =
    !normalizedSubheadline || normalizedSubheadline === legacySubheadline ? "Um mimo pra você" : normalizedSubheadline;
  const descriptionCopy =
    settings.description?.trim() || "Prêmios de frete grátis, cupons até 30% e surpresas reluzentes para elevar seu ritual de autocuidado.";
  const alreadyPlayedMessage = settings.messages?.alreadyPlayed?.trim() || "Você já participou hoje, volte amanhã para mais sorte!";
  const buttonLabel = settings.buttonLabel?.trim() || "GIRAR AGORA";
  const resultCopy = result && messageVisible ? result.message || `🎉 Parabéns! Você desbloqueou ${result.prize.label}!` : null;
  const defaultPrompt = "Gire agora e sinta a alegria de destravar um mimo escolhido só pra você.";
  const infoCopy = disabledMessage ?? resultCopy ?? (status.data.alreadyPlayed ? alreadyPlayedMessage : defaultPrompt);
  const infoTone: InfoTone = disabledMessage ? "warning" : resultCopy ? "success" : status.data.alreadyPlayed ? "info" : "neutral";
  const infoToneMap: Record<InfoTone, string> = {
    warning: "border-amber-300/80 bg-amber-50 text-amber-700",
    success: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    info: "border-violet-200/70 bg-violet-50 text-violet-700",
    neutral: "border-slate-200/70 bg-white/80 text-slate-600",
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6 md:px-6 md:py-10" style={overlayStyle}>
      <div className="absolute inset-0" onClick={closeOverlay} />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {auroraParticles.map((particle, index) => (
          <span
            key={`particle-${index}`}
            className="lucky-wheel-particle"
            style={{
              top: particle.top,
              left: particle.left,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              background: particle.color,
              boxShadow: `0 0 55px ${particle.glow}`,
            }}
          />
        ))}
      </div>
      <div
        className={`relative z-10 flex w-full max-w-4xl flex-col overflow-visible rounded-[48px] text-[#1e2040] shadow-[0_45px_160px_-70px_rgba(106,95,255,0.8)] ${isCompactLayout ? "gap-8" : "gap-10"} ${isCompactLayout ? "p-6 pt-12" : "p-8 md:flex-row md:p-12"}`}
        style={cardStyle}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[48px] bg-[radial-gradient(120%_120%_at_50%_0%,rgba(255,255,255,0.7),transparent_70%),radial-gradient(120%_150%_at_50%_100%,rgba(166,194,255,0.35),transparent)]" />
        <button
          type="button"
          onClick={closeOverlay}
          aria-label="Fechar"
          className={`absolute z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/80 text-lg font-semibold text-[#1d1b3f] transition hover:border-[#d5ccff] hover:bg-white ${isCompactLayout ? "right-3 top-3" : "right-5 top-5"}`}
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="relative z-10 flex flex-1 flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.45em] text-[#7f6bff] shadow-sm">
            {ctaLabel}
          </span>
          <h2 className="text-4xl font-semibold text-[#1c1b3a] md:text-[44px]">{headline}</h2>
          <p className="text-lg text-[#514c7c]">{subheadlineCopy}</p>
          <p className="text-sm leading-relaxed text-[#5c577f]">{descriptionCopy}</p>

          <div className="mt-5 flex flex-wrap gap-2 text-[11px] text-[#4a437a]">
            {status.data.alreadyPlayed ? <Badge tone="violet">Já participou</Badge> : <Badge tone="teal">Primeira chance</Badge>}
            {disabledMessage && <Badge tone="amber">Limite ativo</Badge>}
            {result?.freeShipping && <Badge tone="teal">Frete grátis</Badge>}
            {result?.freeOrder && <Badge tone="pink">Pedido 100% nosso</Badge>}
          </div>

          <div className="mt-auto space-y-4 text-center">
            <p className={`rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-[0_25px_45px_-30px_rgba(101,92,255,0.55)] ${infoToneMap[infoTone]}`}>
              {infoCopy}
            </p>

            <button
              type="button"
              onClick={handleSpin}
              disabled={spinDisabled}
              className={`mx-auto inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.4em] transition ${
                spinDisabled ? "cursor-not-allowed bg-slate-200 text-slate-400" : "lucky-wheel-cta hover:brightness-[1.05]"
              }`}
              style={buttonStyles}
            >
              {isSpinning ? "Girando..." : buttonLabel}
            </button>
            {status.data.alreadyPlayed && !resultCopy && !disabledMessage && (
              <p className="text-xs text-[#8177b2]">Você já participou hoje, volte amanhã para mais sorte!</p>
            )}
          </div>
        </div>

        <div className="relative z-10 mx-auto flex flex-none items-center justify-center" style={wheelContainerStyle}>
          <div className="absolute left-1/2 top-1/2" style={wheelTransformStyle}>
            <div className="relative flex h-[360px] w-[360px] items-center justify-center md:h-[420px] md:w-[420px]">
              <div className="pointer-events-none absolute inset-[-58px] rounded-full bg-[radial-gradient(circle_at_50%_22%,rgba(255,255,255,0.6),transparent_75%)] blur-[1px]" />
              <div className="pointer-events-none absolute inset-[-48px] rounded-full bg-[radial-gradient(circle,rgba(201,220,255,0.75),rgba(167,182,255,0.85))] shadow-[0_70px_140px_-45px_rgba(131,146,255,0.55)]" />
              <div className="pointer-events-none absolute inset-[-44px] rounded-full border-[8px] border-[#fbe8ff]" />
              <div className="pointer-events-none absolute inset-[-34px] rounded-full border-[14px] border-[#cbd9ff] bg-[#f7f1ff]/60 shadow-[inset_0_18px_45px_rgba(255,255,255,0.6)]" />
              <div className="absolute inset-[-28px] rounded-full bg-transparent">
                {lights.map((light) => (
                  <WheelLight key={light.id} angle={light.angle} radius={light.radius} glowColor={wheelGlowColor} tone={light.tone} />
                ))}
              </div>

              <div
                className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[14px] transition-transform duration-[7200ms]"
                style={{ ...wheelStyles, transform: `rotate(${rotation}deg)`, transitionTimingFunction: easing }}
              >
                {labels.map((slice) => (
                  <WheelLabel key={slice.id} slice={slice} isActive={activePrizeId === slice.id} highlightColor={highlightColor} />
                ))}
                {pins.map((pin) => (
                  <WheelPin key={pin.id} angle={pin.angle} radius={pin.radius} color={pin.color} />
                ))}

                <div className="pointer-events-none absolute inset-[18%] rounded-full border-[12px] border-[#7feeff] bg-[radial-gradient(circle_at_45%_30%,rgba(255,255,255,0.82),rgba(0,194,238,0.55))] shadow-[inset_0_30px_45px_rgba(255,255,255,0.5)]" />
                <div
                  className="absolute inset-[28%] flex items-center justify-center rounded-full border-[10px] border-[#009cd3] bg-[radial-gradient(circle,#ffe873,#ffb533)] shadow-[inset_0_14px_0_rgba(255,255,255,0.6),0_24px_32px_rgba(255,189,80,0.5)]"
                  style={{ fontFamily: design.fontFamily || DEFAULT_FONT_FAMILY }}
                >
                  {settings.design.logoUrl ? (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-[5px] border-[#00a0d2] bg-[radial-gradient(circle,#70e5ff,#00add6)] shadow-[inset_0_8px_12px_rgba(255,255,255,0.45)]">
                      <img src={settings.design.logoUrl} alt="Marca Dermosul" className="h-14 w-14 rounded-full object-contain" loading="lazy" />
                    </div>
                  ) : (
                    <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full border-[6px] border-[#00a0d2] bg-[radial-gradient(circle,#70e5ff,#00add6)] shadow-[inset_0_12px_16px_rgba(255,255,255,0.45)]">
                      <span className="block h-[54px] w-[54px] rounded-full bg-[radial-gradient(circle,#ffe76c,#ffb32a)] shadow-[0_0_20px_rgba(255,209,102,0.75)]" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-none absolute -top-[78px] flex flex-col items-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full border-[5px]"
                  style={{
                    borderColor: withAlpha(pointerColor, 0.25),
                    background: `radial-gradient(circle at 35% 30%, ${mixWithWhite(pointerColor, 0.55)}, ${pointerColor})`,
                    boxShadow: `0 24px 44px ${withAlpha(pointerColor, 0.35)}`,
                  }}
                >
                  <span className="block h-6 w-6 rounded-full bg-[radial-gradient(circle,#ffe977,#ffb433)] shadow-[0_0_18px_rgba(255,205,90,0.8)]" />
                </div>
                <div
                  className="relative mt-[-6px] flex h-[90px] w-[64px] items-center justify-center rounded-b-[46px] border border-white/60"
                  style={{
                    background: `linear-gradient(180deg, ${mixWithWhite(pointerColor, 0.3)} 0%, ${withAlpha(pointerColor, 0.95)} 80%, ${withAlpha(pointerColor, 0.8)} 100%)`,
                    clipPath: "polygon(50% 0%, 100% 60%, 84% 100%, 16% 100%, 0% 60%)",
                    boxShadow: `0 32px 62px ${withAlpha(pointerColor, 0.35)}`,
                    borderColor: withAlpha(pointerColor, 0.35),
                  }}
                >
                  <span className="block h-7 w-7 rounded-full bg-[radial-gradient(circle,#ffe973,#ffb12d)] shadow-[0_0_20px_rgba(255,203,96,0.75)]" />
                </div>
              </div>

              <div className="pointer-events-none absolute bottom-[-120px] hidden w-[260px] justify-center md:flex">
                <div className="h-[140px] w-full rounded-[140px] bg-[radial-gradient(circle_at_50%_-10%,rgba(0,220,255,0.85),rgba(5,116,178,0.96)_72%)] shadow-[0_80px_160px_-50px_rgba(0,136,208,0.65)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildConicGradient(prizes: LuckyWheelPrize[]): string {
  if (!prizes.length) {
    return "conic-gradient(#00b5e9, #ff9f1b, #00a7ff, #ff4f86, #80d63d, #ffda42, #0091ff, #ff6b39)";
  }
  const angle = 360 / prizes.length;
  let start = 0;
  const segments = prizes.map((prize, index) => {
    const end = start + angle;
    const color = prize.sliceColor || DEFAULT_SLICE_COLORS[index % DEFAULT_SLICE_COLORS.length];
    const segment = `${color} ${start}deg ${end}deg`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function computeSegmentLabels(prizes: LuckyWheelPrize[]): WheelSegment[] {
  const count = prizes.length || 1;
  const sweep = 360 / count;
  return prizes.map((prize, index) => ({
    id: prize.id,
    label: prize.label,
    textColor: prize.textColor || "#ffffff",
    rotation: index * sweep + sweep / 2,
    icon: prize.icon ? ICON_MAP[prize.icon] ?? prize.icon : null,
    sweep,
    backgroundColor: prize.sliceColor || DEFAULT_SLICE_COLORS[index % DEFAULT_SLICE_COLORS.length],
  }));
}

function resolveBlockedCopy(reason: string, settings: LuckyWheelSettings) {
  switch (reason) {
    case "limit_daily":
      return "Os brindes de hoje já acabaram, mas amanhã tem mais carinho esperando por você.";
    case "limit_monthly":
      return "Fechamos o ciclo de mimos deste mês. Já já liberamos novas surpresas pra você.";
    default:
      return settings.messages.blocked ?? "Respira fundo e volta daqui a pouco. A próxima rodada pode ser sua.";
  }
}

type BadgeTone = "violet" | "teal" | "amber" | "pink";

const BADGE_PALETTE: Record<BadgeTone, string> = {
  violet: "border-[#b6a5ff] bg-[#f1edff] text-[#5c4aa0]",
  teal: "border-[#8de5d6] bg-[#ecfffa] text-[#2a7a6b]",
  amber: "border-[#ffd9a1] bg-[#fff9f0] text-[#8b5a1f]",
  pink: "border-[#ffc4eb] bg-[#fff1fb] text-[#a03d88]",
};

function Badge({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.45em] ${BADGE_PALETTE[tone]}`}>{children}</span>;
}

function WheelLabel({ slice, isActive, highlightColor }: { slice: WheelSegment; isActive: boolean; highlightColor: string }) {
  const label = slice.label || "Prêmio Dermosul";
  const glow = withAlpha(isActive ? highlightColor : "#ffffff", isActive ? 0.85 : 0.45);
  const thetaRad = (slice.sweep * Math.PI) / 180;
  const arcLength = thetaRad * (LABEL_RADIUS - 18);
  const capsuleSize = Math.max(86, Math.min(212, arcLength * 1.08));
  const variant = normalizePrizeLabel(label);

  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        transform: `translate(-50%, -50%) rotate(${slice.rotation}deg)`,
      }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          transform: `translateY(-${LABEL_RADIUS}px)`,
        }}
      >
        <span
          className="mb-1 block h-[10px] w-[10px] rounded-full border border-white/70 bg-white"
          style={{
            boxShadow: `0 0 ${isActive ? 22 : 14}px ${glow}`,
          }}
        />
        <div className="relative flex items-center justify-center" style={{ width: capsuleSize, height: capsuleSize * 0.9 }}>
          <PrizeGlyph variant={variant} accent={slice.backgroundColor} isActive={isActive} />
          <span className="sr-only">{label}</span>
        </div>
      </div>
    </div>
  );
}

function WheelPin({ angle, radius, color }: { angle: number; radius: number; color: string }) {
  return (
    <span
      className="pointer-events-none absolute h-4 w-4 rounded-full"
      style={{
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -${radius}px)`,
        background: `radial-gradient(circle, ${mixWithWhite(color, 0.6)}, ${color})`,
        boxShadow: `0 0 16px ${withAlpha(color, 0.65)}`,
        border: `1px solid ${withAlpha(color, 0.65)}`,
      }}
    />
  );
}

function WheelLight({ angle, radius, glowColor, tone }: { angle: number; radius: number; glowColor: string; tone: "primary" | "secondary" }) {
  const glow = withAlpha(glowColor, tone === "primary" ? 0.95 : 0.7);
  const innerGradient =
    tone === "primary"
      ? "radial-gradient(circle,#a6ffff 0%,#4fe6ff 55%,#16b9ff 100%)"
      : "radial-gradient(circle,#f7fbff 0%,#cdefff 60%,#7ddfff 100%)";
  const borderColor = tone === "primary" ? "rgba(255,255,255,0.85)" : "rgba(180,242,255,0.9)";
  return (
    <span
      className="absolute flex h-6 w-6 items-center justify-center rounded-full transition-opacity duration-700"
      style={{
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -${radius}px)`,
        background: innerGradient,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 ${tone === "primary" ? 26 : 16}px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.65)`,
      }}
    >
      <span
        className="block h-3 w-3 rounded-full"
        style={{
          background: innerGradient,
          boxShadow: `0 0 12px ${withAlpha(glowColor, tone === "primary" ? 0.95 : 0.75)}`,
        }}
      />
    </span>
  );
}

function withAlpha(color: string, alpha: number): string {
  if (Number.isNaN(alpha)) return color;
  const normalizedAlpha = Math.min(1, Math.max(0, alpha));
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${normalizedAlpha})`;
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
  }
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].some((value) => Number.isNaN(value))) return null;
    return { r, g, b };
  }
  return null;
}

function mixWithWhite(color: string, amount = 0.5): string {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color;
  const weight = Math.min(Math.max(amount, 0), 1);
  const r = Math.round(rgb.r + (255 - rgb.r) * weight);
  const g = Math.round(rgb.g + (255 - rgb.g) * weight);
  const b = Math.round(rgb.b + (255 - rgb.b) * weight);
  return `rgb(${r}, ${g}, ${b})`;
}

type PrizeGlyphVariant = "percent10" | "percent20" | "percent30" | "freeShipping" | "free100" | "retry" | "default";

function normalizePrizeLabel(label: string): PrizeGlyphVariant {
  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (normalized.includes("tente") || normalized.includes("novamente")) return "retry";
  if (normalized.includes("100")) return "free100";
  if (normalized.includes("frete")) return "freeShipping";
  if (normalized.includes("30")) return "percent30";
  if (normalized.includes("20")) return "percent20";
  if (normalized.includes("10")) return "percent10";
  return "default";
}

function PrizeGlyph({ variant, accent, isActive }: { variant: PrizeGlyphVariant; accent: string; isActive: boolean }) {
  switch (variant) {
    case "percent10":
      return <PercentChip percent="10" accent={accent} isActive={isActive} />;
    case "percent20":
      return <PercentChip percent="20" accent={accent} isActive={isActive} />;
    case "percent30":
      return <PercentChip percent="30" accent={accent} isActive={isActive} />;
    case "freeShipping":
      return <ShippingChip accent={accent} isActive={isActive} />;
    case "free100":
      return <FullGiftChip accent={accent} isActive={isActive} />;
    case "retry":
      return <RetryChip accent={accent} isActive={isActive} />;
    default:
      return <DefaultChip accent={accent} isActive={isActive} />;
  }
}

function PercentChip({ percent, accent, isActive }: { percent: string; accent: string; isActive: boolean }) {
  const accentGlow = withAlpha(accent, isActive ? 0.75 : 0.45);
  return (
    <span
      className="relative flex h-[90px] w-[90px] items-center justify-center rounded-[26px]"
      style={{
        background: `linear-gradient(135deg, ${mixWithWhite(accent, 0.25)} 0%, ${mixWithWhite(accent, 0.6)} 50%, ${mixWithWhite(accent, 0.1)} 100%)`,
        boxShadow: `0 25px 45px -28px ${accentGlow}, inset 0 4px 12px rgba(255,255,255,0.45)`,
        border: `3px solid ${withAlpha(accent, 0.55)}`,
      }}
    >
      <span
        className="absolute inset-[10%] rounded-[22px]"
        style={{
          background: `linear-gradient(160deg, rgba(255,255,255,0.85), ${mixWithWhite(accent, 0.5)})`,
          border: `1.5px solid ${withAlpha(accent, 0.38)}`,
        }}
      />
      <span
        className="relative flex h-[64px] w-[64px] flex-col items-center justify-center rounded-full text-[26px] font-black text-slate-900"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), ${mixWithWhite(accent, 0.4)})`,
          boxShadow: `0 16px 35px -22px ${accentGlow}, inset 0 6px 12px rgba(255,255,255,0.7)`,
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ fontSize: "12px", letterSpacing: "0.3em" }}>OFF</span>
        <span style={{ lineHeight: 1 }}>{percent}%</span>
      </span>
    </span>
  );
}

function ShippingChip({ accent, isActive }: { accent: string; isActive: boolean }) {
  const glow = withAlpha(accent, isActive ? 0.65 : 0.38);
  return (
    <span
      className="relative flex h-[92px] w-[92px] items-center justify-center rounded-[30px]"
      style={{
        background: `linear-gradient(145deg, ${mixWithWhite("#0ec6ff", 0.1)}, ${mixWithWhite(accent, 0.3)})`,
        border: "3px solid rgba(255,255,255,0.75)",
        boxShadow: `0 25px 45px -24px ${glow}`,
      }}
    >
      <span
        className="absolute inset-[12%] rounded-[26px]"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(200,247,255,0.85))",
          border: "1.5px solid rgba(0,176,220,0.25)",
        }}
      />
      <svg width="58" height="58" viewBox="0 0 58 58" className="relative">
        <defs>
          <linearGradient id="truck-body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00c6ff" />
            <stop offset="100%" stopColor="#0095ff" />
          </linearGradient>
          <linearGradient id="truck-cabin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd85f" />
            <stop offset="100%" stopColor="#ffa63b" />
          </linearGradient>
        </defs>
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <rect x="6" y="19" width="26" height="20" rx="6" fill="url(#truck-body)" stroke="#006ea8" strokeWidth="2.2" />
          <path d="M32 24h9l7 9v6H32z" fill="url(#truck-cabin)" stroke="#c56a07" strokeWidth="2.2" />
          <circle cx="17" cy="45" r="6.5" fill="#14223b" stroke="#1dd2ff" strokeWidth="2" />
          <circle cx="17" cy="45" r="3.2" fill="#ffffff" />
          <circle cx="39" cy="45" r="6.5" fill="#14223b" stroke="#ffc76b" strokeWidth="2" />
          <circle cx="39" cy="45" r="3.2" fill="#ffffff" />
          <path d="M9 26h12M9 32h12" stroke="#ffffff" strokeWidth="2" />
        </g>
        <text x="29" y="17" textAnchor="middle" fill="#046086" fontWeight="700" fontSize="12">
          FRETE
        </text>
        <text x="29" y="54" textAnchor="middle" fill="#046086" fontWeight="700" fontSize="11">
          GRÁTIS
        </text>
      </svg>
    </span>
  );
}

function FullGiftChip({ accent, isActive }: { accent: string; isActive: boolean }) {
  const glow = withAlpha(accent, isActive ? 0.75 : 0.4);
  return (
    <span
      className="relative flex h-[94px] w-[94px] items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle at 40% 30%, ${mixWithWhite("#ffe978", 0.1)}, ${mixWithWhite(accent, 0.5)})`,
        border: "3px solid rgba(255,255,255,0.65)",
        boxShadow: `0 30px 50px -28px ${glow}, inset 0 6px 12px rgba(255,255,255,0.65)`,
      }}
    >
      <svg width="70" height="70" viewBox="0 0 70 70">
        <defs>
          <linearGradient id="gift-box" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe066" />
            <stop offset="100%" stopColor="#ff9f1b" />
          </linearGradient>
        </defs>
        <rect x="10" y="24" width="50" height="32" rx="8" fill="url(#gift-box)" stroke="#f18000" strokeWidth="2.2" />
        <rect x="14" y="14" width="42" height="14" rx="7" fill="#fff6cf" stroke="#f9c94a" strokeWidth="2" />
        <path d="M35 14v42" stroke="#ff7b0d" strokeWidth="5" strokeLinecap="round" />
        <path d="M35 20c-2-8-10-10-14-5-3 4 1 10 8 9" stroke="#ff7b0d" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M35 20c2-8 10-10 14-5 3 4-1 10-8 9" stroke="#ff7b0d" strokeWidth="4" fill="none" strokeLinecap="round" />
        <text x="35" y="44" textAnchor="middle" fontWeight="900" fontSize="12" fill="#8b3c00">
          100%
        </text>
        <text x="35" y="55" textAnchor="middle" fontWeight="700" fontSize="10" fill="#8b3c00">
          GRÁTIS
        </text>
      </svg>
    </span>
  );
}

function RetryChip({ accent, isActive }: { accent: string; isActive: boolean }) {
  const glow = withAlpha(accent, isActive ? 0.65 : 0.35);
  return (
    <span
      className="relative flex h-[88px] w-[88px] items-center justify-center rounded-[32px]"
      style={{
        background: `linear-gradient(145deg, ${mixWithWhite("#ff6ec7", 0.1)}, ${mixWithWhite(accent, 0.3)})`,
        border: "3px solid rgba(255,255,255,0.7)",
        boxShadow: `0 28px 48px -28px ${glow}`,
      }}
    >
      <span
        className="absolute inset-[12%] rounded-[26px]"
        style={{
          background: "linear-gradient(150deg, rgba(255,255,255,0.92), rgba(255,198,230,0.85))",
          border: "1.6px solid rgba(255,140,214,0.35)",
        }}
      />
      <svg width="62" height="62" viewBox="0 0 62 62" className="relative">
        <circle cx="31" cy="31" r="22" fill="none" stroke="#ff6ec7" strokeWidth="4.2" strokeDasharray="110" strokeDashoffset="18" />
        <path d="M44 25v-9l-8 3" fill="none" stroke="#ff6ec7" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="31" y="40" textAnchor="middle" fontSize="11" fontWeight="800" fill="#a12c74">
          TENTE
        </text>
        <text x="31" y="51" textAnchor="middle" fontSize="11" fontWeight="800" fill="#a12c74">
          DE NOVO
        </text>
      </svg>
    </span>
  );
}

function DefaultChip({ accent, isActive }: { accent: string; isActive: boolean }) {
  const glow = withAlpha(accent, isActive ? 0.6 : 0.35);
  return (
    <span
      className="flex h-[88px] w-[88px] items-center justify-center rounded-[30px] text-center text-xs font-semibold uppercase tracking-[0.32em] text-slate-900"
      style={{
        background: `linear-gradient(135deg, ${mixWithWhite(accent, 0.15)}, ${mixWithWhite(accent, 0.5)})`,
        border: `3px solid ${withAlpha(accent, 0.55)}`,
        boxShadow: `0 24px 44px -24px ${glow}, inset 0 6px 12px rgba(255,255,255,0.6)`,
        padding: "12px",
      }}
    >
      Presente
    </span>
  );
}

type FallbackSoundType = "spin" | "win" | "lose";

const FALLBACK_SOUND_LAYERS: Record<FallbackSoundType, Array<{ type: OscillatorType; frequency: number; start: number; duration: number; gain: number }>> = {
  spin: [
    { type: "sine", frequency: 420, start: 0, duration: 0.25, gain: 0.22 },
    { type: "triangle", frequency: 680, start: 0.18, duration: 0.24, gain: 0.18 },
    { type: "sawtooth", frequency: 920, start: 0.32, duration: 0.32, gain: 0.16 },
    { type: "triangle", frequency: 1150, start: 0.52, duration: 0.35, gain: 0.14 },
  ],
  win: [
    { type: "triangle", frequency: 660, start: 0, duration: 0.35, gain: 0.22 },
    { type: "triangle", frequency: 990, start: 0.12, duration: 0.32, gain: 0.22 },
    { type: "triangle", frequency: 1320, start: 0.2, duration: 0.4, gain: 0.18 },
    { type: "sine", frequency: 1760, start: 0.35, duration: 0.5, gain: 0.14 },
  ],
  lose: [
    { type: "sine", frequency: 520, start: 0, duration: 0.3, gain: 0.2 },
    { type: "sine", frequency: 360, start: 0.2, duration: 0.3, gain: 0.18 },
    { type: "sine", frequency: 240, start: 0.38, duration: 0.35, gain: 0.16 },
    { type: "triangle", frequency: 160, start: 0.56, duration: 0.4, gain: 0.12 },
  ],
};

function getAudioContext(ref: MutableRefObject<AudioContext | null>): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!ref.current) {
    ref.current = new AudioContextConstructor();
  }
  return ref.current;
}

function playFallbackSound(type: FallbackSoundType, ref: MutableRefObject<AudioContext | null>) {
  const context = getAudioContext(ref);
  if (!context) return;
  void context.resume().catch(() => {});
  const now = context.currentTime;
  const masterGain = context.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.45, now + 0.02);
  masterGain.gain.linearRampToValueAtTime(0.0001, now + 1.1);
  masterGain.connect(context.destination);

  const layers = FALLBACK_SOUND_LAYERS[type];
  layers.forEach((layer) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = layer.type;
    osc.frequency.setValueAtTime(layer.frequency, now + layer.start);
    gain.gain.setValueAtTime(0.0001, now + layer.start);
    gain.gain.exponentialRampToValueAtTime(layer.gain, now + layer.start + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, now + layer.start + layer.duration);
    osc.connect(gain).connect(masterGain);
    osc.start(now + layer.start);
    osc.stop(now + layer.start + layer.duration + 0.08);
  });
}

function scrollToCartProducts() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const anchor = document.querySelector('[data-section-id="cart-products"]');
  if (!anchor) return;
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const rect = anchor.getBoundingClientRect();
  const top = rect.top + window.scrollY - 72;
  window.scrollTo({
    top: Math.max(top, 0),
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
}
