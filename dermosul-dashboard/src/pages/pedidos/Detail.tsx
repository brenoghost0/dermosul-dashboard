import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, OrderDetail } from '../../lib/api';

// Helper to format values in BRL
const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Detail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderDetail['status'] | ''>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("ID do pedido não fornecido.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      setSaveMessage(null);
      try {
        const fetchedOrder = await api.getOrderById(id);
        setOrder(fetchedOrder);
        setStatus(fetchedOrder.status);
      } catch (err: any) {
        console.error("Erro ao carregar pedido:", err);
        if (err.message && err.message.includes("Order not found")) {
          setError("Pedido não encontrado.");
        } else {
          setError("Falha ao carregar os detalhes do pedido.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value as OrderDetail['status']);
  };

  const handleSaveStatus = async () => {
    if (!id || !status) return;

    setSaveMessage(null);
    try {
      const updatedOrder = await api.updateOrderStatus(id, status);
      setOrder(updatedOrder);
      setSaveMessage("Status salvo com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar status:", err);
      setSaveMessage("Erro ao salvar status.");
    }
  };

  if (loading) {
    return <div className="p-6">Carregando detalhes do pedido…</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-rose-600">
        <p>{error}</p>
        <button
          onClick={() => navigate('/dashboard/pedidos')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Voltar para a lista de pedidos
        </button>
      </div>
    );
  }

  if (!order) {
    return <div className="p-6 text-zinc-600">Nenhum pedido encontrado.</div>;
  }

  return (
    <div className="p-2 md:p-3 lg:p-4">
      <h1 className="text-xl md:text-2xl font-bold text-emerald-900 mb-4">
        Detalhes do Pedido: {order.id}
      </h1>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Informações do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><strong>Nome:</strong> {order.customer.firstName} {order.customer.lastName}</div>
          <div><strong>CPF:</strong> {order.customer.cpf}</div>
          <div><strong>Email:</strong> {order.customer.email}</div>
          <div><strong>Telefone:</strong> {order.customer.phone}</div>
          <div><strong>Data de Nascimento:</strong> {order.customer.birthdate}</div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Endereço de Entrega</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><strong>CEP:</strong> {order.shipping.zip}</div>
          <div><strong>Endereço:</strong> {order.shipping.address}, {order.shipping.number} {order.shipping.complement}</div>
          <div><strong>Bairro:</strong> {order.shipping.district}</div>
          <div><strong>Cidade/UF:</strong> {order.shipping.city}/{order.shipping.state}</div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Status do Pedido</h2>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={handleStatusChange}
            className="border border-zinc-300 rounded-md p-2"
          >
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="enviado">Enviado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <button
            onClick={handleSaveStatus}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            Salvar Status
          </button>
          {saveMessage && <span className="text-sm text-zinc-600">{saveMessage}</span>}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5 mb-4">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Itens do Pedido</h2>
        {order.items && order.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Produto</th>
                  <th className="py-2 pr-3">Qtd</th>
                  <th className="py-2 pr-3">Preço Unit.</th>
                  <th className="py-2 pr-3">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => (
                  <tr key={idx} className={`text-sm border-t border-zinc-100 ${idx % 2 ? "bg-zinc-50/30" : "bg-white"}`}>
                    <td className="py-2 pr-3">{item.sku}</td>
                    <td className="py-2 pr-3">{item.name}</td>
                    <td className="py-2 pr-3">{item.qty}</td>
                    <td className="py-2 pr-3">{BRL(item.price)}</td>
                    <td className="py-2 pr-3">{BRL(item.qty * item.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-600">Sem itens neste pedido.</p>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-4 md:p-5">
        <h2 className="text-lg font-semibold text-zinc-800 mb-3">Resumo do Pagamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><strong>Subtotal:</strong> {BRL(order.summary.subTotal)}</div>
          <div><strong>Desconto:</strong> {BRL(order.summary.discount)}</div>
          <div><strong>Frete:</strong> {BRL(order.summary.shipping)}</div>
          <div><strong>Total:</strong> {BRL(order.summary.total)}</div>
        </div>
        <div className="mt-3">
          <strong>Métodos de Pagamento:</strong>
          {order.payments && order.payments.length > 0 ? (
            <ul className="list-disc list-inside ml-4">
              {order.payments.map((payment, idx) => (
                <li key={idx}>{payment.method}: {BRL(payment.value)}</li>
              ))}
            </ul>
          ) : (
            <span> Nenhum método de pagamento registrado.</span>
          )}
        </div>
      </div>
    </div>
  );
}
