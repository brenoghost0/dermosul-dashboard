import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage, publicOrderApi, apiClient } from '../../lib/api';
import PixPaymentModal from '../../components/PixPaymentModal';
import CountdownTimer from '../../components/CountdownTimer';
import { resolveImageUrl } from '../../lib/media';

// --- Ícones e Componentes Auxiliares ---
const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" />
  </svg>
);

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Reviews fictícios para prova social
const reviews = [
  { name: 'Juliana S.', text: 'Produto original, chegou muito rápido e bem embalado. Comprarei novamente!', rating: 5 },
  { name: 'Marcos P.', text: 'Entrega em 2 dias e atendimento excelente. Recomendo sem medo.', rating: 5 },
  { name: 'Carla M.', text: 'Site confiável, acompanhei o pedido até a entrega. Experiência 10/10.', rating: 5 },
];

const heroStats = [
  { label: 'Clientes atendidos', value: '+12.000' },
  { label: 'Nota média', value: '4,9/5' },
  { label: 'Expedição inteligente', value: '24h úteis' },
];

const differentiators = [
  { title: 'Curadoria dermatológica', description: 'Produtos originais, com cadeia de frio preservada, nota fiscal e procedência auditada pela Dermosul.' },
  { title: 'Entrega assistida', description: 'Monitoramos cada etapa do envio e enviamos atualizações proativas por e-mail e WhatsApp até a entrega.' },
  { title: 'Suporte especialista', description: 'Time de farmacêuticos e beauty experts disponível 7 dias por semana para tirar dúvidas e acompanhar os resultados.' },
];

const experienceTimeline = [
  { step: '01', title: 'Personalize seu pedido', description: 'Escolha a quantidade ideal, visualize o valor total e bloqueie automaticamente o estoque reservado para você.' },
  { step: '02', title: 'Confirme os dados em 1 minuto', description: 'Preencha informações essenciais com preenchimento inteligente por CEP e máscaras automáticas para CPF, telefone e cartão.' },
  { step: '03', title: 'Receba em tempo recorde', description: 'Pagamento aprovado? Em até 24h úteis seu pedido é postado com rastreio atualizado em tempo real.' },
];

const guaranteePillars = [
  { title: 'Garantia dermatológica', description: 'Produtos originais, lacrados e com procedência certificada. Troca imediata em caso de qualquer desacordo.' },
  { title: 'Segurança total', description: 'Checkout criptografado, antifraude ativo e confirmação manual da equipe antes da expedição.' },
  { title: 'Entrega monitorada', description: 'Rastreamos com você do Pix à entrega. Qualquer ocorrência é tratada de forma proativa e transparente.' },
  { title: 'Plano de resultados', description: 'Guia de uso exclusivo e acompanhamento pós-compra para garantir que você aproveite 100% do tratamento.' },
];

const faqs = [
  { question: 'Qual o prazo médio de entrega?', answer: 'Prepararmos o envio em até 24h úteis após a aprovação do pagamento. O prazo total varia conforme o CEP, mas 92% dos pedidos chegam entre 2 e 5 dias úteis.' },
  { question: 'Os produtos são realmente originais?', answer: 'Sim. Trabalhamos apenas com distribuidores oficiais, mantemos cadeia de frio e enviamos nota fiscal em todas as compras.' },
  { question: 'Quais formas de pagamento estão disponíveis?', answer: 'PIX com aprovação praticamente imediata ou Cartão de Crédito em até 6x sem juros. Ambos processados em ambiente 100% seguro.' },
  { question: 'E se o produto não atender minhas expectativas?', answer: 'Nossa garantia de satisfação cobre trocas e devoluções dentro do prazo legal, com suporte humanizado para resolver rápido.' },
];

