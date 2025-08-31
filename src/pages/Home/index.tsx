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
import { api, OverviewData, ConversionPoint, OrderRow, PaymentBreakdownItem, CategoryData } from "../../lib/api";

// ============================================================================
// Helpers (mantidos do mock, úteis para formatação)
// ============================================================================

const COLORS = ["#175544", "#1b6e5a", "#2aa874", "#8FD3C8", "#F6BD60"];
const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const fmtPercent = (n: number | undefined | null) =>
  Number.isFinite(n) ? `${(n as number).toFixed(2)}%` : '–';

// ============================================================================
// Componentes de UI (sem alteração)
// ============================================================================

type CardProps = { title?: string; children?: React.ReactNode; right?: React.ReactNode; className?: string; };
function ChartCard({ title, right, className, children }: CardProps) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        {title ? <h3 className="text-base md:text-lg font-semibold text-zinc-800">{title}</h3> : <div />}
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

type KpiCardProps = { label: string; value: string; hint?: string; };
function KpiCard({ label, value, hint }: KpiCardProps) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      {hint && <div className="text-sm text-zinc-500">{hint}</div>}
    </div>
  );
}

// ============================================================================
// Página: Home (agora conectada à API)
// ============================================================================

// ============================================================================
// Tipos de Dados para a Home (baseado em lib/api.ts)
// ============================================================================

type RevenueData = { date: string; revenue: number };

interface DashboardState {
  overview: OverviewData;
  revenueByDay: RevenueData[];
  ordersByCategory: CategoryData[];
  conversionByDay: ConversionPoint[];
  lastOrders: OrderRow[];
}

// ============================================================================
// Página: Home (agora conectada à API)
// ============================================================================

export default function Home() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        api.getOverview(),
        api.getRevenueByDay(),
        api.getOrdersByCategory(),
        api.getConversionByDay(),
        api.listOrders({ pageSize: 5, sort: 'createdAt:desc' }),
      ]);

      const [
        overviewResult,
        revenueResult,
        categoryResult,
        conversionResult,
        lastOrdersResult,
      ] = results;

      // Tratamento de erros e dados vazios
      if (overviewResult.status === 'rejected') {
        console.error("Falha ao buscar overview:", overviewResult.reason);
        setError("Não foi possível carregar os dados principais do dashboard.");
        setLoading(false);
        return;
      }

      const overview = overviewResult.value;

      const revenueByDay = revenueResult.status === 'fulfilled' && Array.isArray(revenueResult.value)
        ? revenueResult.value
        : [];
      
      const ordersByCategory = categoryResult.status === 'fulfilled' && Array.isArray(categoryResult.value)
        ? categoryResult.value
        : [];

      const conversionByDay = conversionResult.status === 'fulfilled' && Array.isArray(conversionResult.value)
        ? conversionResult.value
        : [];
      
      const lastOrders = lastOrdersResult.status === 'fulfilled' && Array.isArray(lastOrdersResult.value.items)
        ? lastOrdersResult.value.items
        : [];

      setData({
        overview: {
          totalRevenue: overview.totalRevenue || 0,
          totalOrders: overview.totalOrders || 0,
          avgTicket: overview.avgTicket || 0,
          convAvg: overview.convAvg || 0,
          paymentsBreakdown: overview.paymentsBreakdown || [],
        },
        revenueByDay,
        ordersByCategory,
        conversionByDay,
        lastOrders,
      });

      setLoading(false);
    };

    fetchData();
  }, []);

  // Prepara os dados para os gráficos usando useMemo para evitar recálculos
  const { revenueChartData, categoryChartData, paymentsChartData, conversionChartData } = useMemo(() => {
    if (!data) return { revenueChartData: [], categoryChartData: [], paymentsChartData: [], conversionChartData: [] };
    
    const paymentsData = Array.isArray(data.overview.paymentsBreakdown)
      ? data.overview.paymentsBreakdown
          .map(item => ({ method: item.method, value: item.amount }))
          .filter(item => item.value > 0)
      : [];

    return {
      revenueChartData: data.revenueByDay.map(d => ({ ...d, date: ddmm(d.date) })),
      categoryChartData: data.ordersByCategory,
      paymentsChartData: paymentsData,
      conversionChartData: data.conversionByDay.map(d => ({ ...d, date: ddmm(d.date) })),
    };
  }, [data]);

  if (loading) {
    return <div className="p-6 text-center">Carregando dados do dashboard...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Erro: {error}</div>;
  }

  if (!data) {
    return <div className="p-6 text-center">Nenhum dado para exibir.</div>;
  }

  const paymentMethodLabels: { [key: string]: string } = {
    pix: "Pix",
    cartao: "Cartão",
    boleto: "Boleto",
    desconhecido: "Desconhecido",
  };

  const pieLabel = (args: { name?: string; percent?: number }) => {
    const p = ((args.percent ?? 0) * 100).toFixed(0);
    return `${paymentMethodLabels[args.name || ''] || args.name} ${p}%`;
  };

  return (
    <div className="p-2 md:p-3 lg:p-4">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-emerald-900">Dermosul Dashboard</h1>
        <p className="text-zinc-600">Dados dos últimos 14 dias</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-4 lg:mb-6">
        <KpiCard label="Receita Total" value={BRL(data.overview.totalRevenue)} />
        <KpiCard label="Pedidos Realizados" value={data.overview.totalOrders.toLocaleString('pt-BR')} />
        <KpiCard label="Ticket Médio" value={BRL(data.overview.avgTicket)} />
        <KpiCard label="Conversão" value={fmtPercent(data.overview.convAvg)} hint="Média dos últimos 14 dias"/>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4 lg:mb-6">
        <ChartCard title="Receita por dia">
          <div className="h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#175544" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#175544" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                <Tooltip formatter={(v: number) => [BRL(v), "Receita"]} />
                <Area type="monotone" dataKey="revenue" stroke="#175544" fill="url(#revGradient)" name="Receita" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Pedidos por categoria">
          <div className="h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} interval={0} angle={-10} height={50} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [v.toLocaleString('pt-BR'), "Pedidos"]} />
                <Bar dataKey="value" name="Pedidos" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {data.ordersByCategory.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Métodos de pagamento (R$)">
          <div className="h-[260px] md:h-[300px]">
            {paymentsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v: number) => [BRL(v), "Valor"]} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => paymentMethodLabels[value] || value}
                  />
                  <Pie
                    data={paymentsChartData}
                    dataKey="value"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    labelLine={false}
                    label={pieLabel}
                  >
                    {paymentsChartData.map((_slice, i) => (
                      <Cell key={`p-${i}`} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                Sem dados de pagamento no período.
              </div>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Taxa de conversão (diária)">
          <div className="h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={conversionChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed?.(1) ?? v}%`} />
                <Tooltip formatter={(v: number) => fmtPercent(v)} />
                <Line type="monotone" dataKey="rate" name="Conversão" stroke="#175544" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
