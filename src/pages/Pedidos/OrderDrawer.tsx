import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Item = { sku: string; name: string; qty: number; price: number; subtotal: number };
type Payment = { method?: string; status?: string; installments?: number; paidAmount?: number };
type Shipping = { address1?: string; address2?: string; district?: string; city?: string; state?: string; postalCode?: string };
type Timeline = { label: string; date: string };

export type OrderDetail = {
  id: string;
  createdAt: string;
  status?: string;
  client?: string; // lista usa string; detail pode ter clientInfo, mas mantemos compat
  clientInfo?: { name?: string; email?: string; phone?: string };
  category?: string;
  payment?: Payment;
  items?: Item[];
  totals?: { itemsTotal?: number; shipping?: number; discount?: number; grandTotal?: number };
  total?: number; // fallback
  shipping?: Shipping;
  timeline?: Timeline[];
};

function brl(n: number | undefined) {
  const v = typeof n === "number" ? n : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pt(ymd: string | undefined) {
  if (!ymd) return "—";
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const [y, m, d] = parts.map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? ymd : dt.toLocaleDateString("pt-BR");
}

export default function OrderDrawer({
  id,
  open,
  onClose,
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Buscar sempre que abrir com id válido
  useEffect(() => {
    if (!open || !id) return;
    setLoading(true);
    setErr(null);
    setData(null);
    api
      .getOrderById(id)
      .then((d: OrderDetail) => setData(d))
      .catch((e: Error) => setErr(e?.message || "Erro ao carregar pedido"))
      .finally(() => setLoading(false));
  }, [open, id]);

  // ESC fecha
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  // Não renderiza nada quando fechado → evita acessar estados sem necessidade
  if (!open) return null;

  const status = data?.status ?? "—";
  const cliente = data?.clientInfo?.name || data?.client || "—";
  const total = data?.totals?.grandTotal ?? data?.total ?? 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Fechar"
      />
      {/* Painel */}
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        {/* Cabeçalho */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Pedido #{id ?? "—"}</h2>
            <span
              className={[
                "inline-block text-xs mt-1 px-2 py-1 rounded-full",
                status === "pago"
                  ? "bg-green-100 text-green-700"
                  : (status === "pendente" || status === "aguardando_pagamento")
                  ? "bg-yellow-100 text-yellow-700"
                  : status === "cancelado"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-700",
              ].join(" ")}
            >
              {status}
            </span>
          </div>
          <div className="space-x-2">
            <button
              className="px-3 py-2 border rounded"
              onClick={() => id && navigator.clipboard.writeText(id)}
            >
              Copiar ID
            </button>
            <button
              className="px-3 py-2 bg-emerald-700 text-white rounded"
              onClick={() => window.print()}
            >
              Imprimir
            </button>
            <button className="px-3 py-2 border rounded" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-4 overflow-y-auto grow space-y-6">
          {loading && <div>Carregando…</div>}
          {err && <div className="text-red-600">Erro: {err}</div>}

          {!loading && !err && (data && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Cliente</div>
                  <div className="font-medium">{cliente}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Data</div>
                  <div className="font-medium">{pt(data?.createdAt)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="font-medium">{brl(total)}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Categoria</div>
                  <div className="font-medium">{data?.category ?? "—"}</div>
                </div>
              </div>

              {/* Itens */}
              <div>
                <h3 className="font-semibold mb-2">Itens</h3>
                <div className="rounded border overflow-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-3 py-2 text-xs text-gray-500">SKU</th>
                        <th className="px-3 py-2 text-xs text-gray-500">Produto</th>
                        <th className="px-3 py-2 text-xs text-gray-500">Qtde</th>
                        <th className="px-3 py-2 text-xs text-gray-500">Preço</th>
                        <th className="px-3 py-2 text-xs text-gray-500">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.items ?? []).map((it, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{it.sku}</td>
                          <td className="px-3 py-2">{it.name}</td>
                          <td className="px-3 py-2">{it.qty}</td>
                          <td className="px-3 py-2">{brl(it.price)}</td>
                          <td className="px-3 py-2">{brl(it.subtotal)}</td>
                        </tr>
                      ))}
                      <tr className="border-t bg-gray-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-medium">
                          Itens
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {brl(data?.totals?.itemsTotal)}
                        </td>
                      </tr>
                      <tr className="border-t bg-gray-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-medium">
                          Frete
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {brl(data?.totals?.shipping)}
                        </td>
                      </tr>
                      <tr className="border-t bg-gray-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-medium">
                          Desconto
                        </td>
                        <td className="px-3 py-2 font-medium">
                          - {brl(data?.totals?.discount)}
                        </td>
                      </tr>
                      <tr className="border-t bg-gray-50">
                        <td colSpan={4} className="px-3 py-2 text-right font-semibold">
                          Total
                        </td>
                        <td className="px-3 py-2 font-semibold">{brl(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Pagamento</div>
                  <div className="font-medium">
                    {data?.payment?.method ?? "—"}
                    {data?.payment?.installments && data.payment.installments > 1
                      ? ` em ${data.payment.installments}x`
                      : ""}
                  </div>
                  <div className="text-sm text-gray-600">
                    Situação: {data?.payment?.status ?? "—"}
                  </div>
                </div>
                <div className="p-3 rounded border">
                  <div className="text-xs text-gray-500">Valor Pago</div>
                  <div className="font-medium">
                    {brl(data?.payment?.paidAmount)}
                  </div>
                </div>
              </div>

              {/* Cliente & Endereço */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border">
                  <h4 className="font-semibold mb-1">Cliente</h4>
                  <div>{cliente}</div>
                  <div className="text-sm text-gray-600">
                    {data?.clientInfo?.email ?? "—"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {data?.clientInfo?.phone ?? "—"}
                  </div>
                </div>
                <div className="p-3 rounded border">
                  <h4 className="font-semibold mb-1">Endereço</h4>
                  <div>{data?.shipping?.address1 ?? "—"}</div>
                  <div>{data?.shipping?.address2 ?? ""}</div>
                  <div className="text-sm text-gray-600">
                    {[data?.shipping?.district, data?.shipping?.city, data?.shipping?.state]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {data?.shipping?.postalCode ?? ""}
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {(data?.timeline ?? []).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Linha do tempo</h4>
                  <ol className="relative border-l pl-5">
                    {(data?.timeline ?? []).map((t, i) => (
                      <li key={i} className="mb-3">
                        <div className="absolute -left-1.5 w-3 h-3 bg-emerald-600 rounded-full mt-1.5" />
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs text-gray-600">{pt(t.date)}</div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          ))}
        </div>
      </aside>
    </div>
  );
}
