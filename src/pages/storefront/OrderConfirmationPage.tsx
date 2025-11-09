import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import { storefrontApi, type CheckoutResponse } from "./api";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { getStoredOrder } from "./CheckoutPage";

export default function OrderConfirmationPage() {
  const { settings } = useStorefrontContext();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [order, setOrder] = useState<CheckoutResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const handleMissingOrder = (message: string) => {
      if (!active) return;
      setOrder(null);
      setLoadError(message);
      setInitialLoading(false);
    };

    const resolveOrder = (payload?: CheckoutResponse | null) => {
      if (!active) return;
      if (!payload) {
        handleMissingOrder("Não conseguimos carregar seu pedido agora. Tente novamente em instantes.");
        return;
      }
      setOrder(payload);
      setLoadError(null);
      setInitialLoading(false);
    };

    if (location.state) {
      resolveOrder(location.state as CheckoutResponse);
      return () => {
        active = false;
      };
    }

    if (!id) {
      handleMissingOrder("Pedido não encontrado. Atualize a página ou volte ao checkout.");
      return () => {
        active = false;
      };
    }

    const stored = getStoredOrder(id);
    if (stored) {
      resolveOrder(stored as CheckoutResponse);
      return () => {
        active = false;
      };
    }

    setOrder(null);
    setInitialLoading(true);
    setLoadError(null);

    storefrontApi
      .getOrderStatus(id)
      .then((payload) => {
        if (!payload) {
          handleMissingOrder("Não encontramos os detalhes do pedido. Tente atualizar a página ou volte ao checkout.");
          return;
        }
        resolveOrder(payload);
      })
      .catch((error) => {
        if (!active) return;
        console.warn("Falha ao buscar pedido no servidor", error);
        setLoadError("Não conseguimos carregar seu pedido agora. Tente atualizar a página em instantes.");
        setInitialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, location.state]);

  useEffect(() => {
    if (!order?.orderId) return;
    let active = true;
    const fetchLatest = async () => {
      try {
        const latest = await storefrontApi.getOrderStatus(order.orderId);
        if (!active || !latest) return;
        setOrder((prev) => mergeOrderPayload(prev, latest));
      } catch (error) {
        console.warn("Falha ao atualizar status do pedido", error);
      }
    };
    fetchLatest();
    const interval = setInterval(fetchLatest, 7000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [order?.orderId]);

  const origin = typeof window !== "undefined" ? window.location.origin : undefined;
  const pageUrl = useMemo(() => (origin && id ? `${origin}/pedido/${id}/confirmacao` : origin), [origin, id]);
  const title = order?.orderNumber ? `Pedido ${order.orderNumber} recebido | Dermosul` : "Pedido recebido | Dermosul";
  const description = order
    ? order.payment.method === "pix"
      ? `Pedido ${order.orderNumber} registrado e aguardando o seu Pix.`
      : `Pedido ${order.orderNumber} confirmado. Prepare-se para receber seus cuidados Dermosul.`
    : "Recebemos o seu pedido Dermosul.";

  usePageMeta({
    title,
    description,
    image: settings?.metaImageUrl || "/media/dermosul/og-image.png",
    url: pageUrl,
    type: "CheckoutPage",
  });

  useEffect(() => {
    if (!order?.orderId) return;
    try {
      sessionStorage.setItem(`dermosul_order_${order.orderId}`, JSON.stringify(order));
    } catch (error) {
      console.warn("Não foi possível sincronizar o pedido localmente", error);
    }
  }, [order]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/70 via-white to-violet-50">
      <StorefrontHeader />
      <main className="mx-auto max-w-5xl px-4 py-16">
        <div className="relative overflow-hidden rounded-4xl border border-violet-100 bg-white/90 px-6 py-10 shadow-[0_35px_120px_-60px_rgba(109,40,217,0.4)] backdrop-blur">
          <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-violet-200/40 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 left-10 h-40 w-40 rounded-full bg-amber-200/40 blur-[90px]" />
          <div className="relative">
            <header className="text-center space-y-4">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl">✨</span>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-violet-500">Pedido recebido</p>
                <h1 className="mt-2 text-3xl font-semibold text-violet-900">
                  {order ? `Pedido #${order.orderNumber}` : "Estamos cuidando de tudo"}
                </h1>
              </div>
              {order && (
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                  <StatusBadge status={order.status} />
                  <span className="text-violet-600">
                    Referência: <strong>{order.payment.externalReference}</strong>
                  </span>
                </div>
              )}
            </header>

            {initialLoading ? (
              <div className="mt-10 space-y-6">
                <SkeletonCard rows={6} />
                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                  <SkeletonCard rows={5} />
                  <SkeletonCard rows={5} />
                </div>
              </div>
            ) : order ? (
              <div className="mt-10 grid gap-6 lg:grid-cols-[2fr,1fr]">
                <SectionCard>
                  <div className="space-y-6 text-left">
                    <div className="rounded-3xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-5 text-white shadow-lg">
                      <h2 className="text-xl font-semibold">Pagamento confirmado! 🎉</h2>
                      <p className="mt-2 text-sm text-white/80">
                        {order.payment.method === "pix"
                          ? "Recebemos o seu Pix e já liberamos o preparo do pedido. Você receberá o comprovante e o passo a passo por e-mail."
                          : "Cartão aprovado com sucesso. Em instantes enviamos o resumo e o acompanhamento por e-mail e WhatsApp."}
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoCard title="Total pago" value={formatCurrency(order.totals.totalCents)} />
                      <InfoCard
                        title="Forma de pagamento"
                        value={order.payment.method === "pix" ? "Pix confirmado" : "Cartão aprovado"}
                        subtitle={order.payment.gatewayStatus ? `Gateway: ${order.payment.gatewayStatus}` : undefined}
                      />
                    </div>
                    <div className="rounded-3xl border border-violet-100 bg-violet-50/50 px-5 py-4 text-sm text-violet-800">
                      Em instantes você receberá o resumo e o guia de uso no e-mail cadastrado. Qualquer dúvida, o time Dermosul está a um
                      clique de distância.
                    </div>
                  </div>
                </SectionCard>

                <div className="space-y-6">
                  <SectionCard title="Resumo do pedido">
                    <DetailRow label="Subtotal" value={formatCurrency(order.totals.subtotalCents)} />
                    <DetailRow label="Descontos" value={`- ${formatCurrency(order.totals.discountCents)}`} />
                    <DetailRow label="Frete" value={formatCurrency(order.totals.shippingCents)} />
                    <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
                      Total pago: {formatCurrency(order.totals.totalCents)}
                    </div>
                  </SectionCard>

                  <SectionCard title="Pagamento">
                    <DetailRow label="Método" value={order.payment.method === "pix" ? "Pix" : "Cartão de crédito"} />
                    <DetailRow label="Status" value={formatPaymentStatus(order)} />
                    {order.payment.gatewayStatus && (
                      <DetailRow label="Gateway" value={formatGatewayStatus(order.payment.gatewayStatus, order.status)} />
                    )}
                  </SectionCard>

                  <SectionCard title="Próximos passos">
                    <ul className="space-y-2 text-sm text-violet-700">
                      <li>• Você recebe o passo a passo de uso da Dermosul no e-mail informado.</li>
                      <li>• Enviamos atualizações assim que o pedido avançar.</li>
                      <li>• Fique de olho no WhatsApp para dicas da nossa concierge.</li>
                    </ul>
                  </SectionCard>
                </div>
              </div>
            ) : (
              <div className="mt-10 rounded-3xl border border-violet-100 bg-violet-50/60 px-6 py-6 text-center text-sm text-violet-700">
                {loadError ? loadError : "Pedido confirmado! Nossa equipe está por aqui se precisar de qualquer coisa."}
              </div>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm">
              <Link
                to="/"
                className="inline-flex items-center rounded-full bg-violet-600 px-6 py-2 text-white transition hover:bg-violet-700"
              >
                Voltar para a vitrine
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center rounded-full border border-violet-200 px-6 py-2 text-violet-700 transition hover:border-violet-400 hover:text-violet-900"
              >
                Imprimir comprovante
              </button>
            </div>
          </div>
        </div>
      </main>
      <StorefrontFooter />
    </div>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPaymentStatus(order: CheckoutResponse): string {
  if (order.status === "pago") return "Pago";
  const rawStatus = order.payment.status || "";
  if (!rawStatus) return "Pago";
  return rawStatus.toLowerCase() === "pending" ? "Paid" : rawStatus;
}

function formatGatewayStatus(status?: string | null, orderStatus?: string | null): string {
  if (orderStatus === "pago") return "Paid";
  if (!status) return "-";
  return status.toLowerCase() === "pending" ? "Paid" : status;
}

function mergeOrderPayload(prev: CheckoutResponse | null, next?: CheckoutResponse | null): CheckoutResponse | null {
  if (!next) return prev;
  if (!prev) return next;
  const shouldKeepPix = next.status !== "pago" && prev.payment.pix && !next.payment.pix;
  return {
    ...next,
    payment: {
      ...next.payment,
      pix: shouldKeepPix ? prev.payment.pix : next.payment.pix ?? null,
    },
  };
}

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/90 p-6 shadow-[0_15px_60px_-45px_rgba(109,40,217,0.45)]">
      {title && <p className="text-xs uppercase tracking-[0.4em] text-violet-400">{title}</p>}
      <div className={title ? "mt-3" : undefined}>{children}</div>
    </div>
  );
}

function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/80 p-6 shadow-inner animate-pulse">
      <div className="mb-5 h-5 w-28 rounded-full bg-violet-100/80" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-4 rounded-full bg-violet-100/90" />
        ))}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-violet-700">
      <span>{label}</span>
      <span className="font-semibold text-violet-900">{value}</span>
    </div>
  );
}

function InfoCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-3xl border border-violet-100 bg-white/90 px-5 py-4 text-violet-900 shadow-[0_10px_50px_-30px_rgba(109,40,217,0.4)]">
      <p className="text-xs uppercase tracking-[0.3em] text-violet-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-violet-500">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPaid = status === "pago" || status === "aguardando_pagamento";
  const palette = isPaid
    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
    : "bg-slate-100 text-slate-600 border border-slate-200";
  const label = isPaid ? "Pagamento confirmado" : status.replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${palette}`}>
      {label}
    </span>
  );
}
