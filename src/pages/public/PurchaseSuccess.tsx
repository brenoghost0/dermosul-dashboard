import React, { useEffect, useState } from 'react';
import { resolveImageUrl } from '../../lib/media';
import { Link, useNavigate } from 'react-router-dom';

type OrderSummary = {
  slug?: string;
  productImage?: string;
  productTitle?: string;
  totalAmount?: number;
  installments?: number;
  quantity?: number;
  paymentMethod?: 'pix' | 'cartao' | 'boleto';
  orderId?: string;
  createdAt?: string;
};

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PurchaseSuccessPage() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lastOrderSummary');
      if (raw) setSummary(JSON.parse(raw));
    } catch {}
  }, []);

  const total = summary?.totalAmount ?? 0;
  const installments = Math.max(1, summary?.installments ?? 1);
  const perInstallment = installments > 0 ? total / installments : total;

  return (
    <div className="min-h-screen bg-[#f7f5ef] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 sm:p-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-green-700">Pagamento Aprovado ✅</h1>
          <p className="mt-3 text-zinc-600 max-w-2xl mx-auto">
            Obrigado pela sua compra! Seus dados foram registrados com sucesso e você será notificado por e-mail a cada atualização do status do pedido.
          </p>
        </div>

        {/* Order Info Card */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start bg-zinc-50 border border-zinc-200 rounded-xl p-4 sm:p-6 mb-8">
          <div className="w-full sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-white border border-zinc-200 flex items-center justify-center">
            {summary?.productImage ? (
              <img src={resolveImageUrl(summary.productImage)} alt={summary.productTitle || 'Produto'} className="object-contain w-full h-full" />
            ) : (
              <div className="text-zinc-400 text-sm">Imagem</div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-zinc-500">Pedido {summary?.orderId ? `#${summary.orderId}` : ''}</p>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 mt-1">{summary?.productTitle || 'Produto'}</h2>
            <div className="mt-2 text-zinc-700 font-medium">
              {installments > 1
                ? (
                  <>
                    Total: {BRL(total)} | {installments}x de {BRL(perInstallment)} sem juros
                  </>
                ) : (
                  <>Total: {BRL(total)} | 1x sem juros</>
                )}
              {summary?.quantity ? <span className="text-zinc-500"> • Qtd: {summary.quantity}</span> : null}
            </div>
            {summary?.paymentMethod && (
              <div className="mt-1 text-sm text-zinc-500">Pagamento: {summary.paymentMethod.toUpperCase()}</div>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {['Pagamento Aprovado', 'Preparando Pedido', 'Enviado', 'Concluído'].map((label, idx) => {
              const isActive = idx === 0; // primeira etapa concluída
              return (
                <div key={label} className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-green-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                    {idx + 1}
                  </div>
                  <span className={`mt-2 text-xs sm:text-sm ${isActive ? 'text-green-700 font-semibold' : 'text-zinc-600'}`}>{label}</span>
                </div>
              );
            })}
          </div>
          {/* Connecting bar */}
          <div className="relative mt-4 h-1 bg-zinc-200 rounded">
            <div className="absolute left-0 top-0 h-1 bg-green-600 rounded" style={{ width: '25%' }} />
          </div>
          <p className="mt-3 text-center text-zinc-600 text-sm">Você receberá e-mails conforme avançarmos para as próximas etapas.</p>
        </div>

        
      </div>
    </div>
  );
}
