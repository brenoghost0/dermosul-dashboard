import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { api, OverviewData, ConversionPoint, OrderRow, CategoryData, PaymentBreakdownItem } from "../../lib/api";

const COLORS = ["#22d3ee", "#38bdf8", "#8b5cf6", "#f472b6", "#5eead4"];
const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const fmtPercent = (n: number | undefined | null) =>
  Number.isFinite(n) ? `${(n as number).toFixed(2)}%` : "–";

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
  desconhecido: "Desconhecido",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-white/5 px-5 py-6 shadow-[0_32px_120px_-70px_rgba(34,211,238,0.65)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between text-sm font-semibold text-slate-200">
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/30 px-6 py-6 shadow-[0_32px_100px_-60px_rgba(15,185,233,0.4)] transition-transform hover:-translate-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
        <span>{label}</span>
        <span className="text-lg text-sky-300">{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-slate-50">{value}</div>
      {hint && <p className="mt-3 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Insight({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-white/5 px-4 py-3 text-sm text-slate-300 shadow-[0_24px_60px_-50px_rgba(34,211,238,0.45)]">
      <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function statusLabel(status: OrderRow["status"]) {
  switch (status) {
    case "pago":
      return "Pago";
    case "aguardando_pagamento":
      return "Aguardando";
    case "cancelado":
      return "Cancelado";
    case "enviado":
      return "Enviado";
    default:
      return "Pendente";
  }
}

function statusChip(status: OrderRow["status"]) {
  switch (status) {
    case "pago":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30";
    case "aguardando_pagamento":
      return "bg-amber-400/10 text-amber-200 border border-amber-400/30";
    case "cancelado":
      return "bg-rose-400/10 text-rose-200 border border-rose-400/30";
    case "enviado":
      return "bg-sky-400/10 text-sky-200 border border-sky-400/30";
    default:
      return "bg-slate-500/10 text-slate-300 border border-slate-500/30";
  }
}

interface DashboardState {
  overview: OverviewData;
  revenueByDay: Array<{ date: string; revenue: number }>;
  ordersByCategory: CategoryData[];
  conversionByDay: ConversionPoint[];
  lastOrders: OrderRow[];
}

export default function Home() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentsBreakdown, setPaymentsBreakdown] = useState<PaymentBreakdownItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const results = await Promise.allSettled([
        api.getOverview(),
        api.getRevenueByDay(),
        api.getOrdersByCategory(),
        api.getConversionByDay(),
        api.listOrders({ pageSize: 5, sort: "createdAt:desc" }),
      ]);

      const [overview, revenue, category, conversion, lastOrders] = results;

      if (overview.status === "rejected") {
        setError("Não foi possível carregar os dados principais do dashboard.");
        setLoading(false);
        return;
      }

      setState({
        overview: overview.value,
        revenueByDay: revenue.status === "fulfilled" ? revenue.value : [],
        ordersByCategory: category.status === "fulfilled" ? category.value : [],
        conversionByDay: conversion.status === "fulfilled" ? conversion.value : [],
        lastOrders:
          lastOrders.status === "fulfilled" && Array.isArray(lastOrders.value.items)
            ? lastOrders.value.items
            : [],
      });
      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadPayments() {
      try {
        const data = await api.getPaymentsBreakdown();
        if (mounted) {
          setPaymentsBreakdown(data);
        }
      } catch (err) {
        console.warn("[dashboard] Falha ao carregar breakdown de pagamentos", err);
        if (mounted) {
          setPaymentsBreakdown([]);
        }
      }
    }
    loadPayments();
    return () => {
      mounted = false;
    };
  }, []);

  const { revenueChartData, categoryChartData, paymentsChartData, conversionChartData } = useMemo(() => {
    if (!state) {
      return { revenueChartData: [], categoryChartData: [], paymentsChartData: [], conversionChartData: [] };
    }

    const fallbackFromOrders = Array.isArray(state.lastOrders)
      ? state.lastOrders.reduce<Record<string, number>>((acc, order) => {
          const method = order.paymentMethod || "desconhecido";
          const amount = typeof order.total === "number" ? order.total : 0;
          if (amount > 0) {
            acc[method] = (acc[method] ?? 0) + amount;
          }
          return acc;
        }, {})
      : {};

    const paymentsSource =
      paymentsBreakdown.length > 0
        ? paymentsBreakdown
        : (state.overview.paymentsBreakdown && state.overview.paymentsBreakdown.length > 0
            ? state.overview.paymentsBreakdown
            : Object.entries(fallbackFromOrders).map(([method, amount]) => ({ method, amount })));

    const paymentsData = Array.isArray(paymentsSource)
      ? paymentsSource
          .map((item) => ({ method: item.method, value: item.amount }))
          .filter((item) => item.value > 0)
      : [];

    return {
      revenueChartData: state.revenueByDay.map((d) => ({ ...d, date: ddmm(d.date) })),
      categoryChartData: state.ordersByCategory,
      paymentsChartData: paymentsData,
      conversionChartData: state.conversionByDay.map((d) => ({ ...d, date: ddmm(d.date) })),
    };
  }, [state, paymentsBreakdown]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="rounded-3xl border border-slate-800 bg-white/5 px-6 py-4 text-slate-300 shadow-xl">
          Carregando Dermosul Commerce OS…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
        <div className="rounded-3xl border border-rose-500/40 bg-white/5 px-6 py-4 text-rose-200 shadow-xl">{error}</div>
      </div>
    );
  }

  if (!state) {
    return null;
  }

  const paymentsTooltip = (value: number) => [BRL(value), "Valor"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-10">
        <div className="rounded-4xl relative mb-12 overflow-hidden border border-slate-800 bg-[#090f1b]/80 px-6 py-8 text-slate-200 shadow-[0_60px_140px_-80px_rgba(34,211,238,0.7)] backdrop-blur-2xl">
          <div className="absolute inset-y-0 right-0 hidden w-72 translate-x-28 rounded-full bg-gradient-to-br from-sky-400/30 via-cyan-400/20 to-fuchsia-400/20 blur-3xl sm:block" />
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Central de inteligência</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-50 md:text-4xl">Dermosul Commerce OS</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Acompanhe o desempenho das principais marcas de dermocosméticos no nosso marketplace. Dados em tempo real, previsão de demanda e monitoramento de ofertas para manter preços imbatíveis.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-white/5 px-3 py-1">⚡ IA de precificação</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-white/5 px-3 py-1">🛰️ Monitor multimarcas</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/60 bg-white/5 px-3 py-1">🔁 Atualização contínua</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Receita total" value={BRL(state.overview.totalRevenue)} hint="Últimos 14 dias" icon="💹" />
          <KpiCard label="Pedidos realizados" value={state.overview.totalOrders.toLocaleString("pt-BR") } hint="Fluxo confirmado" icon="🧾" />
          <KpiCard label="Ticket médio" value={BRL(state.overview.avgTicket)} hint="Por pedido" icon="🎯" />
          <KpiCard label="Conversão" value={fmtPercent(state.overview.convAvg)} hint="Média diária" icon="📈" />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartCard title="Receita por dia">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueChartData}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)} />
                  <Tooltip formatter={(v: number) => [BRL(v), "Receita"]} contentStyle={{ background: "#0f172a", border: "#1f2937" }} />
                  <Area type="monotone" dataKey="revenue" stroke="#22d3ee" strokeWidth={2} fill="url(#revGradient)" name="Receita" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Pedidos por categoria">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 12 }} interval={0} angle={-10} height={60} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), "Pedidos"]} contentStyle={{ background: "#0f172a", border: "#1f2937" }} />
                  <Bar dataKey="value" name="Pedidos" radius={[10, 10, 0, 0]} maxBarSize={42}>
                    {categoryChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Métodos de pagamento (R$)">
            <div className="h-[280px]">
              {paymentsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip formatter={paymentsTooltip} contentStyle={{ background: "#0f172a", border: "#1f2937" }} />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ color: "#94a3b8" }} formatter={(value: string) => paymentMethodLabels[value] || value} />
                    <Pie
                      data={paymentsChartData}
                      dataKey="value"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      labelLine={false}
                      label={({ percent, name }) => {
                        const labelKey = typeof name === "string" ? name : String(name ?? "");
                        const labelText = paymentMethodLabels[labelKey] ?? labelKey;
                        const percentage = typeof percent === "number" ? percent : 0;
                        return `${labelText} ${(percentage * 100).toFixed(0)}%`;
                      }}
                    >
                      {paymentsChartData.map((_slice, i) => (
                        <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Sem dados de pagamento no período.
                </div>
              )}
            </div>
          </ChartCard>

          <ChartCard title="Taxa de conversão (diária)">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={conversionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `${v.toFixed?.(1) ?? v}%`} />
                  <Tooltip formatter={(v: number) => fmtPercent(v)} contentStyle={{ background: "#0f172a", border: "#1f2937" }} />
                  <Line type="monotone" dataKey="rate" name="Conversão" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
          <ChartCard title="Últimos pedidos">
            <div className="overflow-hidden rounded-3xl">
              <table className="w-full text-sm text-slate-300">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Pedido</th>
                    <th className="px-5 py-3 text-left font-medium">Cliente</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {state.lastOrders.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                        Ainda não recebemos pedidos nesta janela.
                      </td>
                    </tr>
                  )}
                  {state.lastOrders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-800/60">
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-100">#{order.id.slice(0, 6)}</span>
                        <div className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("pt-BR")}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-300">{order.client}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusChip(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-100">{BRL(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>

          <div className="grid gap-4">
            <Insight
              title="Top marcas em alta"
              description="Skinceuticals, Eucerin e Vichy lideram o share de receita nesta semana. Ajuste campanhas cross-brand para maximizar o ROI."
            />
            <Insight
              title="Janelas de preço ideal"
              description="Maior volume de conversão acontece ao liberar cupons entre 18h e 22h. Configure ofertas relâmpago nesse período."
            />
            <Insight
              title="Alerta de estoque"
              description="Linhas antissinais estão com giro acelerado. Verifique níveis para evitar ruptura em itens premium."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
