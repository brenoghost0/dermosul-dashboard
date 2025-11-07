import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage, apiClient, publicOrderApi } from '../../lib/api';
import PixPaymentModal from '../../components/PixPaymentModal';
import { resolveImageUrl } from '../../lib/media';
import CountdownTimer from '../../components/CountdownTimer';
import logoDermosul from '../../assets/logo-dermosul.png';

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Step = 'produto' | 'dados' | 'pagamento';

type Theme = 'dark' | 'light';

export default function Template3({ landingPageData, theme = 'dark' }: { landingPageData: LandingPage; theme?: Theme }) {
  const navigate = useNavigate();
  const [landingPage, setLandingPage] = useState<LandingPage>(landingPageData);
  const [step, setStep] = useState<Step>('produto');
  const countdownTarget = useRef<string>(new Date(Date.now() + 45 * 60 * 1000).toISOString());

  // Etapa 1 — seleção de quantidade (com desconto progressivo)
  const [qty, setQty] = useState(1);
  const discountPercent = useMemo(() => {
    if (qty >= 3) return 10; // 10% para 3 un
    if (qty === 2) return 5; // 5% para 2 un
    return 0;
  }, [qty]);
  const unitPrice = landingPage.productPrice || 0;
  const subtotal = useMemo(() => unitPrice * qty, [unitPrice, qty]);
  const discountValue = useMemo(() => Math.round(subtotal * (discountPercent / 100)), [subtotal, discountPercent]);
  const total = useMemo(() => Math.max(subtotal - discountValue, 0), [subtotal, discountValue]);

  // Etapa 2 — dados pessoais
  const birthDayRef = useRef<HTMLInputElement>(null);
  const birthMonthRef = useRef<HTMLInputElement>(null);
  const birthYearRef = useRef<HTMLInputElement>(null);
  const dadosRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    birthDay: '', birthMonth: '', birthYear: '', gender: '',
    cpf: '', cep: '', address: '', number: '', complement: '', district: '', city: '', state: '',
    cardName: '', cardNumber: '', cardExpiryMonth: '', cardExpiryYear: '', cardCvv: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- Máscaras ---
  const maskCpf = (digits: string) => {
    const d = digits.slice(0, 11);
    return d
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };
  const maskCep = (digits: string) => {
    const d = digits.slice(0, 8);
    return d.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2');
  };
  const maskPhone = (digits: string) => {
    const d = digits.slice(0, 11);
    const only = d.replace(/\D/g, '');
    if (only.length <= 10) {
      return only.replace(/(\d{2})(\d{4})(\d)/, '($1) $2-$3');
    }
    return only.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const validateField = (name: string, value: string) => {
    let error = '';
    if (name === 'email' && !/\S+@\S+\.\S+/.test(value)) error = 'E-mail inválido.';
    if (name === 'phone') {
      const s = value.replace(/\D/g, '');
      if (s.length < 10 || s.length > 11) error = 'Telefone inválido.';
    }
    if (name === 'cpf') {
      const s = value.replace(/\D/g, '');
      if (s.length !== 11 || /(\d)\1{10}/.test(s)) error = 'CPF inválido.';
    }
    if (name === 'birthDay' || name === 'birthMonth' || name === 'birthYear') {
      const dd = name === 'birthDay' ? value : formData.birthDay;
      const mm = name === 'birthMonth' ? value : formData.birthMonth;
      const yy = name === 'birthYear' ? value : formData.birthYear;
      if (dd && (Number(dd) < 1 || Number(dd) > 31)) error = 'Dia inválido.';
      if (mm && (Number(mm) < 1 || Number(mm) > 12)) error = 'Mês inválido.';
      if (yy && (yy.length !== 4 || Number(yy) < 1900)) error = 'Ano inválido.';
      if (dd && mm && yy && yy.length === 4) {
        const d = new Date(Number(yy), Number(mm) - 1, Number(dd));
        if (d.getFullYear() !== Number(yy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) error = 'Data inválida.';
      }
    }
    setErrors(prev => ({ ...prev, [name]: error }));
    return error === '';
  };

  const fetchAddressByCep = async (cep: string) => {
    const s = cep.replace(/\D/g, '');
    if (s.length === 8) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${s}/json/`);
        const data = await r.json();
        if (!data.erro) {
          setFormData(prev => ({ ...prev, address: data.logradouro || '', district: data.bairro || '', city: data.localidade || '', state: data.uf || '' }));
          setErrors(prev => ({ ...prev, cep: '' }));
        } else {
          setErrors(prev => ({ ...prev, cep: 'CEP não encontrado.' }));
        }
      } catch {
        setErrors(prev => ({ ...prev, cep: 'Falha ao buscar CEP.' }));
      }
    }
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let v = value;
    if (name === 'birthDay' || name === 'birthMonth' || name === 'birthYear') v = value.replace(/\D/g, '');
    if (name === 'cpf') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      v = maskCpf(digits);
    }
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '').slice(0, 11);
      v = maskPhone(digits);
    }
    if (name === 'cep') {
      const digits = value.replace(/\D/g, '').slice(0, 8);
      v = maskCep(digits);
    }
    setFormData(p => ({ ...p, [name]: v }));
    validateField(name, v);
    if (name === 'cep') fetchAddressByCep(v);
    if (name === 'birthDay' && v.length === 2) birthMonthRef.current?.focus();
    if (name === 'birthMonth' && v.length === 2) birthYearRef.current?.focus();
  };

  // Etapa 3 — pagamento
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixGatewayPaymentId, setPixGatewayPaymentId] = useState<string | undefined>(undefined);
  const [externalReference, setExternalReference] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [installments, setInstallments] = useState(1);

  useEffect(() => { setLandingPage(landingPageData); }, [landingPageData]);

  const buildOrderPayload = (gatewayPaymentId: string, pType: 'card' | 'pix', status: string, extRef?: string) => {
    const birthDate = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;
    const q = Math.max(1, qty);
    // Preço unitário efetivo (após desconto), para que totalAmount = unit * qty no backend
    const unitPrice = Math.round((total * 100) / q) / 100;
    return {
      ...formData,
      addressNumber: formData.number,
      phone: formData.phone.replace(/\D/g, ''),
      cpf: formData.cpf.replace(/\D/g, ''),
      birthDate,
      productId: landingPage.id,
      productTitle: landingPage.productTitle,
      qty: q,
      productPrice: unitPrice, // enviar preço unitário para o backend
      gatewayPaymentId,
      status,
      paymentMethod: pType === 'card' ? 'cartao' : 'pix',
      externalReference: extRef || externalReference,
    } as any;
  };

  const createOrderSummary = (order: any, pType: 'card' | 'pix') => ({
    slug: landingPage.slug,
    productImage: landingPage.imageUrl,
    productTitle: landingPage.productTitle,
    totalAmount: total,
    installments: pType === 'card' ? installments : 1,
    quantity: qty,
    paymentMethod: pType,
    orderId: order?.id,
    createdAt: order?.createdAt,
  });

  const handleGeneratePix = async () => {
    setFormLoading(true);
    setFormError(null);
    const extRef = `${landingPage.slug}-${Date.now()}`;
    setExternalReference(extRef);
    try {
      const payload = {
        amount: total,
        customer: {
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
        },
        externalReference: extRef,
      };
      try { console.log('[PIX] externalReference:', extRef); } catch {}
      const r = await apiClient.post('/payments/pix', payload);
      if (r.data?.success) {
        const qr = r.data.qrCode || '';
        const qrSrc = typeof qr === 'string' && qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
        setPixQrCode(qrSrc);
        setPixCopyPaste(r.data.copyPaste || '');
        setPixGatewayPaymentId(r.data.gatewayPaymentId);
        try { console.log('[PIX] gatewayPaymentId:', r.data.gatewayPaymentId); } catch {}
        setIsPixOpen(true);
        // cria pedido aguardando_pagamento imediatamente
        try { await publicOrderApi.createPublicOrder(buildOrderPayload(r.data.gatewayPaymentId, 'pix', 'aguardando_pagamento', extRef) as any); } catch {}
      } else {
        setFormError(r.data?.message || 'Falha ao gerar PIX.');
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Erro ao gerar PIX.');
    } finally { setFormLoading(false); }
  };

  const checkPixPaymentStatus = async (): Promise<boolean> => {
    if (!externalReference) return false;
    try {
      // checa no banco
      const local = await apiClient.get(`/orders/by-reference/${externalReference}`);
      if (local.data && local.data.status === 'pago') {
        const summary = createOrderSummary(local.data, 'pix');
        sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
        setIsPixOpen(false);
        navigate('/purchase-success');
        return true;
      }
      // checa no gateway com paymentId
      const gw = await apiClient.get(`/payments/status/by-reference/${externalReference}`, { params: { paymentId: pixGatewayPaymentId } });
      if (gw.data?.paid) {
        try {
          const updated = await apiClient.get(`/orders/by-reference/${externalReference}`);
          const summary = createOrderSummary(updated.data, 'pix');
          sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
          setIsPixOpen(false);
          navigate('/purchase-success');
          return true;
        } catch {
          if (pixGatewayPaymentId) {
            try {
              const created = await publicOrderApi.createPublicOrder(buildOrderPayload(pixGatewayPaymentId, 'pix', 'pago') as any);
              const summary = createOrderSummary(created, 'pix');
              sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
              setIsPixOpen(false);
              navigate('/purchase-success');
              return true;
            } catch (e) {
              console.error('Falha ao registrar pedido após PIX:', e);
            }
          }
        }
      }
      return false;
    } catch (e) {
      console.error('Erro ao verificar status:', e);
      return false;
    }
  };

  const handlePayCard = async () => {
    setFormLoading(true);
    setFormError(null);
    const extRef = `${landingPage.slug}-${Date.now()}`;
    setExternalReference(extRef);
    try {
      const payload: any = {
        amount: total,
        customer: {
          name: `${formData.firstName} ${formData.lastName}`,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
        },
        externalReference: extRef,
        creditCard: {
          holderName: formData.cardName,
          number: formData.cardNumber.replace(/\s/g, ''),
          expiryMonth: formData.cardExpiryMonth.split('/')[0],
          expiryYear: `20${formData.cardExpiryMonth.split('/')[1]}`,
          cvv: formData.cardCvv,
        },
        installments,
      };
      const r = await apiClient.post('/payments/credit-card', payload);
      if (r.data?.success) {
        const created = await publicOrderApi.createPublicOrder(buildOrderPayload(r.data.gatewayPaymentId, 'card', 'pago', extRef) as any);
        const summary = createOrderSummary(created, 'card');
        sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
        navigate('/purchase-success');
      } else {
        setFormError(r.data?.message || 'Ocorreu um erro no pagamento.');
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Erro desconhecido.');
    } finally { setFormLoading(false); }
  };

  // Renderização por etapas
  const th = theme === 'dark'
    ? {
        container: 'relative min-h-screen overflow-hidden bg-slate-950 text-slate-100',
        inner: 'relative mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 lg:px-8 lg:pt-20',
        panelBg: 'bg-white/[0.05] border border-white/10 backdrop-blur',
        border: 'border-white/10',
        textMuted: 'text-slate-300',
        textSubtle: 'text-slate-400',
        bannerBg: 'bg-emerald-500/15',
        progressInactive: 'bg-white/10',
        progressActive: 'bg-gradient-to-r from-emerald-400 to-cyan-400',
        footerBorder: 'border-white/10',
        pill: 'bg-white/[0.08] text-emerald-200',
      }
    : {
        container: 'relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800',
        inner: 'relative mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6 lg:px-8 lg:pt-20',
        panelBg: 'bg-white border border-slate-200 shadow-xl shadow-slate-900/5',
        border: 'border-slate-200',
        textMuted: 'text-slate-600',
        textSubtle: 'text-slate-500',
        bannerBg: 'bg-emerald-500/10',
        progressInactive: 'bg-slate-200',
        progressActive: 'bg-emerald-500',
        footerBorder: 'border-slate-200',
        pill: 'bg-emerald-500/10 text-emerald-600',
      };

  const goToDados = () => {
    setStep('dados');
    setTimeout(() => {
      try { dadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }, 0);
  };

  const stepsMeta: Array<{ key: Step; title: string; caption: string }> = [
    { key: 'produto', title: 'Produto', caption: 'Defina o kit perfeito' },
    { key: 'dados', title: 'Dados', caption: 'Preencha entrega e nota fiscal' },
    { key: 'pagamento', title: 'Pagamento', caption: 'Escolha a forma ideal' },
  ];
  const currentStepIndex = stepsMeta.findIndex(item => item.key === step);

  return (
    <div className={th.container}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -top-32 left-1/2 hidden h-[32rem] w-[32rem] -translate-x-1/2 rounded-full ${theme === 'dark' ? 'bg-emerald-500/30' : 'bg-emerald-400/20'} blur-3xl sm:block`} />
        <div className={`absolute bottom-[-22%] right-[-15%] h-[26rem] w-[26rem] rounded-full ${theme === 'dark' ? 'bg-cyan-500/25' : 'bg-cyan-400/15'} blur-3xl`} />
        <div className={`absolute top-1/3 left-[-12%] h-[20rem] w-[20rem] rounded-full ${theme === 'dark' ? 'bg-indigo-500/20' : 'bg-indigo-400/15'} blur-3xl`} />
      </div>

      <div className={th.inner}>
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img src={logoDermosul} alt="Dermosul" className="h-12 w-auto" />
            <span className={`rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${th.pill}`}>
              Checkout oficial Dermosul
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {landingPage.freeShipping && (
              <span className={`rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${th.pill}`}>
                Frete grátis para todo Brasil
              </span>
            )}
            <CountdownTimer compact showLabel={false} targetDate={countdownTarget.current} className={theme === 'dark' ? '!bg-white/10 !px-3 !py-1 !text-[11px]' : '!bg-slate-900/80 !text-white !px-3 !py-1 !text-[11px]'} />
          </div>
        </header>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stepsMeta.map((item, index) => {
            const reached = index <= currentStepIndex;
            const active = index === currentStepIndex;
            const cardActive = theme === 'dark'
              ? 'border-emerald-400/60 bg-emerald-400/15 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.5)]'
              : 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.35)]';
            const cardDefault = theme === 'dark'
              ? 'border-white/10 bg-white/[0.04]'
              : 'border-slate-200 bg-white';
            const numberActive = theme === 'dark'
              ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900'
              : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white';
            const numberIdle = theme === 'dark'
              ? 'border border-white/10 bg-white/[0.06] text-slate-300'
              : 'border border-slate-200 bg-slate-100 text-slate-600';
            return (
              <div
                key={item.key}
                className={`rounded-2xl px-5 py-4 transition ${reached ? cardActive : cardDefault}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${reached ? numberActive : numberIdle}`}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.3em]">{item.title}</div>
                    <p className={`text-xs ${th.textSubtle} ${active ? 'opacity-100' : 'opacity-80'}`}>{item.caption}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {step === 'produto' && (
          <section className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.05fr,0.95fr]">
            <div className={`${th.panelBg} relative overflow-hidden rounded-3xl p-6`}>
              <div className={`absolute -top-16 right-10 h-40 w-40 rounded-full ${theme === 'dark' ? 'bg-emerald-400/25' : 'bg-emerald-400/15'} blur-3xl`} aria-hidden />
              <div className={`absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] ${theme === 'dark' ? 'border-white/10 bg-white/10 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-600'} sm:text-xs`}>
                Pronta entrega
              </div>
              <div className="absolute right-6 top-6">
                <CountdownTimer compact showLabel={false} targetDate={countdownTarget.current} className={theme === 'dark' ? '!bg-black/60 !px-3 !py-2 !rounded-2xl' : '!bg-slate-900/80 !text-white !px-3 !py-2 !rounded-2xl'} />
              </div>
              <img src={resolveImageUrl(landingPage.imageUrl)} alt={landingPage.productTitle} className="relative z-10 mx-auto w-full max-w-md object-contain" />
            </div>
            <div className={`${th.panelBg} rounded-3xl p-6 lg:p-8`}>
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{landingPage.productTitle}</h1>
                <p className={`${th.textMuted} text-sm leading-relaxed`}>
                  {landingPage.productDescription}
                </p>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  'Envio em até 24h úteis',
                  'Produto original com nota fiscal',
                  'Suporte especialista 7 dias/semana',
                ].map((item) => (
                  <div
                    key={item}
                    className={`${theme === 'dark' ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'} rounded-2xl border px-4 py-3 text-sm font-medium`}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className={`mt-6 rounded-2xl border px-6 py-4 ${theme === 'dark' ? 'border-white/10 bg-white/[0.05]' : 'border-emerald-100 bg-emerald-50/80 text-emerald-800'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.35em] ${theme === 'dark' ? 'text-slate-300' : 'text-emerald-700'}`}>Investimento total</p>
                    <p className="mt-2 text-3xl font-semibold">{BRL(total)}</p>
                    {discountPercent > 0 && (
                      <p className={`text-xs ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-600'}`}>Desconto automático de {discountPercent}% já aplicado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold transition ${theme === 'dark' ? 'border border-white/10 bg-white/[0.04] text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200' : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-500'}`}
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      type="button"
                    >
                      –
                    </button>
                    <div className={`rounded-full px-6 py-2 text-xl font-semibold tracking-widest ${theme === 'dark' ? 'bg-slate-900/70 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                      {String(qty).padStart(2, '0')}
                    </div>
                    <button
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold transition ${theme === 'dark' ? 'border border-white/10 bg-white/[0.04] text-slate-200 hover:border-emerald-400/60 hover:text-emerald-200' : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-500'}`}
                      onClick={() => setQty(q => Math.min(5, q + 1))}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className={`mt-3 text-xs ${th.textSubtle}`}>
                  Parcelamento em até 6x sem juros no cartão ou aprovação instantânea no Pix.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goToDados}
                  className={`w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40' : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40'}`}
                >
                  Continuar
                </button>
                <p className={`${th.textSubtle} text-xs sm:ml-4`}>
                  Pagamento seguro • Estoque reservado por 15 minutos
                </p>
              </div>
            </div>
          </section>
        )}

        {step === 'dados' && (
          <section ref={dadosRef} className={`${th.panelBg} rounded-3xl border ${th.border} p-6 lg:p-8`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Dados pessoais e de entrega</h2>
                <p className={`text-sm ${th.textSubtle}`}>Preencha com atenção para emissão da nota fiscal e expedição sem atritos.</p>
              </div>
              {formError && <div className="rounded-full border border-red-400/60 bg-red-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-red-200">{formError}</div>}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input theme={theme} label="Nome" name="firstName" value={formData.firstName} onChange={onInput} error={errors.firstName} />
              <Input theme={theme} label="Sobrenome" name="lastName" value={formData.lastName} onChange={onInput} error={errors.lastName} />
              <Input theme={theme} label="E-mail" name="email" type="email" value={formData.email} onChange={onInput} error={errors.email} />
              <Input theme={theme} label="Telefone" name="phone" value={formData.phone} onChange={onInput} error={errors.phone} inputMode="numeric" maxLength={15} />
              <Input theme={theme} label="CPF" name="cpf" value={formData.cpf} onChange={onInput} error={errors.cpf} inputMode="numeric" maxLength={14} />
              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.28em] ${th.textSubtle}`}>Data de nascimento</label>
                <div className="flex gap-2">
                  <input name="birthDay" placeholder="DD" maxLength={2} value={formData.birthDay} onChange={onInput} ref={birthDayRef} className={`w-16 rounded-xl px-3 py-3 text-sm ${theme === 'dark' ? 'border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50' : 'border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40'}`} inputMode="numeric" />
                  <input name="birthMonth" placeholder="MM" maxLength={2} value={formData.birthMonth} onChange={onInput} ref={birthMonthRef} className={`w-16 rounded-xl px-3 py-3 text-sm ${theme === 'dark' ? 'border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50' : 'border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40'}`} inputMode="numeric" />
                  <input name="birthYear" placeholder="AAAA" maxLength={4} value={formData.birthYear} onChange={onInput} ref={birthYearRef} className={`w-24 rounded-xl px-3 py-3 text-sm ${theme === 'dark' ? 'border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50' : 'border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40'}`} inputMode="numeric" />
                </div>
                {(errors.birthDay || errors.birthMonth || errors.birthYear) && <div className="mt-1 text-xs text-red-300">{errors.birthDay || errors.birthMonth || errors.birthYear}</div>}
              </div>
              <div>
                <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.28em] ${th.textSubtle}`}>Gênero</label>
                <select name="gender" value={formData.gender} onChange={onInput} className={`w-full rounded-xl px-4 py-3 text-sm transition ${theme === 'dark' ? 'border border-white/10 bg-white/[0.06] text-white focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50' : 'border border-slate-200 bg-white text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40'}`}>
                  <option value="">Selecione</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASCULINO">Masculino</option>
                </select>
                {errors.gender && <div className="mt-1 text-xs text-red-300">{errors.gender}</div>}
              </div>
              <Input theme={theme} label="CEP" name="cep" value={formData.cep} onChange={onInput} error={errors.cep} inputMode="numeric" maxLength={9} />
              <Input theme={theme} label="Endereço" name="address" value={formData.address} onChange={onInput} error={errors.address} />
              <Input theme={theme} label="Número" name="number" value={formData.number} onChange={onInput} error={errors.number} />
              <Input theme={theme} label="Complemento" name="complement" value={formData.complement} onChange={onInput} required={false} />
              <Input theme={theme} label="Bairro" name="district" value={formData.district} onChange={onInput} error={errors.district} />
              <Input theme={theme} label="Cidade" name="city" value={formData.city} onChange={onInput} error={errors.city} />
              <Input theme={theme} label="Estado" name="state" value={formData.state} onChange={onInput} error={errors.state} />
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => setStep('produto')}
                className={`w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'border border-white/15 bg-white/[0.04] text-slate-200 hover:border-emerald-300/50 hover:text-emerald-200' : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-500'}`}
              >
                Voltar
              </button>
              <button
                onClick={() => setStep('pagamento')}
                className={`w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40' : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30'}`}
              >
                Continuar
              </button>
            </div>
          </section>
        )}

        {step === 'pagamento' && (
          <section className={`${th.panelBg} rounded-3xl border ${th.border} p-6 lg:p-8`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Pagamento</h2>
                <p className={`text-sm ${th.textSubtle}`}>Resumo: {qty} un • Desconto {discountPercent}% • Total {BRL(total)}</p>
              </div>
              {formError && <div className="rounded-full border border-red-400/60 bg-red-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-red-200">{formError}</div>}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {([
                { key: 'pix', title: 'Pix imediato', caption: 'Aprovação em segundos e liberação prioritária.' },
                { key: 'card', title: 'Cartão de crédito', caption: 'Parcele em até 6x sem juros com antifraude.' },
              ] as const).map(option => {
                const active = paymentMethod === option.key;
                const activeCls = theme === 'dark'
                  ? 'border-emerald-400/60 bg-emerald-400/15 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.5)]'
                  : 'border-emerald-500/40 bg-emerald-500/10 shadow-[0_20px_60px_-30px_rgba(16,185,129,0.35)]';
                const inactiveCls = theme === 'dark'
                  ? 'border-white/12 bg-white/[0.03] hover:border-emerald-300/40 hover:bg-white/[0.06]'
                  : 'border-slate-200 bg-white hover:border-emerald-400/40 hover:bg-emerald-50/40';
                return (
                  <button
                    type="button"
                    key={option.key}
                    onClick={() => setPaymentMethod(option.key)}
                    className={`flex flex-col gap-1 rounded-2xl border px-5 py-4 text-left transition ${active ? activeCls : inactiveCls}`}
                  >
                    <span className="text-sm font-semibold uppercase tracking-[0.3em]">{option.title}</span>
                    <span className={`text-xs ${th.textSubtle}`}>{option.caption}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {paymentMethod === 'pix' ? (
                <div className={`rounded-2xl border px-6 py-6 ${theme === 'dark' ? 'border-white/12 bg-white/[0.05]' : 'border-emerald-100 bg-emerald-50/80 text-emerald-800'}`}>
                  <p className={`text-sm ${th.textMuted}`}>
                    Geraremos um QR Code Pix com o valor total. Depois de confirmar o pagamento no seu banco, validamos automaticamente e seguimos para a expedição expressa.
                  </p>
                  <ul className={`mt-3 space-y-2 text-xs ${th.textSubtle}`}>
                    <li>• Válido por 15 minutos.</li>
                    <li>• Confirmamos em segundos e você recebe a nota fiscal por e-mail.</li>
                  </ul>
                  <button
                    disabled={formLoading}
                    onClick={handleGeneratePix}
                    className={`mt-4 w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-60' : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-60'}`}
                  >
                    Gerar QR Code Pix
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input theme={theme} label="Nome no Cartão" name="cardName" value={formData.cardName} onChange={onInput} error={errors.cardName} />
                  <Input theme={theme} label="Número do Cartão" name="cardNumber" value={formData.cardNumber} onChange={onInput} error={errors.cardNumber} />
                  <Input theme={theme} label="Validade (MM/AA)" name="cardExpiryMonth" value={formData.cardExpiryMonth} onChange={onInput} error={errors.cardExpiryMonth} />
                  <Input theme={theme} label="CVV" name="cardCvv" value={formData.cardCvv} onChange={onInput} error={errors.cardCvv} />
                  <div>
                    <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.28em] ${th.textSubtle}`}>Parcelas</label>
                    <select
                      value={installments}
                      onChange={e => setInstallments(Number(e.target.value))}
                      className={`w-full rounded-xl px-4 py-3 text-sm transition ${theme === 'dark' ? 'border border-white/10 bg-white/[0.06] text-white focus:border-emerald-300/70 focus:outline-none focus:ring-2 focus:ring-emerald-300/50' : 'border border-slate-200 bg-white text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40'}`}
                    >
                      {[1,2,3,4,5,6].map(n => (
                        <option key={n} value={n}>{`${n}x sem juros`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button
                      disabled={formLoading}
                      onClick={handlePayCard}
                      className={`w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 shadow-lg shadow-emerald-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/40 disabled:opacity-60' : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-60'}`}
                    >
                      Pagar com cartão
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={() => setStep('dados')}
                className={`w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] transition ${theme === 'dark' ? 'border border-white/15 bg-white/[0.04] text-slate-200 hover:border-emerald-300/50 hover:text-emerald-200' : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:text-emerald-500'}`}
              >
                Voltar
              </button>
            </div>
          </section>
        )}

        <section className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={`${th.panelBg} rounded-3xl border ${th.border} p-6 lg:p-8`}>
            <h3 className="text-2xl font-semibold">O que nossos clientes dizem</h3>
            <p className={`mt-2 text-sm ${th.textSubtle}`}>Confiança construída em milhares de pedidos entregues em todo o Brasil.</p>
            <ul className="mt-6 space-y-4">
              {[
                { name: 'Juliana S.', text: 'Produto original e entrega super rápida. Recomendo!' },
                { name: 'Marcos P.', text: 'Experiência excelente, comprarei novamente.' },
                { name: 'Carla M.', text: 'Acompanhamento por e-mail e produto impecável.' },
              ].map((r, i) => (
                <li key={i} className={`${theme === 'dark' ? 'border-white/12 bg-white/[0.04]' : 'border-slate-200 bg-white'} rounded-2xl border p-4`}>
                  <div className="text-amber-400 text-sm">★★★★★</div>
                  <p className={`mt-2 text-sm ${th.textMuted}`}>{r.text}</p>
                  <div className={`mt-2 text-xs ${th.textSubtle}`}>— {r.name}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${th.panelBg} rounded-3xl border ${th.border} p-6 lg:p-8`}>
            <h3 className="text-2xl font-semibold">Perguntas frequentes</h3>
            <div className="mt-6 space-y-4">
              {[
                { q: 'Qual o prazo de entrega?', a: 'Despachamos em até 24h úteis. O prazo médio varia de 2 a 7 dias conforme o CEP.' },
                { q: 'Os produtos são originais?', a: 'Sim. Trabalhamos apenas com distribuidores oficiais e enviamos nota fiscal em todas as compras.' },
                { q: 'Quais formas de pagamento estão disponíveis?', a: 'PIX com confirmação quase instantânea ou Cartão em até 6x sem juros.' },
                { q: 'E se eu tiver algum problema?', a: 'Garantia de entrega e suporte humanizado para qualquer necessidade.' },
              ].map((faq) => (
                <div key={faq.q}>
                  <div className="font-semibold">{faq.q}</div>
                  <p className={`mt-1 text-sm ${th.textMuted}`}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className={`mt-16 border-t ${th.footerBorder} py-6 text-center text-[11px] uppercase tracking-[0.35em] ${th.textSubtle}`}>
        Copyright © 2025 dermosul.com.br — Todos os direitos reservados.
      </footer>

      {/* Modal PIX */}
      <PixPaymentModal
        isOpen={isPixOpen}
        onClose={() => setIsPixOpen(false)}
        qrCode={pixQrCode}
        pixCopyPaste={pixCopyPaste}
        onCheckPaymentStatus={checkPixPaymentStatus}
        amount={total}
      />
    </div>
  );
}

function Input({ label, name, value, onChange, error, required = true, theme = 'dark', ...props }:{ label: string; name: string; value: any; onChange: any; error?: string; required?: boolean; theme?: 'dark'|'light'; [k: string]: any; }){
  const labelCls = theme === 'dark' ? 'text-slate-300' : 'text-slate-600';
  const base = theme === 'dark'
    ? 'border border-white/10 bg-white/[0.06] text-white placeholder-slate-500 focus:border-emerald-300/70 focus:ring-emerald-300/50'
    : 'border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:ring-emerald-300/40';
  const inputBase = error
    ? `${theme === 'dark'
        ? 'border-red-500/70 bg-red-500/10 text-red-100 placeholder-red-200 focus:border-red-400 focus:ring-red-400/60'
        : 'border-red-500/70 bg-red-50 text-red-700 placeholder-red-400 focus:border-red-400 focus:ring-red-300/40'}`
    : base;
  return (
    <div>
      <label className={`mb-2 block text-xs font-semibold uppercase tracking-[0.28em] ${labelCls}`}>
        {label}{!required && <span className="ml-1 text-[10px] font-normal text-slate-400">(Opcional)</span>}
      </label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        {...props}
        className={`w-full rounded-xl px-4 py-3 text-sm transition outline-none focus:ring-2 ${inputBase}`}
      />
      {error && <div className="mt-1 text-xs text-red-300">{error}</div>}
    </div>
  );
}
