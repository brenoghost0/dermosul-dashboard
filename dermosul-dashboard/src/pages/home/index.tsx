import React, { useEffect, useState } from "react";
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
import { api, OverviewData, RevenueData, CategoryData, PaymentData, ConversionData, OrderRow } from "../../lib/api";

// ============================================================================
// Helpers
// ============================================================================

/** Paleta usada nos gráficos (verde Dermosul e complementares) */
const COLORS = [
  "#175544", // verde principal
  "#1b6e5a",
  "#2aa874",
  "#8FD3C8",
  "#F6BD60",
  "#F7A072",
  "#C03221",
  "#6C4AB6",
  "#82ca9d",
  "#8884d8",
];

/** Formata valores em BRL */
const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Formata data curta (dd/mm) para eixos de gráfico */
const ddmm = (iso: string) => {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}`;
};

// ============================================================================
// Componentes de UI locais (simples, Tailwind)
// ============================================================================

type CardProps = {
  title?: string;
  children?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};
function ChartCard({ title, right, className, children }: CardProps) {
  return (
    <div
      className={`bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        {title ? (
          <h3 className="text-base md:text-lg font-semibold text-zinc-800">
            {title}
          </h3>
        ) : (
          <div />
        )}
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  delta?: number; // variação percentual (+8, -3...)
  hint?: string;
};
function KpiCard({ label, value, delta, hint }: KpiCardProps) {
  const isUp = (delta ?? 0) >= 0;
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      {typeof delta === "number" ? (
        <div className="text-sm">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              isUp
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            <span className={`text-base ${isUp ? "rotate-0" : "rotate-180"}`}>
              ▲
            </span>
            {Math.abs(delta).toFixed(1)}%
          </span>
          {hint ? <span className="text-zinc-500 ml-2">{hint}</span> : null}
        </div>
      ) : hint ? (
        <div className="text-sm text-zinc-500">{hint}</div>
      ) : null}
    </div>
  );
}

