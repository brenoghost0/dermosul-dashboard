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
        container: 'min-h-screen bg-[#0b0d10] text-white',
        panelBg: 'bg-[#12161a]',
        border: 'border-gray-800',
        textMuted: 'text-gray-300',
        textSubtle: 'text-gray-400',
        bannerBg: 'bg-emerald-600/90',
        progressInactive: 'bg-gray-700',
        progressActive: 'bg-emerald-500',
        footerBorder: 'border-gray-800',
      }
    : {
        container: 'min-h-screen bg-white text-zinc-800',
        panelBg: 'bg-white',
        border: 'border-gray-200',
        textMuted: 'text-gray-600',
        textSubtle: 'text-gray-500',
        bannerBg: 'bg-emerald-600',
        progressInactive: 'bg-gray-200',
        progressActive: 'bg-emerald-600',
        footerBorder: 'border-gray-200',
      };

  return (
    <div className={th.container}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header com logo centralizado e frete grátis */}
        <div className="mb-3">
          <img src={logoDermosul} alt="Dermosul" className="h-12 w-auto mx-auto" />
        </div>
        {landingPage.freeShipping && (
          <div className={`${th.bannerBg} text-white text-center text-xs sm:text-sm py-2 rounded mb-4`}>
            FRETE GRÁTIS PARA TODO BRASIL
          </div>
        )}

        {/* Barra de progresso */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {['Produto','Dados','Pagamento'].map((label, i) => (
            <div key={label} className={`h-2 rounded ${
              (step === 'produto' && i===0) || (step==='dados' && i<=1) || (step==='pagamento' && i<=2) ? th.progressActive : th.progressInactive
            }`} title={label} />
          ))}
        </div>

        {step === 'produto' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`${th.panelBg} rounded-xl p-4 border ${th.border} relative`}>
              <div className="absolute top-3 right-3">
                <CountdownTimer compact showLabel={false} targetDate={new Date(Date.now() + 40 * 60 * 1000).toISOString()} />
              </div>
              <img src={resolveImageUrl(landingPage.imageUrl)} alt={landingPage.productTitle} className="w-full h-auto object-contain rounded" />
            </div>
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">{landingPage.productTitle}</h1>
              <p className={th.textMuted}>{landingPage.productDescription}</p>
              <div className="space-y-2">
                <div className={`text-sm ${th.textSubtle}`}>Escolha a quantidade</div>
                <div className="flex gap-2">
                  {[1,2,3].map(n => (
                    <button
                      key={n}
                      onClick={() => setQty(n)}
                      className={`px-4 py-2 rounded border ${
                        qty === n
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : (theme === 'dark'
                              ? 'bg-[#12161a] border-gray-700 text-white'
                              : 'bg-white border-gray-300 text-zinc-800')
                      }`}
                    >
                      {n} un
                    </button>
                  ))}
                </div>
                <div className={`text-sm ${th.textSubtle}`}>Desconto: {discountPercent}%</div>
                <div className="text-lg">Subtotal: {BRL(subtotal)} {discountPercent>0 && (<span className="text-emerald-400 ml-2">- {BRL(discountValue)}</span>)} </div>
                <div className="text-2xl font-bold">Total: {BRL(total)}</div>
              </div>
              <button onClick={() => setStep('dados')} className="w-full md:w-auto mt-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold">Comprar agora</button>
            </div>
          </section>
        )}

        {step === 'dados' && (
          <section className={`${th.panelBg} rounded-xl p-6 border ${th.border}`}>
            <h2 className="text-xl font-bold mb-4">Dados Pessoais e de entrega</h2>
            {formError && <div className="mb-3 text-red-400">{formError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input theme={theme} label="Nome" name="firstName" value={formData.firstName} onChange={onInput} error={errors.firstName} />
              <Input theme={theme} label="Sobrenome" name="lastName" value={formData.lastName} onChange={onInput} error={errors.lastName} />
              <Input theme={theme} label="E-mail" name="email" type="email" value={formData.email} onChange={onInput} error={errors.email} />
              <Input theme={theme} label="Telefone" name="phone" value={formData.phone} onChange={onInput} error={errors.phone} inputMode="numeric" maxLength={15} />
              <Input theme={theme} label="CPF" name="cpf" value={formData.cpf} onChange={onInput} error={errors.cpf} inputMode="numeric" maxLength={14} />
              <div>
                <label className={`block text-sm ${th.textSubtle} mb-1`}>Data de Nascimento</label>
                <div className="flex gap-2">
                  <input name="birthDay" placeholder="DD" maxLength={2} value={formData.birthDay} onChange={onInput} ref={birthDayRef} className={`w-16 px-3 py-2 rounded ${theme==='dark'?'bg-[#0b0d10] border-gray-700':'bg-white border-gray-300'} border`} inputMode="numeric" />
                  <input name="birthMonth" placeholder="MM" maxLength={2} value={formData.birthMonth} onChange={onInput} ref={birthMonthRef} className={`w-16 px-3 py-2 rounded ${theme==='dark'?'bg-[#0b0d10] border-gray-700':'bg-white border-gray-300'} border`} inputMode="numeric" />
                  <input name="birthYear" placeholder="AAAA" maxLength={4} value={formData.birthYear} onChange={onInput} ref={birthYearRef} className={`w-24 px-3 py-2 rounded ${theme==='dark'?'bg-[#0b0d10] border-gray-700':'bg-white border-gray-300'} border`} inputMode="numeric" />
                </div>
                {(errors.birthDay || errors.birthMonth || errors.birthYear) && <div className="text-xs text-red-400 mt-1">{errors.birthDay || errors.birthMonth || errors.birthYear}</div>}
              </div>
              <div>
                <label className={`block text-sm ${th.textSubtle} mb-1`}>Gênero</label>
                <select name="gender" value={formData.gender} onChange={onInput} className={`w-full px-3 py-2 rounded ${theme==='dark'?'bg-[#0b0d10] border-gray-700':'bg-white border-gray-300'} border`}>
                  <option value="">Selecione</option>
                  <option value="FEMININO">Feminino</option>
                  <option value="MASCULINO">Masculino</option>
                </select>
                {errors.gender && <div className="text-xs text-red-400 mt-1">{errors.gender}</div>}
              </div>
              <Input theme={theme} label="CEP" name="cep" value={formData.cep} onChange={onInput} error={errors.cep} inputMode="numeric" maxLength={9} />
              <Input theme={theme} label="Endereço" name="address" value={formData.address} onChange={onInput} error={errors.address} />
              <Input theme={theme} label="Número" name="number" value={formData.number} onChange={onInput} error={errors.number} />
              <Input theme={theme} label="Complemento" name="complement" value={formData.complement} onChange={onInput} required={false} />
              <Input theme={theme} label="Bairro" name="district" value={formData.district} onChange={onInput} error={errors.district} />
              <Input theme={theme} label="Cidade" name="city" value={formData.city} onChange={onInput} error={errors.city} />
              <Input theme={theme} label="Estado" name="state" value={formData.state} onChange={onInput} error={errors.state} />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('produto')}
                className={`px-6 py-3 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                }`}
              >
                Voltar
              </button>
              <button onClick={() => setStep('pagamento')} className="px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white">Continuar</button>
            </div>
          </section>
        )}

        {step === 'pagamento' && (
          <section className={`${th.panelBg} rounded-xl p-6 border ${th.border}`}>
            <h2 className="text-xl font-bold mb-2">Pagamento</h2>
            {formError && <div className="mb-3 text-red-400">{formError}</div>}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`px-4 py-2 rounded border ${
                  paymentMethod === 'pix'
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : (theme === 'dark'
                        ? 'bg-[#0b0d10] border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-zinc-800')
                }`}
              >
                PIX
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`px-4 py-2 rounded border ${
                  paymentMethod === 'card'
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : (theme === 'dark'
                        ? 'bg-[#0b0d10] border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-zinc-800')
                }`}
              >
                Cartão
              </button>
            </div>

            <div className={`mb-4 ${th.textMuted}`}>Resumo: {qty} un • Desconto {discountPercent}% • Total {BRL(total)}</div>

            {paymentMethod === 'pix' ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Gere o QR Code e pague pelo seu banco. A confirmação costuma ocorrer em segundos.</p>
                <button disabled={formLoading} onClick={handleGeneratePix} className="px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70">Gerar QR Code PIX</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input theme={theme} label="Nome no Cartão" name="cardName" value={formData.cardName} onChange={onInput} error={errors.cardName} />
                <Input theme={theme} label="Número do Cartão" name="cardNumber" value={formData.cardNumber} onChange={onInput} error={errors.cardNumber} />
                <Input theme={theme} label="Validade (MM/AA)" name="cardExpiryMonth" value={formData.cardExpiryMonth} onChange={onInput} error={errors.cardExpiryMonth} />
                <Input theme={theme} label="CVV" name="cardCvv" value={formData.cardCvv} onChange={onInput} error={errors.cardCvv} />
                <div>
                  <label className={`block text-sm ${th.textSubtle} mb-1`}>Parcelas</label>
                  <select
                    value={installments}
                    onChange={e => setInstallments(Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded border ${
                      theme === 'dark'
                        ? 'bg-[#0b0d10] border-gray-700 text-white'
                        : 'bg-white border-gray-300 text-zinc-800'
                    }`}
                  >
                    {[1,2,3,4,5,6].map(n => (
                      <option key={n} value={n}>{`${n}x Sem juros`}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <button disabled={formLoading} onClick={handlePayCard} className="w-full px-6 py-3 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70">Pagar com Cartão</button>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep('dados')}
                className={`px-6 py-3 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
                }`}
              >
                Voltar
              </button>
            </div>
          </section>
        )}

        {/* Blocos extras: Avaliações e FAQ */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`${th.panelBg} rounded-xl p-6 border ${th.border}`}>
            <h3 className="text-lg font-bold mb-4">O que nossos clientes dizem</h3>
            <ul className="space-y-4">
              {[
                { name: 'Juliana S.', text: 'Produto original e entrega super rápida. Recomendo!' },
                { name: 'Marcos P.', text: 'Experiência excelente, comprarei novamente.' },
                { name: 'Carla M.', text: 'Acompanhamento por e-mail e produto impecável.' },
              ].map((r, i) => (
                <li key={i} className={`border ${th.border} rounded-lg p-3`}>
                  <div className="text-amber-400 text-sm">★★★★★</div>
                  <p className={`text-sm ${th.textMuted} mt-1`}>{r.text}</p>
                  <div className={`text-xs ${th.textSubtle} mt-1`}>— {r.name}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className={`${th.panelBg} rounded-xl p-6 border ${th.border}`}>
            <h3 className="text-lg font-bold mb-4">Perguntas frequentes</h3>
            <div className="space-y-4">
              <div>
                <div className="font-semibold">Qual o prazo de entrega?</div>
                <p className={`text-sm ${th.textMuted}`}>Enviamos em até 24h úteis. O prazo médio é de 2 a 7 dias, conforme a sua região.</p>
              </div>
              <div>
                <div className="font-semibold">O produto é original?</div>
                <p className={`text-sm ${th.textMuted}`}>100% original, com nota fiscal e garantia do fabricante.</p>
              </div>
              <div>
                <div className="font-semibold">Quais formas de pagamento?</div>
                <p className={`text-sm ${th.textMuted}`}>PIX (aprovação em segundos) ou Cartão em até 3x sem juros.</p>
              </div>
              <div>
                <div className="font-semibold">Tem garantia?</div>
                <p className={`text-sm ${th.textMuted}`}>Sim, garantia de entrega. Caso haja qualquer problema, você recebe suporte imediato.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Rodapé */}
      <footer className={`text-center ${th.textSubtle} text-sm mt-10 py-4 border-t ${th.footerBorder}`}>
        Copyright © 2025 dermosul.com.br. Todos os direitos reservados.
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
  const labelCls = theme === 'dark' ? 'text-gray-400' : 'text-zinc-600';
  const inputBase = theme === 'dark'
    ? `bg-[#0b0d10] border ${error ? 'border-red-500' : 'border-gray-700'} text-white`
    : `bg-white border ${error ? 'border-red-500' : 'border-gray-300'} text-zinc-800`;
  return (
    <div>
      <label className={`block text-sm ${labelCls} mb-1`}>{label}{!required && <span className="text-xs text-gray-500"> (Opcional)</span>}</label>
      <input name={name} value={value} onChange={onChange} {...props} className={`w-full px-3 py-2 rounded ${inputBase}`} />
      {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
    </div>
  );
}