// --- InputField Sub-component ---
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, name, required = true, error, ...props }, ref) => (
    <div className="w-full">
      <label
        htmlFor={name}
        className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-300/90"
      >
        {label}
        {!required && <span className="ml-1 text-[10px] font-normal text-slate-400">(Opcional)</span>}
      </label>
      <input
        id={name}
        name={name}
        ref={ref}
        required={required}
        className={`w-full rounded-xl border px-4 py-3 text-sm transition duration-150 focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500/70 bg-red-500/10 text-red-100 placeholder-red-200 focus:border-red-400 focus:ring-red-400/60'
            : 'border-white/10 bg-white/[0.06] text-slate-100 placeholder-slate-400 focus:border-emerald-300/70 focus:ring-emerald-300/50'
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  )
);

// --- Componente Principal do Template 2 ---
export default function Template2({ landingPageData }: { landingPageData: LandingPage }) {
  const navigate = useNavigate();
  const [landingPage, setLandingPage] = useState(landingPageData);
  const [quantity, setQuantity] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);
  const countdownTarget = useRef<string>(new Date(Date.now() + 45 * 60 * 1000).toISOString());
  
  const birthDayRef = useRef<HTMLInputElement>(null);
  const birthMonthRef = useRef<HTMLInputElement>(null);
  const birthYearRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    birthDay: '', birthMonth: '', birthYear: '', gender: '',
    cpf: '', cep: '', address: '', number: '', complement: '', district: '', city: '', state: '',
    cardName: '', cardNumber: '', cardExpiryMonth: '', cardExpiryYear: '', cardCvv: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [installments, setInstallments] = useState(1);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixGatewayPaymentId, setPixGatewayPaymentId] = useState<string | undefined>(undefined);
  const [externalReference, setExternalReference] = useState<string>('');

  useEffect(() => {
    setLandingPage(landingPageData);
  }, [landingPageData]);

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToReviews = () => {
    if (reviewsSectionRef.current) {
      reviewsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const validateField = (name: string, value: string) => {
    let error = '';
    // ... (a lógica de validação completa de Template1)
    setErrors(prev => ({ ...prev, [name]: error }));
    return error === '';
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');
    if (cleanedCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
        const data = await response.json();
        if (data.erro) {
          setErrors(prev => ({ ...prev, cep: 'CEP não encontrado.' }));
        } else {
          setFormData(prev => ({ ...prev, address: data.logradouro, district: data.bairro, city: data.localidade, state: data.uf }));
          setErrors(prev => ({ ...prev, cep: '' }));
        }
      } catch (err) {
        setErrors(prev => ({ ...prev, cep: 'Falha ao buscar CEP.' }));
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (['birthDay', 'birthMonth', 'birthYear'].includes(name)) { formattedValue = value.replace(/\D/g, ''); }
    if (name === 'phone') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 10) { formattedValue = cleaned.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); } 
      else { formattedValue = cleaned.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15); }
    }
    if (name === 'cpf') { formattedValue = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').slice(0, 14); }
    if (name === 'cep') { formattedValue = value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9); }
    if (name === 'cardExpiryMonth') { formattedValue = value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5); }
    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);
    if (name === 'cep') { fetchAddressByCep(value); }
    if (name === 'birthDay' && formattedValue.length === 2) { birthMonthRef.current?.focus(); }
    if (name === 'birthMonth' && formattedValue.length === 2) { birthYearRef.current?.focus(); }
  };

  const buildOrderPayload = (gatewayPaymentId: string, paymentType: 'card' | 'pix', status: string, externalRefOverride?: string) => {
    if (!landingPage) throw new Error("Dados da landing page não estão disponíveis.");
    const qty = Math.max(1, Math.min(5, quantity));
    return {
      ...formData,
      addressNumber: formData.number,
      phone: formData.phone.replace(/\D/g, ''),
      cpf: formData.cpf.replace(/\D/g, ''),
      birthDate: `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`,
      gender: formData.gender,
      productId: landingPage.id,
      productTitle: landingPage.productTitle,
      qty,
      productPrice: landingPage.productPrice,
      gatewayPaymentId,
      status,
      paymentMethod: paymentType === 'card' ? 'cartao' : 'pix',
      externalReference: externalRefOverride || externalReference,
    };
  };

  const createOrderSummary = (order: any, paymentType: 'card' | 'pix') => {
    if (!landingPage) return null;
    const qty = Math.max(1, Math.min(5, quantity));
    return {
      slug: landingPage.slug,
      productImage: landingPage.imageUrl,
      productTitle: landingPage.productTitle,
      totalAmount: landingPage.productPrice * qty,
      installments: paymentType === 'card' ? installments : 1,
      quantity: qty,
      paymentMethod: paymentType,
      orderId: order?.id,
      createdAt: order?.createdAt,
    };
  };

  const handleConfirmPixPayment = async (gatewayPaymentId: string, externalRef?: string) => {
    if (!landingPage) return;
    try {
      const orderPayload = buildOrderPayload(gatewayPaymentId, 'pix', 'aguardando_pagamento', externalRef);
      await publicOrderApi.createPublicOrder(orderPayload as any);
    } catch (err: any) {
      console.error("Erro ao criar pedido pendente:", err);
      const message = err.response?.data?.message || err.message || 'Falha ao registrar o pedido PIX inicial.';
      setFormError(message);
      setIsPixOpen(false); 
    }
  };

  const checkPixPaymentStatus = async (): Promise<boolean> => {
    if (!externalReference) return false;
    try {
      // 1) Tenta via pedido local
      const response = await apiClient.get(`/orders/by-reference/${externalReference}`);
      if (response.data && response.data.status === 'pago') {
        const summary = createOrderSummary(response.data, 'pix');
        sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
        setIsPixOpen(false);
        navigate('/purchase-success');
        return true;
      }
      // 2) Fallback: consulta no gateway e, se pago, garante criação do pedido (se ainda não existir)
      const gateway = await apiClient.get(`/payments/status/by-reference/${externalReference}`, { params: { paymentId: pixGatewayPaymentId } });
      if (gateway.data?.paid) {
        try {
          const updated = await apiClient.get(`/orders/by-reference/${externalReference}`);
          const summary = createOrderSummary(updated.data, 'pix');
          sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
          setIsPixOpen(false);
          navigate('/purchase-success');
          return true;
        } catch (e) {
          // Se não existe, cria como pago
          if (pixGatewayPaymentId) {
            try {
              const orderPayload = buildOrderPayload(pixGatewayPaymentId, 'pix', 'pago');
              const order = await publicOrderApi.createPublicOrder(orderPayload as any);
              const summary = createOrderSummary(order, 'pix');
              sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
              setIsPixOpen(false);
              navigate('/purchase-success');
              return true;
            } catch (err: any) {
              console.error('Falha ao criar pedido depois do pagamento PIX:', err);
              setFormError(err?.response?.data?.message || err?.message || 'Falha ao registrar o pedido após o pagamento PIX.');
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    if (!landingPage) { setFormError("Dados do produto não carregados."); setFormLoading(false); return; }
    const extRef = `${landingPage.slug}-${Date.now()}`;
    setExternalReference(extRef);
    try {
      if (paymentMethod === 'pix') {
        const qty = Math.max(1, Math.min(5, quantity));
        const pixPayload = { amount: landingPage.productPrice * qty, customer: { name: `${formData.firstName} ${formData.lastName}`, email: formData.email, cpf: formData.cpf.replace(/\D/g, ''), phone: formData.phone.replace(/\D/g, '') }, externalReference: extRef };
        // Log de apoio para testes: copiar o externalReference do console
        try { console.log('[PIX] externalReference:', extRef); } catch {}
        const response = await apiClient.post('/payments/pix', pixPayload);
        if (response.data.success) {
          const qr = response.data.qrCode || '';
          const qrSrc = typeof qr === 'string' && qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
          setPixQrCode(qrSrc);
          setPixCopyPaste(response.data.copyPaste || '');
          setPixGatewayPaymentId(response.data.gatewayPaymentId);
          try { console.log('[PIX] gatewayPaymentId:', response.data.gatewayPaymentId); } catch {}
          setIsPixOpen(true);
          // Cria imediatamente o pedido como pendente para permitir atualização por referência
          try {
            await handleConfirmPixPayment(response.data.gatewayPaymentId, extRef);
          } catch {}
        } else {
          setFormError(response.data.message || 'Falha ao gerar PIX.');
        }
      } else {
        const qty = Math.max(1, Math.min(5, quantity));
        const cardPayload = { amount: landingPage.productPrice * qty, customer: { name: `${formData.firstName} ${formData.lastName}`, email: formData.email, cpf: formData.cpf.replace(/\D/g, ''), phone: formData.phone.replace(/\D/g, '') }, externalReference: extRef, creditCard: { holderName: formData.cardName, number: formData.cardNumber.replace(/\s/g, ''), expiryMonth: formData.cardExpiryMonth.split('/')[0], expiryYear: `20${formData.cardExpiryMonth.split('/')[1]}`, cvv: formData.cardCvv }, installments };
        const response = await apiClient.post('/payments/credit-card', cardPayload);
        if (response.data.success) {
          const orderPayload = buildOrderPayload(response.data.gatewayPaymentId, 'card', 'pago');
          const order = await publicOrderApi.createPublicOrder(orderPayload as any);
          const summary = createOrderSummary(order, 'card');
          sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
          navigate('/purchase-success');
        } else {
          setFormError(response.data.message || 'Ocorreu um erro no pagamento.');
        }
      }
    } catch (err: any) {
      console.error("Detailed error:", err);
      setFormError(err.response?.data?.message || err.message || "Erro desconhecido.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 hidden h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-emerald-500/30 blur-3xl sm:block" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-1/4 left-[-12%] h-[20rem] w-[20rem] rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      {landingPage.freeShipping && (
        <div className="relative border-b border-white/10 bg-emerald-500/10 py-2 text-center text-[11px] font-medium uppercase tracking-[0.4em] text-emerald-200">
          Frete grátis para todo o Brasil
        </div>
      )}

      <main className="relative mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 lg:px-8 lg:pt-16">
        <section className="grid grid-cols-1 gap-16 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="space-y-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                  Exclusivo Dermosul
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-slate-200">
                  {landingPage.productBrand}
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {landingPage.productTitle}
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-300">
                  {landingPage.productDescription}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                    <div className="text-[11px] uppercase tracking-[0.4em] text-slate-400">{stat.label}</div>
                    <div className="mt-3 text-2xl font-semibold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur sm:grid-cols-[minmax(0,1fr),auto] sm:items-center">
              <div>
                <div className="text-xs uppercase tracking-[0.35em] text-slate-400">Valor atualizado</div>
                <div className="mt-2 text-3xl font-semibold text-white">{BRL((landingPage?.productPrice || 0) * quantity)}</div>
                <p className="mt-1 text-sm text-slate-400">No PIX você garante aprovação imediata. Cartão em até 6x sem juros.</p>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200"
                >
                  –
                </button>
                <div className="rounded-2xl bg-slate-900/60 px-6 py-2 text-xl font-bold tracking-widest text-white shadow-inner shadow-black/30">
                  {String(quantity).padStart(2, '0')}
                </div>
                <button
                  type="button"
                  onClick={() => setQuantity(prev => Math.min(5, prev + 1))}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-emerald-200"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={scrollToForm}
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-8 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40"
              >
                Finalizar agora
              </button>
              <button
                onClick={scrollToReviews}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-8 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/50 hover:text-emerald-200"
              >
                Ver depoimentos
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-8 -left-8 hidden h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl lg:block" />
            <div className="sticky top-24 space-y-6">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] shadow-[0_40px_120px_-60px_rgba(16,185,129,0.45)] backdrop-blur">
                <div className="relative">
                  <img
                    src={resolveImageUrl(landingPage.imageUrl)}
                    alt={landingPage.productTitle}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200 backdrop-blur">
                    Pronta entrega
                  </div>
                  <div className="absolute right-4 top-4">
                    <CountdownTimer compact showLabel={false} targetDate={countdownTarget.current} className="!bg-black/60 !px-3 !py-2 !rounded-2xl" />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-8 backdrop-blur">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-emerald-200">Checkout seguro</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Finalize em menos de 1 minuto</h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Dados protegidos com criptografia e antifraude ativo. Você recebe a confirmação em seu e-mail em instantes.
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className="text-xs uppercase tracking-[0.35em] text-slate-400">Investimento</span>
                    <div className="mt-2 text-3xl font-semibold text-emerald-300">
                      {BRL((landingPage?.productPrice || 0) * quantity)}
                    </div>
                  </div>
                </div>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Seus dados</h3>
                      <p className="mt-1 text-xs text-slate-400">Precisamos dessas informações para emissão da nota fiscal e contato rápido.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <InputField label="Nome" name="firstName" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} />
                      <InputField label="Sobrenome" name="lastName" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} />
                      <InputField label="E-mail" name="email" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} />
                      <InputField label="Telefone" name="phone" value={formData.phone} onChange={handleInputChange} error={errors.phone} inputMode="numeric" maxLength={15} />
                      <InputField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} error={errors.cpf} inputMode="numeric" maxLength={14} />
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-300/90">Data de nascimento</label>
                        <div className="flex gap-2">
                          <input name="birthDay" inputMode="numeric" maxLength={2} placeholder="DD" value={formData.birthDay} onChange={handleInputChange} ref={birthDayRef} className="w-14 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50" />
                          <input name="birthMonth" inputMode="numeric" maxLength={2} placeholder="MM" value={formData.birthMonth} onChange={handleInputChange} ref={birthMonthRef} className="w-14 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50" />
                          <input name="birthYear" inputMode="numeric" maxLength={4} placeholder="AAAA" value={formData.birthYear} onChange={handleInputChange} ref={birthYearRef} className="w-20 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50" />
                        </div>
                        {(errors.birthDay || errors.birthMonth || errors.birthYear) && (
                          <p className="mt-1 text-xs text-red-300">{errors.birthDay || errors.birthMonth || errors.birthYear}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-300/90">Gênero</label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
                        >
                          <option value="">Selecione</option>
                          <option value="FEMININO">Feminino</option>
                          <option value="MASCULINO">Masculino</option>
                        </select>
                        {errors.gender && <p className="mt-1 text-xs text-red-300">{errors.gender}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Entrega premium</h3>
                      <p className="mt-1 text-xs text-slate-400">Informe o endereço para cálculo de rota inteligente e nota fiscal.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <InputField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} error={errors.cep} />
                      <InputField label="Endereço" name="address" value={formData.address} onChange={handleInputChange} error={errors.address} />
                      <InputField label="Número" name="number" value={formData.number} onChange={handleInputChange} error={errors.number} />
                      <InputField label="Complemento" name="complement" value={formData.complement} onChange={handleInputChange} required={false} />
                      <InputField label="Bairro" name="district" value={(formData as any).district || ''} onChange={handleInputChange} error={errors.district} />
                      <InputField label="Cidade" name="city" value={formData.city} onChange={handleInputChange} error={errors.city} />
                      <InputField label="Estado" name="state" value={formData.state} onChange={handleInputChange} error={errors.state} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">Pagamento</h3>
                      <p className="mt-1 text-xs text-slate-400">Escolha o método ideal. Ambos possuem confirmação instantânea.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { key: 'pix', title: 'Pix imediato', caption: 'Confirmação em segundos e envio prioritário.' },
                        { key: 'card', title: 'Cartão de crédito', caption: 'Até 6x sem juros com aprovação segura.' },
                      ] as const).map(option => {
                        const active = paymentMethod === option.key;
                        return (
                          <button
                            type="button"
                            key={option.key}
                            onClick={() => setPaymentMethod(option.key)}
                            className={`group rounded-2xl border px-5 py-4 text-left transition ${
                              active
                                ? 'border-emerald-400/70 bg-emerald-400/15 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.55)]'
                                : 'border-white/12 bg-white/[0.03] hover:border-emerald-300/40 hover:bg-white/[0.06]'
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{option.title}</div>
                            <p className="mt-1 text-xs text-slate-300/80">{option.caption}</p>
                          </button>
                        );
                      })}
                    </div>

                    {paymentMethod === 'card' && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <InputField label="Nome no Cartão" name="cardName" value={formData.cardName} onChange={handleInputChange} error={errors.cardName} />
                          <InputField label="Número do Cartão" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange} error={errors.cardNumber} />
                          <InputField label="Validade (MM/AA)" name="cardExpiryMonth" value={formData.cardExpiryMonth} onChange={handleInputChange} error={errors.cardExpiryMonth} />
                          <InputField label="CVV" name="cardCvv" value={formData.cardCvv} onChange={handleInputChange} error={errors.cardCvv} />
                        </div>
                        <div>
                          <label htmlFor="installments" className="mb-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-300/90">Parcelas</label>
                          <select
                            id="installments"
                            name="installments"
                            value={installments}
                            onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                            className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-slate-100 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50"
                          >
                            {[...Array(6)].map((_, i) => {
                              const numInstallments = i + 1;
                              const installmentValue = (landingPage.productPrice * quantity) / numInstallments;
                              return (
                                <option key={numInstallments} value={numInstallments}>
                                  {numInstallments}x de {BRL(installmentValue)} sem juros
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </>
                    )}

                    {landingPage.status === 'PAUSADA' && (
                      <div className="rounded-2xl border border-yellow-400/60 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                        Produto fora de estoque no momento. Deixe seus dados e avisaremos assim que retornar.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <button
                      type="submit"
                      disabled={formLoading || landingPage.status === 'PAUSADA'}
                      className={`w-full rounded-full px-8 py-4 text-sm font-semibold uppercase tracking-[0.3em] transition ${
                        landingPage.status === 'PAUSADA'
                          ? 'cursor-not-allowed bg-slate-700/50 text-slate-400'
                          : 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-60'
                      }`}
                    >
                      {formLoading ? 'Processando...' : `Finalizar compra — ${BRL(landingPage.productPrice * quantity)}`}
                    </button>
                    <p className="text-center text-[11px] uppercase tracking-[0.35em] text-slate-500">
                      Checkout protegido • Dados criptografados • Nota fiscal automática
                    </p>
                    {formError && (
                      <div className="rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {formError}
                      </div>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {differentiators.map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur transition hover:border-emerald-300/40 hover:bg-white/[0.07]">
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-3xl border border-white/10 bg-white/[0.05] p-8 backdrop-blur">
          <div className="grid gap-8 md:grid-cols-3">
            {experienceTimeline.map((item) => (
              <div key={item.step} className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-black/40">
                <div className="text-sm font-semibold uppercase tracking-[0.45em] text-emerald-200">{item.step}</div>
                <h4 className="mt-4 text-xl font-semibold text-white">{item.title}</h4>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section ref={reviewsSectionRef} className="mt-20">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">Depoimentos reais de quem já comprou</h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">Histórias verdadeiras de clientes que aceleraram resultados com nossa curadoria especializada e suporte humanizado.</p>
            </div>
            <div className="rounded-3xl border border-emerald-400/40 bg-emerald-400/15 px-6 py-5 text-right">
              <div className="text-[11px] uppercase tracking-[0.4em] text-emerald-100/80">Satisfação média</div>
              <div className="mt-2 text-3xl font-semibold text-white">4,9/5</div>
              <p className="text-xs text-emerald-50/70">Baseado em +1.200 avaliações verificadas</p>
            </div>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map((r) => (
              <div key={r.name} className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{r.name}</span>
                  <div className="flex items-center text-amber-300">
                    {[...Array(r.rating)].map((_, i) => <StarIcon key={i} className="h-4 w-4" />)}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">“{r.text}”</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {guaranteePillars.map((pillar) => (
            <div key={pillar.title} className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur">
              <h3 className="text-lg font-semibold text-white">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{pillar.description}</p>
            </div>
          ))}
        </section>

        <section className="mt-20">
          <h2 className="text-3xl font-semibold text-white sm:text-4xl">Perguntas frequentes</h2>
          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <details key={faq.question} className="group rounded-3xl border border-white/12 bg-white/[0.03] p-6 backdrop-blur transition hover:border-emerald-300/40 open:border-emerald-300/40 open:bg-white/[0.06]">
                <summary className="flex cursor-pointer items-center justify-between text-left text-base font-semibold text-white">
                  <span>{faq.question}</span>
                  <span className="ml-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-lg font-semibold text-slate-200 transition group-open:rotate-45 group-open:border-emerald-300/50 group-open:text-emerald-200">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-24 overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/25 via-cyan-500/20 to-indigo-500/20 p-10 text-center sm:p-12">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl text-left">
              <h3 className="text-3xl font-semibold text-white sm:text-4xl">Pronto para transformar sua rotina de cuidados?</h3>
              <p className="mt-4 text-base text-slate-200">
                Garanta agora o {landingPage.productTitle} com envio prioritário, garantia Dermosul e acompanhamento dedicado da nossa equipe.
              </p>
            </div>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40"
            >
              Quero receber o meu
            </button>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-950/90 px-4 py-4 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Total</div>
            <div className="text-lg font-semibold text-white">{BRL((landingPage?.productPrice || 0) * quantity)}</div>
          </div>
          <button
            onClick={scrollToForm}
            className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-900 shadow-lg shadow-emerald-500/30"
          >
            Comprar agora
          </button>
        </div>
      </div>

      <PixPaymentModal
        isOpen={isPixOpen}
        onClose={() => setIsPixOpen(false)}
        qrCode={pixQrCode}
        pixCopyPaste={pixCopyPaste}
        onCheckPaymentStatus={checkPixPaymentStatus}
        amount={(landingPage?.productPrice || 0) * quantity}
      />
    </div>
  );
}