// ============================================================================
// Página: Home
// ============================================================================

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewData>({ totalRevenue: 0, totalOrders: 0, avgTicket: 0, convAvg: 0 });
  const [revenueByDay, setRevenueByDay] = useState<RevenueData>([]);
  const [ordersByCategory, setOrdersByCategory] = useState<CategoryData>([]);
  const [payments, setPayments] = useState<PaymentData>([]);
  const [lastOrders, setLastOrders] = useState<OrderRow[]>([]);
  const [conversionByDay, setConversionByDay] = useState<ConversionData>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null); // Clear previous errors

      const [
        overviewResult,
        revenueByDayResult,
        ordersByCategoryResult,
        paymentsResult,
        lastOrdersResult,
        conversionByDayResult,
      ] = await Promise.allSettled([
        api.getOverview(),
        api.getRevenueByDay(),
        api.getOrdersByCategory(),
        api.getPayments(),
        api.listOrders({ pageSize: 5, sort: "order_date:desc" }), // Changed sort field
        api.getConversionByDay(),
      ]);

      let hasError = false;

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      } else {
        console.error("Erro ao carregar dados de visão geral:", overviewResult.reason);
        setOverview({ totalRevenue: 0, totalOrders: 0, avgTicket: 0, convAvg: 0 });
        hasError = true;
      }

      if (revenueByDayResult.status === "fulfilled" && Array.isArray(revenueByDayResult.value)) {
        setRevenueByDay(revenueByDayResult.value);
      } else {
        console.error("Erro ao carregar dados de receita por dia ou dados inválidos:", revenueByDayResult.reason || revenueByDayResult.value);
        setRevenueByDay([]);
        hasError = true;
      }

      if (ordersByCategoryResult.status === "fulfilled" && Array.isArray(ordersByCategoryResult.value)) {
        setOrdersByCategory(ordersByCategoryResult.value);
      } else {
        console.error("Erro ao carregar dados de pedidos por categoria ou dados inválidos:", ordersByCategoryResult.reason || ordersByCategoryResult.value);
        setOrdersByCategory([]);
        hasError = true;
      }

      if (paymentsResult.status === "fulfilled" && Array.isArray(paymentsResult.value)) {
        setPayments(paymentsResult.value);
      } else {
        console.error("Erro ao carregar dados de pagamentos ou dados inválidos:", paymentsResult.reason || paymentsResult.value);
        setPayments([]);
        hasError = true;
      }

      if (lastOrdersResult.status === "fulfilled" && lastOrdersResult.value && Array.isArray(lastOrdersResult.value.items)) {
        setLastOrders(lastOrdersResult.value.items);
      } else {
        console.error("Erro ao carregar últimos pedidos ou dados inválidos:", lastOrdersResult.reason || lastOrdersResult.value);
        setLastOrders([]);
        hasError = true;
      }

      let currentConversionByDay: ConversionData = [];
      if (conversionByDayResult.status === "fulfilled" && Array.isArray(conversionByDayResult.value)) {
        currentConversionByDay = conversionByDayResult.value;
        setConversionByDay(currentConversionByDay);
      }
      else {
        console.error("Erro ao carregar dados de conversão por dia ou dados inválidos:", conversionByDayResult.reason || conversionByDayResult.value);
        setConversionByDay([]);
        hasError = true;
      }

      // Set general error message if any API call failed
      if (hasError) {
        setError("Falha ao carregar métricas do dashboard. Verifique o console para mais detalhes.");
      }

      // Ensure convAvg is 0.0% if no orders or conversion data is empty
      setOverview(prev => {
        const newOverview = { ...prev };
        if (newOverview.totalOrders === 0 || currentConversionByDay.length === 0) {
          newOverview.convAvg = 0;
        }
        return newOverview;
      });

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">Carregando…</div>;
  if (error) return <div className="p-6 text-rose-600">Erro: {error}</div>;

  // KPIs
  const totalRevenue = overview.totalRevenue;
  const totalOrders = overview.totalOrders;
  const avgTicket = overview.avgTicket;
  const convAvg = overview.convAvg;

  // Dados preparados para gráficos
  const days14ForArea = revenueByDay.map((d) => ({
    date: ddmm(d.date),
    revenue: d.revenue,
  }));

  const categoryBars = ordersByCategory.map((c) => ({
    category: c.category,
    value: c.value,
  }));

  // Para Pizza, já temos `payments`
  // Para Linha (conversão diária) — vamos exibir em % (0..100)
  const convLine = conversionByDay.map((d) => ({ date: ddmm(d.date), rate: d.rate * 100 }));

  // Tooltip formatters
  const currencyFmt = (v: number) => BRL(v);
  const percentFmt = (v: number) => `${v.toFixed(2)}%`;

  // Label do Pie tipada (evita reclamações do TS)
  const pieLabel = (args: { name?: string; percent?: number }) => {
    const { name, percent } = args;
    const p = ((percent ?? 0) * 100).toFixed(0);
    return `${name ?? ""} ${p}%`;
  };

  return (
    <div className="p-2 md:p-3 lg:p-4">
      {/* Cabeçalho simples */}
      <div className="mb-4 lg:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-emerald-900">
          Dermosul Dashboard
        </h1>
        <p className="text-zinc-600">Resumo dos últimos 14 dias</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4 lg:mb-6">
        <KpiCard
          label="Receita (14d)"
          value={BRL(totalRevenue)}
          hint="Comparado aos 7 dias anteriores"
        />
        <KpiCard
          label="Pedidos (14d)"
          value={totalOrders.toLocaleString("pt-BR")}
          hint="Comparado aos 7 dias anteriores"
        />
        <KpiCard
          label="Ticket médio"
          value={BRL(avgTicket)}
          hint="Média móvel"
        />
        <KpiCard
          label="Conversão"
          value={`${(convAvg * 100).toFixed(2)}%`} // Display as percentage
          hint="Taxa média"
        />
      </div>

      {/* Linha 1: Receita por dia + Pedidos por categoria */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 lg:mb-6">
        {/* AreaChart - Receita por dia */}
        <ChartCard title="Receita por dia (14d)">
          <div className="h-[260px] md:h-[300px]">
            {days14ForArea.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days14ForArea} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#175544" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#175544" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                  />
                  <Tooltip
                    formatter={(v) => [currencyFmt(Number(v)), "Receita"]}
                    labelFormatter={(l) => `Data: ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#175544"
                    fill="url(#revGradient)"
                    strokeWidth={2}
                    dot={false}
                    name="Receita"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </ChartCard>

        {/* BarChart - Pedidos por categoria */}
        <ChartCard title="Pedidos por categoria (14d)">
          <div className="h-[260px] md:h-[300px]">
            {categoryBars.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBars}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-10}
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => [Number(v).toLocaleString("pt-BR"), "Pedidos"]}
                    labelFormatter={(l) => `Categoria: ${l}`}
                  />
                  <Bar
                    dataKey="value"
                    name="Pedidos"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={36}
                  >
                    {categoryBars.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Linha 2: Métodos de pagamento + Conversão */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 lg:mb-6">
        {/* PieChart - Métodos de pagamento */}
        <ChartCard title="Métodos de pagamento (R$)">
          <div className="h-[260px] md:h-[300px]">
            {payments.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(v) => [currencyFmt(Number(v)), "Valor"]}
                    labelFormatter={(l) => `Método: ${l}`}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" />
                  <Pie
                    data={payments}
                    dataKey="value"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    labelLine={false}
                    label={pieLabel}
                  >
                    {payments.map((_slice, i) => (
                      <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </ChartCard>

        {/* LineChart - Conversão diária */}
        <ChartCard title="Taxa de conversão (diária)">
          <div className="h-[260px] md:h-[300px]">
            {convLine.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={convLine} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    domain={[0, "auto"]}
                  />
                  <Tooltip
                    formatter={(v) => [percentFmt(Number(v)), "Conversão"]}
                    labelFormatter={(l) => `Data: ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Conversão"
                    stroke={COLORS[2]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Sem dados disponíveis
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Últimos pedidos (tabela simples) */}
      <ChartCard
        title="Pedidos recentes"
        right={
          <span className="text-sm text-zinc-500">
            Exibindo {lastOrders.length} últimos pedidos
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {lastOrders.map((o, idx) => (
                <tr
                  key={o.id}
                  className={`text-sm border-t border-zinc-100 ${
                    idx % 2 ? "bg-zinc-50/30" : "bg-white"
                  }`}
                >
                  <td className="py-2 pr-3 font-mono text-emerald-900">{o.id}</td>
                  <td className="py-2 pr-3">{o.customer.firstName} {o.customer.lastName}</td>
                  <td className="py-2 pr-3">
                    {new Date(o.order_date).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3">{BRL(o.total_value)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        o.status === "pago"
                          ? "bg-emerald-50 text-emerald-700"
                          : o.status === "pendente"
                          ? "bg-amber-50 text-amber-700"
                          : o.status === "enviado"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Rodapé/observações */}
      <div className="mt-6 text-xs text-zinc-500">
        <p>
          * Dados mockados para visualização. Em produção, troque pelos endpoints
          reais do backend (ex.: <code>/api/dashboard/days14</code>,{" "}
          <code>/api/orders/latest</code> etc.).
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// ANEXO: Guia de Integração (comentários, não interferem na build)
// ----------------------------------------------------------------------------
// 1) Conectando ao Backend
//    - Substitua `generateMockData()` por consultas reais usando fetch/axios.
//    - Sugestão de endpoints (GET):
//        /api/dashboard/days14        -> DailyPoint[]
//        /api/dashboard/categories    -> CategoryPoint[]
//        /api/dashboard/payments      -> PaymentSlice[]
//        /api/orders/latest?limit=16  -> OrderRow[]
//    - Exemplo simples com fetch (dentro do componente):
//
//      const [loading, setLoading] = useState(true);
//      const [err, setErr] = useState<string | null>(null);
//      const [ds, setDs] = useState<{days14:DailyPoint[], categoryData:CategoryPoint[], payments:PaymentSlice[], lastOrders:OrderRow[]}|null>(null);
//
//      useEffect(() => {
//        (async () => {
//          try {
//            const [a, b, c, d] = await Promise.all([
//              fetch("/api/dashboard/days14").then(r => r.json()),
//              fetch("/api/dashboard/categories").then(r => r.json()),
//              fetch("/api/dashboard/payments").then(r => r.json()),
//              fetch("/api/orders/latest?limit=16").then(r => r.json()),
//            ]);
//            setDs({ days14: a, categoryData: b, payments: c, lastOrders: d });
//          } catch (e:any) {
//            setErr(e?.message ?? "Erro ao carregar dados");
//          } finally {
//            setLoading(false);
//          }
//        })();
//      }, []);
//
//      if (loading) return <div className="p-6">Carregando…</div>;
//      if (err)     return <div className="p-6 text-rose-600">Erro: {err}</div>;
//
//      // ...e então renderize os gráficos usando `ds`.
//
// ----------------------------------------------------------------------------
// 2) Acessibilidade & Responsividade
//    - Todos os cards usam paddings e tipografia amigáveis.
//    - Gráficos em <ResponsiveContainer> escalam automaticamente.
//    - Tabela com scroll horizontal quando a viewport é estreita.
//
// ----------------------------------------------------------------------------
// 3) Ajustes Visuais
//    - Cores nos gráficos vêm de COLORS[]. Customize à vontade.
//    - Para usar tokens do Tailwind (se você definiu brand-* no tailwind.config.js),
//      troque classes como text-emerald-900 por text-brand-900, etc.
//
// ----------------------------------------------------------------------------
// 4) Boas Práticas
//    - Mantenha a tipagem dos dados vinda da API aderente aos tipos locais.
//    - Formatação de valores consolidada (BRL, porcentagens).
//    - Lembre-se de tratar cenários de dados vazios (arrays.length === 0).
//
// ----------------------------------------------------------------------------
// 5) Testes Rápidos
//    - Propositalmente usamos seed fixa em makeRng para permitir snapshot
//      visual consistente durante o desenvolvimento.
//    - Se quiser variação, troque a seed em generateMockData().
//
// ----------------------------------------------------------------------------
// 6) Extensões Futuras
//    - Filtrar por período (7/14/30 dias) — basta refazer queries e recalcular
//      KPIs e séries.
//    - Comparativos YoY/MoM — adicionar mais séries e linhas de referência.
//    - Drill-down por categoria/canal — novas páginas ou modais.
//
// ----------------------------------------------------------------------------
// Fim do guia
// ============================================================================