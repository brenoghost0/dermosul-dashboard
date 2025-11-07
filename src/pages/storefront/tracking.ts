import { storefrontApi, type StorefrontEventPayload } from "./api";

const SESSION_STORAGE_KEY = "dermosul_storefront_session";
let cachedSessionId: string | null = null;
const eventQueue: StorefrontEventPayload[] = [];
let flushTimer: number | null = null;
let flushing = false;

function nanoid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function getSessionId(): string {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof window === "undefined") {
    cachedSessionId = nanoid();
    return cachedSessionId;
  }

  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }
  } catch (err) {
    console.warn("[tracking] Falha ao ler sessionId", err);
  }

  const generated = nanoid();
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  } catch (err) {
    console.warn("[tracking] Falha ao persistir sessionId", err);
  }
  cachedSessionId = generated;
  return generated;
}

function scheduleFlush() {
  if (typeof window === "undefined") return;
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(flushQueue, 150);
}

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    while (eventQueue.length > 0) {
      const payload = eventQueue.shift();
      if (!payload) continue;
      try {
        await storefrontApi.trackEvent(payload);
      } catch (err) {
        console.warn("[tracking] Falha ao enviar evento", err);
      }
    }
  } finally {
    flushing = false;
    if (flushTimer !== null) {
      if (typeof window !== "undefined") {
        window.clearTimeout(flushTimer);
      }
      flushTimer = null;
    }
  }
}

export function trackStorefrontEvent(
  event: Omit<StorefrontEventPayload, "sessionId"> & { sessionId?: string }
) {
  const sessionId = event.sessionId || getSessionId();
  const payload: StorefrontEventPayload = {
    ...event,
    sessionId,
  };
  if (typeof window === "undefined") {
    storefrontApi.trackEvent(payload).catch((err) => {
      console.warn("[tracking] Falha ao enviar evento (ssr)", err);
    });
    return;
  }
  eventQueue.push(payload);
  scheduleFlush();
}
