import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type OrdersResponse, type OrderRow } from "../../lib/api";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function ptDate(ymd: string) {
  const [y,m,d] = ymd.split("-").map(Number);
  return new Date(y, m-1, d).toLocaleDateString("pt-BR");
}

const STATUSES = ["pago","pendente","cancelado","enviado"] as const;

export default function Pedidos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [params, setParams] = useState({
    page: 1,
    pageSize: 20,
    q: "",
    status: "",
    category: "",
    dateFrom: "",
    dateTo: "",
    sort: "createdAt:desc",
  });
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    if (data && Array.isArray(data.items)) {
      data.items.forEach(i => i.category && set.add(i.category));
    }
    return Array.from(set).sort();
  }, [data]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);
    api.listOrders(params)
      .then((res) => {
        console.log('Frontend response from api.listOrders:', res);
        if (mounted) setData(res);
      })
      .catch((e) => {
        console.error('Frontend error from api.listOrders:', e);
        if (mounted) setErr(e.message || "Erro");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [JSON.stringify(params)]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const exportCsv = async () => {
    const r = await api.exportOrdersCsv(params);
    if (!r.ok) {
      alert("Falha ao exportar CSV.");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pedidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (orderId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este pedido? Essa ação não poderá ser desfeita.")) {
      try {
        setLoading(true);
        setErr(null);
        await api.deleteOrder(orderId); 
        // Após a chamada da API, atualizamos o estado para remover o pedido da lista
        setData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            items: prevData.items.filter(order => order.fullId !== orderId),
            total: prevData.total - 1,
          };
        });
      } catch (e: any) {
        setErr(e.message || "Erro ao excluir pedido.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-brand-900">Pedidos</h1>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-white p-4 rounded-xl border border-gray-200">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Busca</label>
          <input
            value={params.q}
            onChange={e => setParams(p => ({ ...p, page:1, q: e.target.value }))}
            placeholder="Cliente ou ID..."
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Status</label>
          <select
            value={params.status}
            onChange={e => setParams(p => ({ ...p, page:1, status: e.target.value }))}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Todos</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Categoria</label>
          <input
            value={params.category}
            onChange={e => setParams(p => ({ ...p, page:1, category: e.target.value }))}
            placeholder="Categoria exata"
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">De</label>
          <input
            type="date"
            value={params.dateFrom}
            onChange={e => setParams(p => ({ ...p, page:1, dateFrom: e.target.value }))}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Até</label>
          <input
            type="date"
            value={params.dateTo}
            onChange={e => setParams(p => ({ ...p, page:1, dateTo: e.target.value }))}
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-600">Ordenação</label>
          <select
            value={params.sort}
            onChange={e => setParams(p => ({ ...p, page:1, sort: e.target.value }))}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="dateDesc">Data ↓</option>
            <option value="dateAsc">Data ↑</option>
            <option value="valueDesc">Valor ↓</option>
            <option value="valueAsc">Valor ↑</option>
            <option value="clientAsc">Cliente A→Z</option>
            <option value="clientDesc">Cliente Z→A</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Itens por página</label>
          <select
            value={params.pageSize}
            onChange={e => setParams(p => ({ ...p, page:1, pageSize: Number(e.target.value) }))}
            className="w-full border rounded-md px-3 py-2"
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="md:col-span-3 md:justify-self-end">
          <button onClick={exportCsv} className="px-4 py-2 rounded-md bg-brand-700 text-white hover:bg-brand-800">
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      {loading && <div className="text-center p-4">Carregando pedidos…</div>}
      {err && <div className="text-center p-4 text-red-600">Erro: {err}</div>}
      {!loading && !err && (!data || !Array.isArray(data.items) || data.items.length === 0) && (
        <div className="text-center p-4">Nenhum pedido encontrado.</div>
      )}

      {!loading && !err && data && Array.isArray(data.items) && data.items.length > 0 && (
        <div className="overflow-auto bg-white rounded-xl border border-gray-200">
          <table className="min-w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Data</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">ID</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Categoria</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Valor</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>{ptDate(o.createdAt)}</td>
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>{o.id}</td>
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>{o.client}</td>
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>{o.category}</td>
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>
                    <span className={[
                      "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                      o.status === "pago" ? "bg-green-100 text-green-700" :
                      o.status === "pendente" ? "bg-yellow-100 text-yellow-700" :
                      o.status === "cancelado" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    ].join(" ")}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 cursor-pointer" onClick={() => navigate(`/dashboard/pedidos/${o.fullId}`)}>{brl(o.total)}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Impede que o clique na linha navegue para os detalhes
                        handleDelete(o.fullId);
                      }}
                      className="px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {!loading && !err && data && Array.isArray(data.items) && data.items.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {data.page} de {totalPages} — {data.total} pedidos
          </div>
          <div className="space-x-2">
            <button
              disabled={params.page <= 1}
              onClick={() => setParams(p => ({ ...p, page: p.page - 1 }))}
              className="px-3 py-2 rounded-md border disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              disabled={params.page >= totalPages}
              onClick={() => setParams(p => ({ ...p, page: p.page + 1 }))}
              className="px-3 py-2 rounded-md border disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      </div>
  );
}
