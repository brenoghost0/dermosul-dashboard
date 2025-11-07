import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { StorefrontProvider } from "./StorefrontContext";
import { CartProvider, useCart } from "./CartContext";
import { ChatWidget } from "./components/ChatWidget";
import { AddToCartFlyout } from "./components/AddToCartFlyout";
import { ProductLikesProvider } from "./ProductLikesContext";

const ABANDONMENT_TIMEOUT = 2 * 60 * 1000; // 2 minutos

function CartAbandonmentWatcher() {
  const { cart, markAbandoned, touch } = useCart();

  useEffect(() => {
    if (!cart || cart.items.length === 0) return;

    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAbandonment = () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(() => {
        markAbandoned();
      }, ABANDONMENT_TIMEOUT);
    };

    const clearSchedule = () => {
      if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        scheduleAbandonment();
      } else {
        clearSchedule();
        touch();
      }
    };

    const handleBeforeUnload = () => {
      markAbandoned();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearSchedule();
    };
  }, [cart, markAbandoned, touch]);

  return null;
}

function CartResumeBanner() {
  const { resumePrompt, dismissResumePrompt, touch } = useCart();
  const navigate = useNavigate();

  if (!resumePrompt || resumePrompt.items.length === 0) {
    return null;
  }

  const firstItem = resumePrompt.items[0];
  const othersCount = resumePrompt.items.length - 1;
  const description = othersCount > 0 ? `${firstItem.name} e mais ${othersCount} item${othersCount > 1 ? 's' : ''}` : firstItem.name;

  function handleResume() {
    touch();
    dismissResumePrompt();
    navigate("/carrinho");
  }

  function handleDismiss() {
    dismissResumePrompt();
  }

  return (
    <div className="bg-violet-700 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Retome seu cuidado Dermosul</p>
          <p className="text-xs text-violet-50">Você ainda tem {description} esperando por aqui.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleResume}
            className="inline-flex items-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            Continuar compra
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs text-violet-100 underline-offset-2 hover:underline"
          >
            Ver depois
          </button>
        </div>
      </div>
    </div>
  );
}

function handleSectionFocus(event: CustomEvent<{ target?: string }>) {
  const targetId = event.detail?.target;
  if (!targetId) return;
  setTimeout(() => {
    if (typeof document === "undefined") return;
    const element = document.querySelector(`[data-section-id="${targetId}"]`);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const offset = Math.max(top - 120, 0);
    window.scrollTo({ top: offset, behavior: "smooth" });
  }, 100);
}

export default function StorefrontShell() {
  useEffect(() => {
    const listener = (event: Event) => handleSectionFocus(event as CustomEvent<{ target?: string }>);
    window.addEventListener("dermosul:scroll-to", listener as EventListener);
    return () => {
      window.removeEventListener("dermosul:scroll-to", listener as EventListener);
    };
  }, []);

  return (
    <StorefrontProvider>
      <ProductLikesProvider>
        <CartProvider>
          <CartAbandonmentWatcher />
          <CartResumeBanner />
          <Outlet />
          <AddToCartFlyout />
          <ChatWidget />
        </CartProvider>
      </ProductLikesProvider>
    </StorefrontProvider>
  );
}
