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
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    if (location.state) {
      setOrder(location.state as CheckoutResponse);
      return;
    }
    if (id) {
      const stored = getStoredOrder(id);
      if (stored) {
        setOrder(stored as CheckoutResponse);
      }
    }
  }, [id, location.state]);

  useEffect(() => {
    setStatusMessage(null);
  }, [order?.orderId]);

  const handleCopyPix = async () => {
    if (!order?.payment.pix?.copyPaste) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(order.payment.pix.copyPaste);
      } else if (typeof window !== "undefined" && typeof window.prompt === "function") {
        window.prompt("Copie o código Pix abaixo", order.payment.pix.copyPaste);
      } else {
        setStatusMessage({ tone: "info", text: "Não foi possível copiar automaticamente. O código está disponível abaixo." });
        return;
      }
      setStatusMessage({ tone: "success", text: "Código Pix copiado para a área de transferência." });
    } catch (error) {
      console.error("Falha ao copiar código Pix", error);
      setStatusMessage({ tone: "error", text: "Não foi possível copiar automaticamente. Copie manualmente o código abaixo." });
    }
  };

  const handleCheckPayment = async () => {
    if (!order?.payment.externalReference) return;
    setCheckingPayment(true);
    setStatusMessage(null);
    try {
      const response = await storefrontApi.checkPaymentStatus(order.payment.externalReference, {
        paymentId: order.payment.gatewayPaymentId ?? undefined,
      });
      if (response.paid) {
        const updatedOrder: CheckoutResponse = {
          ...order,
          status: "pago",
          payment: {
            ...order.payment,
            status: "confirmado",
            gatewayStatus: response.status || order.payment.gatewayStatus || null,
          },
        };
        setOrder(updatedOrder);
        setStatusMessage({ tone: "success", text: "Pagamento confirmado! Já estamos preparando seu pedido com todo carinho." });
        try {
          sessionStorage.setItem(`dermosul_order_${updatedOrder.orderId}`, JSON.stringify(updatedOrder));
        } catch (err) {
          console.warn("Não foi possível atualizar o histórico local do pedido", err);
        }
      } else {
        setStatusMessage({
          tone: "info",
          text: response.status
            ? `Ainda não recebemos a confirmação. Status no gateway: ${response.status}. Tente novamente em instantes.`
            : "Ainda não recebemos a confirmação. Tente novamente em instantes.",
        });
      }
    } catch (error: any) {
      setStatusMessage({ tone: "error", text: error?.message || "Falha ao consultar o status do pagamento." });
    } finally {
      setCheckingPayment(false);
    }
  };

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

  const isPix = order?.payment.method === "pix";
  const pixInfo = order?.payment.pix;

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="rounded-3xl border border-violet-100 bg-white px-8 py-12 shadow-sm">
          <h1 className="text-3xl font-semibold text-violet-900">Pedido recebido!</h1>
          {order ? (
            <div className="mt-4 text-sm text-violet-700">
              <p>
                Seu pedido <strong>#{order.orderNumber}</strong> está registrado como {order.status}.
              </p>
              {isPix && pixInfo ? (
                <div className="mt-6 space-y-4">
                  <p className="text-sm text-violet-700">
                    Escaneie o QR Code ou copie o código Pix para concluir o pagamento agora mesmo.
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <img
                      src={pixInfo.qrCode}
                      alt="QR Code Pix Dermosul"
                      className="h-48 w-48 rounded-2xl border border-violet-100 bg-white p-2 shadow"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
                    >
                      Copiar código Pix
                    </button>
                    <textarea
                      readOnly
                      value={pixInfo.copyPaste}
                      className="w-full max-w-lg rounded-2xl border border-violet-100 bg-violet-50 p-3 text-xs text-violet-800"
                    />
                    <p className="text-xs text-violet-500">
                      Referência: {order.payment.externalReference || "-"}
                    </p>
                    <button
                      type="button"
                      onClick={handleCheckPayment}
                      disabled={checkingPayment}
                      className="inline-flex items-center rounded-full border border-violet-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 transition hover:border-violet-400 hover:text-violet-900 disabled:cursor-not-allowed disabled:text-violet-400"
                    >
                      {checkingPayment ? "Verificando pagamento..." : "Já paguei, verificar status"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2">
                  {order.payment.method === "cartao"
                    ? "Pagamento com cartão aprovado. Se houver qualquer análise extra, avisamos por e-mail."
                    : "Em instantes você recebe o guia de uso no e-mail."}
                </p>
              )}
              <div className="mt-4 text-violet-900">
                <p>Total: <strong>{formatCurrency(order.totals.totalCents)}</strong></p>
                <p className="text-xs text-violet-500">
                  Pagamento: {order.payment.method}
                  {order.payment.status ? ` (${order.payment.status})` : ""}
                  {order.payment.gatewayStatus ? ` • Gateway: ${order.payment.gatewayStatus}` : ""}
                </p>
              </div>
              {statusMessage && (
                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-xs ${
                    statusMessage.tone === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : statusMessage.tone === "error"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-violet-50 text-violet-700"
                  }`}
                >
                  {statusMessage.text}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-violet-700">Pedido confirmado! Nossa equipe está por aqui se precisar de qualquer coisa.</p>
          )}
          <Link
            to="/"
            className="mt-8 inline-flex items-center rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Voltar para a vitrine
          </Link>
        </div>
      </main>
      <StorefrontFooter />
    </div>
  );
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
