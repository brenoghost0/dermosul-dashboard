import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type OrdersResponse, type OrderRow } from "../../lib/api";

const STATUSES = ["pago", "aguardando_pagamento", "pendente", "cancelado", "enviado"] as const;
const STATUS_LABEL: Record<typeof STATUSES[number], string> = {
  pago: "Pago",
  aguardando_pagamento: "Aguardando",
  pendente: "Pendente",
  cancelado: "Cancelado",
  enviado: "Enviado",
};

const STATUS_STYLE: Record<typeof STATUSES[number], string> = {
  pago: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  aguardando_pagamento: "bg-amber-400/15 text-amber-200 border border-amber-400/30",
  pendente: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
  cancelado: "bg-rose-500/15 text-rose-200 border border-rose-500/30",
  enviado: "bg-sky-500/15 text-sky-200 border border-sky-500/30",
};

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR");
};

export default function Pedidos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [params, setParams] = useState({
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 20,
    q: searchParams.get("q") || "",
    status: searchParams.get("status") || "",
    category: searchParams.get("category") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    sort: searchParams.get("sort") || "dateDesc",
  });

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    data?.items?.forEach((order) => order.category && set.add(order.category));
    return Array.from(set).sort();
  }, [data]);

  useEffect(() => {
    const entries = Object.entries(params).filter(([, value]) => value !== "" && value !== null);
    setSearchParams(Object.fromEntries(entries.map(([k, v]) => [k, String(v)])));
  }, [params, setSearchParams]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    const payload = {
      ...params,
      sort: applySort(params.sort),
    };
    api
      .listOrders(payload)
      .then((response) => {
        if (mounted) setData(response);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Não foi possível carregar a lista de pedidos.");
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [JSON.stringify(params)]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function exportCsv() {
    const res = await api.exportOrdersCsv({
      ...params,
      sort: applySort(params.sort),
    });
    if (!res.ok) {
      alert("Falha ao exportar CSV.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pedidos-dermosul.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function remove(orderId: string) {
    if (!window.confirm("Confirma a exclusão deste pedido?")) return;
    try {
      setLoading(true);
      await api.deleteOrder(orderId);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => item.fullId !== orderId),
          total: Math.max(prev.total - 1, 0),
        };
      });
    } catch (err: any) {
      setError(err?.message || "Erro ao excluir pedido.");
    } finally {
      setLoading(false);
    }
  }

  const applySort = (value: string) => {
    const map: Record<string, string> = {
      dateDesc: "createdAt:desc",
      dateAsc: "createdAt:asc",
      valueDesc: "totalAmount:desc",
      valueAsc: "totalAmount:asc",
      clientAsc: "client:asc",
      clientDesc: "client:desc",
    };
    return map[value] || value;
  };

  const sortOptions = [
    { value: "dateDesc", label: "Data ↓" },
    { value: "dateAsc", label: "Data ↑" },
    { value: "valueDesc", label: "Valor ↓" },
    { value: "valueAsc", label: "Valor ↑" },
    { value: "clientAsc", label: "Cliente A→Z" },
    { value: "clientDesc", label: "Cliente Z→A" },
  ];

  return (
    <div className="space-y-8 text-slate-200">
      <header className="rounded-4xl border border-slate-800 bg-[#0b1424]/80 px-6 py-7 shadow-[0_40px_120px_-80px_rgba(34,211,238,0.55)] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Operação</p>
            <h1 className="text-2xl font-semibold text-slate-50 md:text-3xl">Pedidos multimarcas</h1>
            <p className="text-sm text-slate-400">
              Acompanhe pedidos, status de pagamento e categorias com maior giro nas últimas semanas.
            </p>
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-white/10 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:bg-white/20"
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </header>

      <section className="rounded-4xl border border-slate-800 bg-[#0b1424]/70 px-6 py-6 shadow-[0_36px_110px_-90px_rgba(34,211,238,0.45)] backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Filtros</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-6">
          <FilterInput
            label="Busca"
            value={params.q}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, q: value }))}
            placeholder="Cliente ou ID"
            colSpan="md:col-span-2"
          />
          <FilterSelect
            label="Status"
            value={params.status}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, status: value }))}
            options={[{ value: "", label: "Todos" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]}
          />
          <FilterInput
            label="Categoria"
            value={params.category}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, category: value }))}
            placeholder="Categoria"
          />
          <FilterInput
            label="De"
            type="date"
            value={params.dateFrom}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, dateFrom: value }))}
          />
          <FilterInput
            label="Até"
            type="date"
            value={params.dateTo}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, dateTo: value }))}
          />
          <FilterSelect
            label="Ordenação"
            value={params.sort}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, sort: value }))}
            options={sortOptions}
            colSpan="md:col-span-2"
          />
          <FilterSelect
            label="Resultados por página"
            value={String(params.pageSize)}
            onChange={(value) => setParams((prev) => ({ ...prev, page: 1, pageSize: Number(value) }))}
            options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: `${n}` }))}
          />
        </div>
      </section>

      {loading && <FallbackMessage message="Carregando pedidos Dermosul…" />}
      {error && <FallbackMessage tone="error" message={error} />}
      {!loading && !error && data && data.items.length === 0 && <FallbackMessage message="Nenhum pedido encontrado." />}

      {!loading && !error && data && data.items.length > 0 && (
        <section className="rounded-4xl border border-slate-800 bg-[#060b14]/70 shadow-[0_32px_100px_-90px_rgba(34,211,238,0.45)] backdrop-blur-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800/80 text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Data</th>
                  <th className="px-5 py-3 text-left font-medium">Pedido</th>
                  <th className="px-5 py-3 text-left font-medium">Cliente</th>
                  <th className="px-5 py-3 text-left font-medium">Categoria</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.items.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5">
                    <td className="px-5 py-3 align-middle text-slate-400">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-3 align-middle">
                      <button
                        className="font-semibold text-sky-300 hover:text-sky-200"
                        onClick={() => navigate(`/dashboard/pedidos/${order.fullId}`)}
                      >
                        #{order.id}
                      </button>
                      <div className="text-xs text-slate-500">{order.category || "—"}</div>
                    </td>
                    <td className="px-5 py-3 align-middle text-slate-300">{order.client}</td>
                    <td className="px-5 py-3 align-middle text-slate-400">{order.category || "—"}</td>
                    <td className="px-5 py-3 align-middle">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[order.status as typeof STATUSES[number]] || "bg-slate-600/20 text-slate-300"}`}>
                        {STATUS_LABEL[order.status as typeof STATUSES[number]] || order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 align-middle text-right font-semibold text-slate-200">{BRL(order.total)}</td>
                    <td className="px-5 py-3 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-full border border-slate-700/70 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
                          onClick={() => navigate(`/dashboard/pedidos/${order.fullId}`)}
                        >
                          Detalhes
                        </button>
                        <button
                          className="rounded-full border border-rose-500/40 px-3 py-1 text-xs text-rose-200 transition hover:bg-rose-500/10"
                          onClick={() => remove(order.fullId)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-800/70 bg-white/5 px-5 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Página {params.page} de {totalPages} · {data.total.toLocaleString("pt-BR")} pedidos
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={params.page <= 1}
                onClick={() => setParams((prev) => ({ ...prev, page: Math.max(prev.page - 1, 1) }))}
                className="rounded-full border border-slate-700/60 px-3 py-1 text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                disabled={params.page >= totalPages}
                onClick={() => setParams((prev) => ({ ...prev, page: Math.min(prev.page + 1, totalPages) }))}
                className="rounded-full border border-slate-700/60 px-3 py-1 text-slate-300 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder, type = "text", colSpan }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  colSpan?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-400 ${colSpan ?? ""}`}>
      <span className="tracking-[0.2em] uppercase">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-slate-900/40 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
      />
    </label>
  );
}

function FilterSelect({ label, value, onChange, options, colSpan }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  colSpan?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-400 ${colSpan ?? ""}`}>
      <span className="tracking-[0.2em] uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-800 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#05080f] text-slate-100">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FallbackMessage({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  const toneClass = tone === "error"
    ? "border border-rose-500/30 bg-rose-500/10 text-rose-100"
    : "border border-slate-800 bg-white/5 text-slate-300";
  return <div className={`rounded-3xl px-5 py-4 text-center text-sm backdrop-blur ${toneClass}`}>{message}</div>;
}
