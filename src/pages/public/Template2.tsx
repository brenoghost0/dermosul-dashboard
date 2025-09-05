import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage, publicOrderApi, apiClient } from '../../lib/api';
import PixPaymentModal from '../../components/PixPaymentModal';
import CountdownTimer from '../../components/CountdownTimer';
import logoDermosul from '../../assets/logo-dermosul.png';

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

// --- InputField Sub-component ---
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, name, required = true, error, ...props }, ref) => (
    <div className="w-full">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}{!required && <span className="text-xs text-gray-500"> (Opcional)</span>}</label>
      <input
        id={name}
        name={name}
        ref={ref}
        required={required}
        className={`w-full bg-gray-100 border rounded-md px-3 py-2 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'}`}
        {...props}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
);

// --- Componente Principal do Template 2 ---
export default function Template2({ landingPageData }: { landingPageData: LandingPage }) {
  const navigate = useNavigate();
  const [landingPage, setLandingPage] = useState(landingPageData);
  const [quantity, setQuantity] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  
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
    <div className="bg-brand-50 min-h-screen text-brand-800">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-center">
          <img src={logoDermosul} alt="Dermosul" className="h-12 w-auto" />
        </div>
        {landingPage.freeShipping && (
          <div className="bg-brand-600 text-white text-center text-xs sm:text-sm py-2">Frete grátis para todo o Brasil</div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-6">
            <div className="relative bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-card">
              {/* Timer sobre a imagem */}
              <div className="absolute top-3 right-3">
                <CountdownTimer compact showLabel={false} targetDate={new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()} />
              </div>
              <img src={landingPage.imageUrl} alt={landingPage.productTitle} className="w-full h-auto object-contain rounded-lg" />
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Entrega rápida', 'Produto original', 'Compra segura', 'Devolução fácil'].map((b) => (
                <div key={b} className="bg-white rounded-lg border border-gray-200 p-3 text-center text-xs sm:text-sm text-gray-600">
                  {b}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 lg:p-8 shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center text-amber-400">
                  {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-5 h-5" />)}
                </div>
                <span className="text-xs text-gray-500">Avaliação 4,9/5 (1.234)</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-brand-800">{landingPage.productTitle}</h1>
              <p className="mt-3 text-gray-600 leading-relaxed text-sm sm:text-base">{landingPage.productDescription}</p>

              <div className="mt-5 flex items-end justify-between">
                <div>
                  <span className="block text-xs text-gray-500">Preço</span>
                  <span className="block text-3xl sm:text-4xl font-extrabold text-brand-800">{BRL(landingPage.productPrice)}</span>
                </div>
                {/* Timer movido para cima da imagem */}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
                  <button type="button" disabled={landingPage.status === 'PAUSADA'} onClick={() => setQuantity(q => Math.max(1, q - 1))} className={`px-4 py-2 text-brand-800 ${landingPage.status === 'PAUSADA' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}>-</button>
                  <span className="px-6 py-2 font-semibold text-brand-800">{String(quantity).padStart(2, '0')}</span>
                  <button type="button" disabled={landingPage.status === 'PAUSADA'} onClick={() => setQuantity(q => Math.min(5, q + 1))} className={`px-4 py-2 text-brand-800 ${landingPage.status === 'PAUSADA' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}>+</button>
                </div>
                <button disabled={landingPage.status === 'PAUSADA'} onClick={scrollToForm} className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-lg shadow-card transition font-bold ${landingPage.status === 'PAUSADA' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}>
                  {landingPage.status === 'PAUSADA' ? 'Produto indisponível' : `Comprar agora — ${BRL((landingPage?.productPrice || 0) * quantity)}`}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> SSL protegido</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/> Estoque limitado</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-500"/> Entrega rápida</span>
              </div>
            </div>

            {/* Formulário */}
            <form ref={formRef} onSubmit={handleSubmit} className="mt-6 bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 lg:p-8 shadow-card">
              <h2 className="text-xl font-bold text-brand-800">Informações de contato</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="col-span-1"><InputField label="Nome" name="firstName" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} /></div>
                <div className="col-span-1"><InputField label="Sobrenome" name="lastName" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} /></div>
                <div className="col-span-1"><InputField label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} /></div>
                <div className="col-span-1"><InputField label="Telefone" name="phone" value={formData.phone} onChange={handleInputChange} error={errors.phone} /></div>
                <div className="col-span-1"><InputField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} error={errors.cpf} /></div>
                {/* Data de Nascimento */}
                <div className="col-span-1 lg:col-span-2 min-w-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input name="birthDay" inputMode="numeric" maxLength={2} placeholder="DD" value={formData.birthDay} onChange={handleInputChange} ref={birthDayRef} className="w-12 sm:w-14 bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input name="birthMonth" inputMode="numeric" maxLength={2} placeholder="MM" value={formData.birthMonth} onChange={handleInputChange} ref={birthMonthRef} className="w-12 sm:w-14 bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input name="birthYear" inputMode="numeric" maxLength={4} placeholder="AAAA" value={formData.birthYear} onChange={handleInputChange} ref={birthYearRef} className="w-16 md:w-20 bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  {errors.birthDay && <p className="text-red-600 text-xs mt-1">{errors.birthDay}</p>}
                  {errors.birthMonth && <p className="text-red-600 text-xs mt-1">{errors.birthMonth}</p>}
                  {errors.birthYear && <p className="text-red-600 text-xs mt-1">{errors.birthYear}</p>}
                </div>
                {/* Gênero */}
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecione</option>
                    <option value="FEMININO">Feminino</option>
                    <option value="MASCULINO">Masculino</option>
                  </select>
                  {errors.gender && <p className="text-red-600 text-xs mt-1">{errors.gender}</p>}
                </div>

                {/* Separador de entrega */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 pt-2">
                  <h3 className="text-lg font-semibold text-brand-800">Informações de entrega</h3>
                </div>

                <div className="col-span-1"><InputField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} error={errors.cep} /></div>
                <div className="sm:col-span-2 lg:col-span-3"><InputField label="Endereço" name="address" value={formData.address} onChange={handleInputChange} error={errors.address} /></div>
                <div className="col-span-1"><InputField label="Bairro" name="district" value={(formData as any).district || ''} onChange={handleInputChange} error={errors.district} /></div>
                <div className="col-span-1"><InputField label="Número" name="number" value={formData.number} onChange={handleInputChange} error={errors.number} /></div>
                <div className="col-span-1"><InputField label="Complemento" name="complement" value={formData.complement} onChange={handleInputChange} required={false} /></div>
                <div className="col-span-1"><InputField label="Estado" name="state" value={formData.state} onChange={handleInputChange} error={errors.state} /></div>
                <div className="col-span-1"><InputField label="Cidade" name="city" value={formData.city} onChange={handleInputChange} error={errors.city} /></div>
              </div>

              <h3 className="mt-6 text-lg font-semibold text-brand-800">Pagamento</h3>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setPaymentMethod('card')} className={`py-2.5 rounded-lg border text-sm font-medium ${paymentMethod === 'card' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-800 border-gray-300'}`}>Cartão</button>
                <button type="button" onClick={() => setPaymentMethod('pix')} className={`py-2.5 rounded-lg border text-sm font-medium ${paymentMethod === 'pix' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-800 border-gray-300'}`}>Pix</button>
              </div>

              {paymentMethod === 'card' && (
                <>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField label="Nome no Cartão" name="cardName" value={formData.cardName} onChange={handleInputChange} error={errors.cardName} />
                    <InputField label="Número do Cartão" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange} error={errors.cardNumber} />
                    <InputField label="Validade (MM/AA)" name="cardExpiryMonth" value={formData.cardExpiryMonth} onChange={handleInputChange} error={errors.cardExpiryMonth} />
                    <InputField label="CVV" name="cardCvv" value={formData.cardCvv} onChange={handleInputChange} error={errors.cardCvv} />
                  </div>
                  <div className="mt-3">
                    <label htmlFor="installments" className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                    <select
                      id="installments"
                      name="installments"
                      value={installments}
                      onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                      className="w-full bg-gray-100 border border-gray-300 rounded-md px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-md p-3">
                  Produto fora de estoque no momento.
                </div>
              )}
              <button type="submit" disabled={formLoading || landingPage.status === 'PAUSADA'} className={`mt-6 w-full sm:w-auto inline-flex items-center justify-center font-bold px-6 py-3 rounded-lg shadow-card transition disabled:opacity-60 ${landingPage.status === 'PAUSADA' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 text-white'}`}>
                {formLoading ? 'Processando...' : `Finalizar compra — ${BRL(landingPage.productPrice * quantity)}`}
              </button>
              {formError && <p className="text-red-600 text-sm mt-2">{formError}</p>}
            </form>
          </div>
        </section>

        {/* Reviews */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-center text-brand-800">O que nossos clientes dizem</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <div key={r.name} className="bg-white rounded-xl border border-gray-200 p-5 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-brand-800">{r.name}</span>
                  <div className="flex items-center text-amber-400">
                    {[...Array(r.rating)].map((_, i) => <StarIcon key={i} className="w-4 h-4" />)}
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">“{r.text}”</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-center text-brand-800">Perguntas frequentes</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{q:'É produto original?', a:'Sim, trabalhamos somente com produtos 100% originais e com nota fiscal.'}, {q:'Qual o prazo de entrega?', a:'Envio em até 24h úteis e prazo conforme CEP. Você acompanha tudo por e-mail.'}, {q:'Quais formas de pagamento?', a:'Pix e Cartão de Crédito. Pix aprova mais rápido.'}, {q:'Tem garantia?', a:'Sim, garantia de entrega. Caso haja qualquer problema, você recebe suporte imediato.'}].map((f) => (
              <details key={f.q} className="bg-white rounded-lg border border-gray-200 p-4">
                <summary className="cursor-pointer font-semibold text-brand-800">{f.q}</summary>
                <p className="mt-2 text-sm text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* CTA Mobile Fixa */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-gray-200 bg-white/95 backdrop-blur p-3 flex items-center justify-between">
        <div className="text-brand-800 font-extrabold">{BRL((landingPage?.productPrice || 0) * quantity)}</div>
        <button onClick={scrollToForm} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-lg">Comprar agora</button>
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
