// Widget flutuante do Assistente Dermosul, com histórico local e animação de resposta.
import { useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SuggestedProduct = {
  name: string;
  price: string;
  url?: string;
  image?: string | null;
};

const STORAGE_KEY = "dermosul_chat_history_v1";
const SESSION_KEY = "dermosul_chat_session";
const LAST_INTERACTION_KEY = "dermosul_chat_last_activity";
const INACTIVITY_LIMIT_MS = 3 * 60 * 1000;
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const URL_PREFIX = /^https?:\/\//i;
const LINK_LABEL = "clique aqui";

const createId = () =>
  typeof window !== "undefined" && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [partial, setPartial] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityCheckerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ensureSessionId = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!sessionIdRef.current) {
      const existing = sessionStorage.getItem(SESSION_KEY);
      if (existing) {
        sessionIdRef.current = existing;
      } else {
        const fresh = createId();
        sessionStorage.setItem(SESSION_KEY, fresh);
        sessionIdRef.current = fresh;
      }
    }
  }, []);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setPartial("");
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LAST_INTERACTION_KEY);
    } catch (error) {
      console.warn("[chat] falha ao limpar histórico", error);
    }
    sessionIdRef.current = null;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const registerInteraction = useCallback(() => {
    if (typeof window === "undefined") return;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      resetConversation();
    }, INACTIVITY_LIMIT_MS);
    try {
      localStorage.setItem(LAST_INTERACTION_KEY, Date.now().toString());
    } catch (error) {
      console.warn("[chat] falha ao salvar última atividade", error);
    }
  }, [resetConversation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("[chat] falha ao restaurar histórico", error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    ensureSessionId();
    try {
      const last = localStorage.getItem(LAST_INTERACTION_KEY);
      if (last) {
        const lastMs = Number(last);
        if (Number.isFinite(lastMs) && Date.now() - lastMs > INACTIVITY_LIMIT_MS) {
          resetConversation();
        }
      }
    } catch (error) {
      console.warn("[chat] falha ao verificar última atividade", error);
    }
  }, [ensureSessionId, resetConversation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const runCheck = () => {
      try {
        const last = localStorage.getItem(LAST_INTERACTION_KEY);
        if (!last) {
          if (messages.length) {
            localStorage.setItem(LAST_INTERACTION_KEY, Date.now().toString());
          }
          return;
        }
        const lastMs = Number(last);
        if (Number.isFinite(lastMs) && Date.now() - lastMs > INACTIVITY_LIMIT_MS) {
          resetConversation();
        }
      } catch (error) {
        console.warn("[chat] falha ao monitorar inatividade", error);
      }
    };

    runCheck();
    inactivityCheckerRef.current = setInterval(runCheck, 30 * 1000);

    return () => {
      if (inactivityCheckerRef.current) {
        clearInterval(inactivityCheckerRef.current);
        inactivityCheckerRef.current = null;
      }
    };
  }, [resetConversation, messages.length]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.warn("[chat] falha ao persistir histórico", error);
    }
  }, [messages, hydrated]);

  useEffect(() => {
    registerInteraction();
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [registerInteraction]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, partial, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      setOpen(true);
      registerInteraction();
      if (detail?.prompt) {
        setInput(detail.prompt);
      }
    };

    const handleToggle = () => {
      setOpen((prev) => !prev);
      registerInteraction();
    };

    window.addEventListener("dermosul:chat:open", handleOpen);
    window.addEventListener("dermosul:chat:toggle", handleToggle);
    if (typeof document !== "undefined") {
      document.addEventListener("dermosul:chat:open", handleOpen);
      document.addEventListener("dermosul:chat:toggle", handleToggle);
    }

    return () => {
      window.removeEventListener("dermosul:chat:open", handleOpen);
      window.removeEventListener("dermosul:chat:toggle", handleToggle);
      if (typeof document !== "undefined") {
        document.removeEventListener("dermosul:chat:open", handleOpen);
        document.removeEventListener("dermosul:chat:toggle", handleToggle);
      }
    };
  }, [registerInteraction]);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    ensureSessionId();
    registerInteraction();
    const userMessage: Message = { id: createId(), role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setPartial("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, sessionId: sessionIdRef.current }),
      });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const data: { reply: string; suggestedProducts?: SuggestedProduct[] } = await response.json();
      await animateAssistantReply(data.reply);
      if (data.suggestedProducts?.length) {
        const suggestionText = data.suggestedProducts
          .map((product) => {
            const parts = [product.name, product.price].filter(Boolean).join(" • ");
            return product.url ? `${parts} — ${product.url}` : parts;
          })
          .join("\n");
        pushAssistant(`Sugestões Dermosul:\n${suggestionText}`);
      }
    } catch (error) {
      console.error("[chat] falha ao enviar", error);
      pushAssistant("Desculpe, não consegui responder agora. Tente novamente em instantes ou fale com nossa equipe.");
    } finally {
      setLoading(false);
      setPartial("");
    }
  }

  async function animateAssistantReply(content: string) {
    const tokens = content.split(/(\s+)/);
    let current = "";
    for (const token of tokens) {
      current += token;
      setPartial(current);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (current.trim()) {
      pushAssistant(current.trim());
    }
    setPartial("");
  }

  function pushAssistant(content: string) {
    registerInteraction();
    setMessages((prev) => [...prev, { id: createId(), role: "assistant", content }]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const buttonPositionStyle = {
    right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
  };

  const panelPositionStyle = {
    right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          registerInteraction();
        }}
        className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-2xl text-white shadow-lg transition hover:bg-violet-500 animate-chat-icon sm:h-14 sm:w-14"
        style={buttonPositionStyle}
        aria-label="Abrir chat Assistente Dermosul"
      >
        💬
      </button>

      {open && (
        <div
          className="fixed z-50 flex w-[min(92vw,400px)] flex-col overflow-hidden rounded-3xl border border-violet-500/30 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur sm:w-[360px]"
          style={{
            maxHeight: "calc(100vh - 7rem)",
            height: "min(480px, calc(100vh - 7rem))",
            ...panelPositionStyle,
          }}
        >
          <div className="flex items-center justify-between bg-violet-700/80 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Assistente Dermosul</h3>
              <p className="text-xs text-violet-100">Tire dúvidas sobre produtos e pedidos</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full bg-violet-900/70 px-2 py-1 text-xs text-violet-100 hover:bg-violet-900/90"
            >
              Fechar
            </button>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  message.role === "user"
                    ? "ml-auto bg-violet-600 text-white shadow-[0_8px_30px_-12px_rgba(139,92,246,0.7)]"
                    : "bg-slate-800/80 text-slate-100 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.8)]"
                }`}
              >
                {renderMessageContent(message.content)}
              </div>
            ))}

            {partial && (
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-slate-800/70 px-3 py-2 text-slate-100">
                {renderMessageContent(partial)}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </span>
                Assistente está digitando…
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/80 p-3">
            <textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Como posso ajudar?"
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="mt-2 w-full rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function renderMessageContent(content: string) {
  return content.split("\n").map((line, lineIndex) => (
    <p key={`${lineIndex}-${line}`} className="whitespace-pre-wrap">
      {line.split(URL_REGEX).map((segment, segmentIndex) => {
        if (URL_PREFIX.test(segment)) {
          return (
            <a
              key={`${lineIndex}-${segmentIndex}-${segment}`}
              href={segment}
              className="text-violet-300 underline underline-offset-2 hover:text-violet-200"
            >
              {LINK_LABEL}
            </a>
          );
        }
        return <span key={`${lineIndex}-${segmentIndex}`}>{segment}</span>;
      })}
    </p>
  ));
}
