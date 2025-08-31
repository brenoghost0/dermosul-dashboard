import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, OrderRow } from '../../lib/api';

// Helper to format values in BRL
const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pedidos() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.listOrders();
        if (response && Array.isArray(response.items)) {
          setOrders(response.items);
        } else {
          setOrders([]);
        }
      } catch (err: any) {
        console.error("Erro ao carregar pedidos:", err);
        setError("Falha ao carregar a lista de pedidos.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return <div className="p-6">Carregando lista de pedidos…</div>;
  }

  if (error) {
    return <div className="p-6 text-rose-600">Erro: {error}</div>;
  }

  return (
    <div className="p-2 md:p-3 lg:p-4">
      <h1 className="text-xl md:text-2xl font-bold text-emerald-900 mb-4">
        Lista de Pedidos
      </h1>

      {orders.length > 0 ? (
        <div className="overflow-x-auto bg-white border border-zinc-200 rounded-2xl shadow-sm">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-3">ID do Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => (
                <tr
                  key={order.id}
                  className={`text-sm border-t border-zinc-100 ${
                    idx % 2 ? "bg-zinc-50/30" : "bg-white"
                  }`}
                >
                  <td className="py-2 pr-3 font-mono text-emerald-900">{order.id}</td>
                  <td className="py-2 pr-3">{order.client}</td>
                  <td className="py-2 pr-3">
                    {new Date(order.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3">{BRL(order.total)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        order.status === "pago"
                          ? "bg-emerald-50 text-emerald-700"
                          : order.status === "pendente"
                          ? "bg-amber-50 text-amber-700"
                          : order.status === "enviado"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <Link
                      to={`/dashboard/pedidos/${order.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Ver Detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-zinc-600">Nenhum pedido encontrado.</p>
      )}
    </div>
  );
}
