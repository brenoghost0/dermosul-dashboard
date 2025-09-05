import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { landingPageApi, LandingPage, publicOrderApi, apiClient } from '../../lib/api';
import PixPaymentModal from '../../components/PixPaymentModal';
import CountdownTimer from '../../components/CountdownTimer'; // Importa o novo componente
import logoDermosul from '../../assets/logo-dermosul.png';
import Template2 from './Template2'; // Importa o novo template

// --- Helper Functions ---
const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const StarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.007z" clipRule="evenodd" />
  </svg>
);

const LockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
  </svg>
);

const BoltIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path d="M11.983 1.904a.75.75 0 00-1.292-.658l-5.5 9.25a.75.75 0 00.644 1.132h2.554a.75.75 0 01.293 1.423l-5.5 2.75a.75.75 0 00.42 1.393l8.5-2.25a.75.75 0 00.42-1.393l-2.554-.639a.75.75 0 01-.293-1.423l5.5-9.25a.75.75 0 00-.644-1.132h-2.554a.75.75 0 01-.586-.277z" />
  </svg>
);

const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
  </svg>
);

// --- Fake Reviews Data ---
const fakeReviews = [
  { name: 'Juliana S.', quote: 'Comprei pela primeira vez na Dermosul e fiquei impressionada. O produto chegou em 2 dias, super bem embalado e original. Atendimento excelente, virei cliente fiel!' },
  { name: 'Marcos P.', quote: 'Já tinha comprado em outros sites e sempre demorava. Na Dermosul, meu pedido chegou muito rápido e com nota fiscal. Dá pra confiar de olhos fechados.' },
  { name: 'Carla M.', quote: 'Comprei com receio, mas fui surpreendida! Produto 100% original, embalagem lacrada e ainda recebi acompanhamento por e-mail até a entrega. Recomendo muito.' },
  { name: 'Fernanda L.', quote: 'Entrega ágil e segura. Em menos de 3 dias já estava com meu pedido em mãos. Me senti super confiante em comprar na Dermosul, experiência maravilhosa.' },
  { name: 'Ricardo A.', quote: 'Adorei a transparência! Consegui acompanhar meu pedido em tempo real e recebi exatamente no prazo. A Dermosul passa muita confiança.' },
  { name: 'Beatriz G.', quote: 'Fiz meu pedido na terça e na sexta já estava usando o produto. Atendimento rápido, suporte excelente e produto original. Comprarei novamente sem dúvidas.' },
];

// --- Quantity Selector Component ---
interface QuantitySelectorProps {
  quantity: number;
  setQuantity: (quantity: number) => void;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({ quantity, setQuantity }) => {
  const increment = () => setQuantity(Math.min(5, quantity + 1));
  const decrement = () => setQuantity(Math.max(1, quantity - 1));

  return (
    <div className="flex items-center justify-center">
      <button type="button" onClick={decrement} className="bg-gray-700 text-white font-bold py-2 px-4 rounded-l-lg hover:bg-gray-600">-</button>
      <span className="bg-gray-800 text-white font-bold py-2 px-6">{String(quantity).padStart(2, '0')}</span>
      <button type="button" onClick={increment} className="bg-gray-700 text-white font-bold py-2 px-4 rounded-r-lg hover:bg-gray-600">+</button>
    </div>
  );
};

// --- Animated Chat Component ---
const AnimatedChat = () => {
  const chatMessages = [
    { sender: 'client', text: 'Olá Dermosul! Só passei aqui pra agradecer, comprei ontem e o produto chegou muito rápido. 😍' },
    { sender: 'dermosul', text: 'Oi, que bom que chegou direitinho! Ficamos super felizes em saber da sua satisfação 💚' },
    { sender: 'client', text: 'Além disso, o produto é maravilhoso, já comecei a usar e tô amando o resultado.' },
    { sender: 'dermosul', text: 'Isso nos alegra muito! Nosso objetivo é sempre oferecer qualidade e entrega rápida 🚀' },
    { sender: 'client', text: 'Com certeza vou comprar de novo em breve, virei cliente fiel! 🙌' },
    { sender: 'dermosul', text: 'Estaremos te esperando com todo carinho 💕' },
  ];

  const [visibleMessages, setVisibleMessages] = useState<typeof chatMessages>([]);

  useEffect(() => {
    const timeouts = chatMessages.map((msg, index) => 
      setTimeout(() => {
        setVisibleMessages(prev => [...prev, msg]);
      }, (index + 1) * 2000) // Delay de 2 segundos entre mensagens
    );
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div className="p-3 bg-gray-800 bg-opacity-50 rounded-lg space-y-3">
      {visibleMessages.map((msg, index) => (
        <div key={index} className={`flex items-end gap-2 animate-fade-in ${msg.sender === 'dermosul' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] px-3 py-2 rounded-xl ${msg.sender === 'dermosul' ? 'bg-green-800 text-white rounded-br-none' : 'bg-gray-600 text-white rounded-bl-none'}`}>
            <p className="text-sm">{msg.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
};


// --- Template 1 Component (Layout Atual) ---
function Template1({ landingPageData }: { landingPageData: LandingPage }) {
  const navigate = useNavigate();
  const [landingPage, setLandingPage] = useState<LandingPage>(landingPageData);
  const birthDayRef = useRef<HTMLInputElement>(null);
  const birthMonthRef = useRef<HTMLInputElement>(null);
  const birthYearRef = useRef<HTMLInputElement>(null);
  // Form states
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    birthDay: '', birthMonth: '', birthYear: '', gender: '',
    cpf: '', cep: '', address: '', number: '', complement: '', district: '', city: '', state: '',
    cardName: '', cardNumber: '', cardExpiryMonth: '', cardExpiryYear: '', cardCvv: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [installments, setInstallments] = useState(1);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixGatewayPaymentId, setPixGatewayPaymentId] = useState<string | undefined>(undefined);
  const [externalReference, setExternalReference] = useState<string>('');

  // --- Validation and API Functions ---

  useEffect(() => {
    // Mantém o estado sincronizado caso a prop mude
    setLandingPage(landingPageData);
  }, [landingPageData]);

  const validateField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'email':
        if (!/\S+@\S+\.\S+/.test(value)) error = 'E-mail inválido.';
        break;
      case 'phone':
        const cleanedPhone = value.replace(/\D/g, '');
        if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
          error = 'Telefone inválido.';
        }
        break;
      case 'cpf':
        const cleanedCpf = value.replace(/\D/g, '');
        if (cleanedCpf.length !== 11 || /^(\d)\1+$/.test(cleanedCpf)) {
          error = 'CPF inválido.';
        } else {
          let sum = 0;
          let remainder;
          for (let i = 1; i <= 9; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
          remainder = (sum * 10) % 11;
          if (remainder === 10 || remainder === 11) remainder = 0;
          if (remainder !== parseInt(cleanedCpf.substring(9, 10))) error = 'CPF inválido.';
          else {
            sum = 0;
            for (let i = 1; i <= 10; i++) sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
            remainder = (sum * 10) % 11;
            if (remainder === 10 || remainder === 11) remainder = 0;
            if (remainder !== parseInt(cleanedCpf.substring(10, 11))) error = 'CPF inválido.';
          }
        }
        break;
      case 'birthDay':
      case 'birthMonth':
      case 'birthYear':
        const dayStr = name === 'birthDay' ? value : formData.birthDay;
        const monthStr = name === 'birthMonth' ? value : formData.birthMonth;
        const yearStr = name === 'birthYear' ? value : formData.birthYear;

        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);

        if (name === 'birthDay' && (day < 1 || day > 31)) error = 'Dia inválido.';
        else if (name === 'birthMonth' && (month < 1 || month > 12)) error = 'Mês inválido.';
        else if (name === 'birthYear' && (value.length !== 4 || year < 1900)) error = 'Ano inválido.';
        else if (dayStr && monthStr && yearStr && yearStr.length === 4) {
          const date = new Date(year, month - 1, day);
          if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            error = 'Data inválida.';
          }
        }
        break;
      case 'cardExpiryMonth':
        const parts = value.split('/');
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = parseInt(parts[1], 10);
          const currentYear = new Date().getFullYear() % 100;
          const currentMonth = new Date().getMonth() + 1;

          if (month < 1 || month > 12) error = 'Mês inválido.';
          else if (year < currentYear || (year === currentYear && month < currentMonth)) error = 'Data de validade expirada.';
        } else if (value.length >= 5) {
          error = 'Formato inválido.';
        }
        break;
      default:
        if (!value) error = 'Campo obrigatório.';
        break;
    }
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
          setFormData(prev => ({
            ...prev,
            address: data.logradouro,
            district: data.bairro,
            city: data.localidade,
            state: data.uf,
          }));
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

    if (['birthDay', 'birthMonth', 'birthYear'].includes(name)) {
      formattedValue = value.replace(/\D/g, '');
    }

    if (name === 'phone') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 10) {
        formattedValue = cleaned
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else {
        formattedValue = cleaned
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2')
          .slice(0, 15);
      }
    }

    if (name === 'cpf') {
      const cleaned = value.replace(/\D/g, '');
      formattedValue = cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .slice(0, 14);
    }

    if (name === 'cep') {
      const cleaned = value.replace(/\D/g, '');
      formattedValue = cleaned
        .replace(/(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
    }

    if (name === 'cardExpiryMonth') {
      const cleaned = value.replace(/\D/g, '');
      formattedValue = cleaned
        .replace(/(\d{2})(\d)/, '$1/$2')
        .slice(0, 5);
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
    validateField(name, formattedValue);

    if (name === 'cep') {
      fetchAddressByCep(value);
    }

    // Auto-advance logic
    if (name === 'birthDay' && formattedValue.length === 2) {
      birthMonthRef.current?.focus();
    }
    if (name === 'birthMonth' && formattedValue.length === 2) {
      birthYearRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    if (e.key === 'Backspace') {
      if (name === 'birthYear' && value === '') {
        birthMonthRef.current?.focus();
      }
      if (name === 'birthMonth' && value === '') {
        birthDayRef.current?.focus();
      }
    }
  };

  // --- Helper function to build the final order payload ---
  const buildOrderPayload = (gatewayPaymentId: string, paymentType: 'card' | 'pix', status: string = 'pago') => {
    if (!landingPage) {
      throw new Error("Dados da landing page não estão disponíveis para criar o pedido.");
    }
    const payload: any = {
      ...formData,
      addressNumber: formData.number,
      phone: formData.phone.replace(/\D/g, ''),
      cpf: formData.cpf.replace(/\D/g, ''),
      birthDate: `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`,
      gender: formData.gender,
      productId: landingPage.id,
      productTitle: landingPage.productTitle,
      qty: quantity,
      productPrice: landingPage.productPrice,
      gatewayPaymentId: gatewayPaymentId,
      status,
      paymentMethod: paymentType,
      externalReference,
    };
    return payload;
  };

  // --- Helper function to create the order summary for the success page ---
  const createOrderSummary = (order: any, paymentType: 'card' | 'pix') => {
    if (!landingPage) return null;
    return {
      slug: landingPage.slug,
      productImage: landingPage.imageUrl,
      productTitle: landingPage.productTitle,
      totalAmount: landingPage.productPrice * quantity,
      installments: paymentType === 'card' ? installments : 1,
      quantity,
      paymentMethod: paymentType,
      orderId: order?.id,
      createdAt: order?.createdAt,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!landingPage) {
      setFormError("Dados do produto não carregados.");
      setFormLoading(false);
      return;
    }
    if (landingPage.status === 'PAUSADA') {
      setFormError('Produto indisponível no momento.');
      setFormLoading(false);
      return;
    }

    const extRef = `${landingPage.slug}-${Date.now()}`;
    setExternalReference(extRef);

    try {
      if (paymentMethod === 'pix') {
        const pixPayload = {
          amount: landingPage.productPrice * quantity,
          customer: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            cpf: formData.cpf.replace(/\D/g, ''),
            phone: formData.phone.replace(/\D/g, ''),
          },
          externalReference: extRef,
        };
        const response = await apiClient.post('/payments/pix', pixPayload);
        if (response.data.success) {
          const qr = response.data.qrCode || '';
          const qrSrc = typeof qr === 'string' && qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`;
          setPixQrCode(qrSrc);
          setPixCopyPaste(response.data.copyPaste || '');
          setPixGatewayPaymentId(response.data.gatewayPaymentId);
          setIsPixOpen(true);
        } else {
          setFormError(response.data.message || 'Falha ao gerar PIX.');
        }
      } else {
        // Cartão de crédito
        const cardPayload = {
          amount: landingPage.productPrice * quantity,
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
          installments: installments,
        };
        const response = await apiClient.post('/payments/credit-card', cardPayload);
        if (response.data.success) {
          const orderPayload = buildOrderPayload(response.data.gatewayPaymentId, 'card');
          const order = await publicOrderApi.createPublicOrder(orderPayload);
          const summary = createOrderSummary(order, 'card');
          sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
          navigate('/purchase-success');
        } else {
          setFormError(response.data.message || 'Ocorreu um erro no pagamento.');
        }
      }
    } catch (err: any) {
      console.error("Detailed error:", err);
      setFormError(err.response?.data?.message || err.message || "Erro desconhecido ao processar o pedido.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleConfirmPixPayment = async (gatewayPaymentId: string) => {
    if (!landingPage) return;
    try {
      const orderPayload = buildOrderPayload(gatewayPaymentId, 'pix', 'pendente');
      await publicOrderApi.createPublicOrder(orderPayload);
    } catch (err: any) {
      console.error("Erro ao criar pedido pendente:", err);
      const message = err.response?.data?.message || err.message || 'Falha ao registrar o pedido PIX inicial.';
      // Mostra o erro no formulário principal e fecha o modal para que o usuário veja
      setFormError(message);
      setIsPixOpen(false); 
    }
  };

  const checkPixPaymentStatus = async (): Promise<boolean> => {
    if (!externalReference) return false;

    try {
      // 1) Verifica pedido no banco
      const response = await apiClient.get(`/orders/by-reference/${externalReference}`);
      if (response.data && response.data.status === 'pago') {
        const summary = createOrderSummary(response.data, 'pix');
        sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
        setIsPixOpen(false);
        navigate('/purchase-success');
        return true;
      }

      // 2) Fallback: consulta gateway; se pago, cria o pedido se ainda não existir
      const gateway = await apiClient.get(`/payments/status/by-reference/${externalReference}`);
      if (gateway.data?.paid) {
        try {
          const updated = await apiClient.get(`/orders/by-reference/${externalReference}`);
          const summary = createOrderSummary(updated.data, 'pix');
          sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
          setIsPixOpen(false);
          navigate('/purchase-success');
          return true;
        } catch (e) {
          if (pixGatewayPaymentId) {
            const orderPayload = buildOrderPayload(pixGatewayPaymentId, 'pix', 'pago');
            const order = await publicOrderApi.createPublicOrder(orderPayload);
            const summary = createOrderSummary(order, 'pix');
            sessionStorage.setItem('lastOrderSummary', JSON.stringify(summary));
            setIsPixOpen(false);
            navigate('/purchase-success');
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      return false;
    }
  };

  return (
    <div className="bg-[#2A2A3A] min-h-screen font-sans text-white">
      <header className="bg-black py-4">
        <div className="max-w-6xl mx-auto px-4">
          <img src={logoDermosul} alt="Dermosul Logo" className="h-12 mx-auto" />
        </div>
      </header>
      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <main>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12">
            {/* Product Image & Timer */}
            <div className="flex flex-col items-center">
              <div className="flex justify-center overflow-hidden rounded-lg">
                <img 
                  src={`${import.meta.env.VITE_API_URL || ''}${landingPage.imageUrl}`} 
                  alt={landingPage.productTitle} 
                  className="w-full h-auto object-contain rounded-lg transition-transform duration-300 ease-in-out hover:scale-125 cursor-zoom-in"
                  style={{ maxWidth: '868px' }}
                />
              </div>
              <CountdownTimer targetDate={new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()} />
            </div>

            {/* Product Details */}
            <div className="text-center lg:text-left">
              <div className="flex justify-center lg:justify-end mb-4">
                <div className="bg-orange-500 text-white text-xs sm:text-sm font-bold py-2 px-4 rounded-full inline-block">
                  FRETE GRÁTIS PARA TODO BRASIL
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-3">{landingPage.productTitle}</h1>
              <h2 className="text-lg sm:text-xl text-gray-300 mb-4">{landingPage.productBrand}</h2>
              <div className="flex justify-center lg:justify-start items-center mb-4">
                {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-6 h-6 text-yellow-400" />)}
              </div>
              <p className="text-5xl sm:text-6xl font-bold mb-4">{BRL(landingPage.productPrice)}</p>
              <p className="text-gray-300 leading-relaxed mb-6">{landingPage.productDescription}</p>
            </div>
          </div>

          {/* Quantity Selector Section */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-center mb-4">Selecione a Quantidade</h3>
            <div className={landingPage.status === 'PAUSADA' ? 'opacity-50 pointer-events-none' : ''}>
              <QuantitySelector quantity={quantity} setQuantity={setQuantity} />
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="bg-[#1E1E2C] p-6 sm:p-8 rounded-2xl shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Customer Info Column */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold mb-4">Seus Dados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Nome" name="firstName" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} />
                  <InputField label="Sobrenome" name="lastName" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} />
                </div>
                <InputField label="E-mail" name="email" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} />
                  <InputField label="Telefone" name="phone" value={formData.phone} onChange={handleInputChange} error={errors.phone} maxLength={15} />
                <div className="grid grid-cols-3 gap-4">
                  <InputField label="Dia" name="birthDay" placeholder="DD" value={formData.birthDay} onChange={handleInputChange} error={errors.birthDay} maxLength={2} ref={birthDayRef} onKeyDown={handleKeyDown} />
                  <InputField label="Mês" name="birthMonth" placeholder="MM" value={formData.birthMonth} onChange={handleInputChange} error={errors.birthMonth} maxLength={2} ref={birthMonthRef} onKeyDown={handleKeyDown} />
                  <InputField label="Ano" name="birthYear" placeholder="AAAA" value={formData.birthYear} onChange={handleInputChange} error={errors.birthYear} maxLength={4} ref={birthYearRef} onKeyDown={handleKeyDown} />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-300 mb-1">Gênero</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                    className={`w-full bg-[#2A2A3A] border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-orange-500'}`}
                  >
                    <option value="">Selecione...</option>
                    <option value="FEMININO">Feminino</option>
                    <option value="MASCULINO">Masculino</option>
                  </select>
                  {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                </div>
                <InputField label="CPF" name="cpf" value={formData.cpf} onChange={handleInputChange} error={errors.cpf} maxLength={14} />
                <InputField label="CEP" name="cep" value={formData.cep} onChange={handleInputChange} error={errors.cep} maxLength={9} />
                <InputField label="Endereço" name="address" value={formData.address} onChange={handleInputChange} error={errors.address} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1"><InputField label="Número" name="number" value={formData.number} onChange={handleInputChange} error={errors.number} /></div>
                  <div className="sm:col-span-2"><InputField label="Complemento" name="complement" value={formData.complement} onChange={handleInputChange} required={false} /></div>
                </div>
                <InputField label="Bairro" name="district" value={formData.district} onChange={handleInputChange} error={errors.district} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Cidade" name="city" value={formData.city} onChange={handleInputChange} error={errors.city} />
                  <InputField label="Estado" name="state" value={formData.state} onChange={handleInputChange} error={errors.state} />
                </div>
              </div>

              {/* Payment Info Column */}
              <div className="space-y-4">
                <h3 className="text-2xl font-bold mb-4">Pagamento</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    disabled={landingPage.status === 'PAUSADA'}
                    className={`w-full px-4 py-2 rounded-lg border ${landingPage.status === 'PAUSADA' ? 'opacity-50 cursor-not-allowed' : paymentMethod === 'card' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#2A2A3A] border-gray-600 text-gray-200'}`}
                  >
                    Cartão de crédito
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('pix')}
                    disabled={landingPage.status === 'PAUSADA'}
                    className={`w-full px-4 py-2 rounded-lg border ${landingPage.status === 'PAUSADA' ? 'opacity-50 cursor-not-allowed' : paymentMethod === 'pix' ? 'bg-orange-500 border-orange-500 text-white' : 'bg-[#2A2A3A] border-gray-600 text-gray-200'}`}
                  >
                    Pix
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <>
                    <InputField label="Nome no cartão" name="cardName" value={formData.cardName} onChange={handleInputChange} error={errors.cardName} />
                    <InputField label="Número do cartão" name="cardNumber" value={formData.cardNumber} onChange={handleInputChange} error={errors.cardNumber} />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField label="Validade (MM/AA)" name="cardExpiryMonth" placeholder="MM/AA" value={formData.cardExpiryMonth} onChange={handleInputChange} error={errors.cardExpiryMonth} maxLength={5} />
                      <InputField label="Código de segurança" name="cardCvv" placeholder="CVV" value={formData.cardCvv} onChange={handleInputChange} error={errors.cardCvv} />
                    </div>
                    <div>
                      <label htmlFor="installments" className="block text-sm font-medium text-gray-300 mb-1">Parcelas</label>
                      <select
                        id="installments"
                        name="installments"
                        value={installments}
                        onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                        className="w-full bg-[#2A2A3A] border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                <div className="pt-4">
                <button type="submit" disabled={formLoading || landingPage.status === 'PAUSADA'} className={`w-full text-white font-bold text-xl py-4 px-4 rounded-lg shadow-lg transition-transform transform disabled:opacity-50 disabled:cursor-not-allowed ${landingPage.status === 'PAUSADA' ? 'bg-gray-500' : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'}`}>
                    {landingPage.status === 'PAUSADA' ? 'Produto indisponível' : (formLoading ? 'PROCESSANDO...' : paymentMethod === 'pix' ? `GERAR PIX (${BRL(landingPage.productPrice * quantity)})` : `COMPRAR (${BRL(landingPage.productPrice * quantity)})`)}
                  </button>
                  {landingPage.status === 'PAUSADA' && (
                    <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-md p-3 text-center">
                      Produto fora de estoque no momento.
                    </div>
                  )}
                  {formError && <p className="text-red-400 text-center mt-4">{formError}</p>}
                </div>
                
                {/* --- Bloco de Segurança e Urgência --- */}
                <div className="mt-4 flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <LockIcon className="w-4 h-4" />
                    <span>Compra Segura</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BoltIcon className="w-4 h-4 text-yellow-400" />
                    <span>Estoque limitado! Aproveite agora.</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">SSL Protegido</span>
                    <span className="mx-1">|</span>
                    <LockIcon className="w-4 h-4" />
                    <span>Pagamento Criptografado</span>
                  </div>
                </div>

                <div className="pt-10">
                  <h3 className="text-lg font-semibold text-center mb-2">Uma das nossas últimas conversas...</h3>
                  <AnimatedChat />
                </div>
              </div>
            </div>
          </form>

          {/* Reviews Section */}
          <section className="mt-12">
            <h3 className="text-3xl font-bold text-center mb-8">O que nossos clientes dizem</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fakeReviews.map((review, index) => (
                <div key={index} className="bg-[#1E1E2C] p-6 rounded-lg shadow-lg">
                  <div className="flex items-center mb-2">
                    {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-5 h-5 text-yellow-400" />)}
                  </div>
                  <p className="text-gray-300 italic mb-4">"{review.quote}"</p>
                  <div className="flex items-center">
                    <p className="font-bold text-white">{review.name}</p>
                    <span className="ml-2 text-xs bg-green-500 text-white font-semibold py-0.5 px-2 rounded-full">Cliente Verificado</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
        <footer className="text-center text-gray-500 text-sm mt-12 py-4 border-t border-gray-700">
          Copyright © 2025 dermosul.com.br. Todos os direitos reservados.
        </footer>
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


// --- InputField Sub-component ---
interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, name, required = true, error, ...props }, ref) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-300 mb-1">{label}{!required && <span className="text-xs text-gray-400"> (Opcional)</span>}</label>
      <input
        id={name}
        name={name}
        ref={ref}
        required={required}
        className={`w-full bg-[#2A2A3A] border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-orange-500'}`}
        {...props}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
);

// --- Template Router Component ---
export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [landingPage, setLandingPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      landingPageApi.getLandingPageBySlug(slug)
        .then(setLandingPage)
        .catch(err => setError(err.message || "Landing Page não encontrada."))
        .finally(() => setLoading(false));
    }
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-indigo-900 text-white">Carregando...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen bg-indigo-900 text-red-400">Erro: {error}</div>;
  if (!landingPage) return <div className="flex items-center justify-center min-h-screen bg-indigo-900 text-white">Landing Page não encontrada.</div>;

  console.log("Dados da Landing Page para roteamento:", landingPage); // Adicionado para depuração

  // Roteamento de template
  switch (landingPage.template) {
    case 'MODELO_2':
      return <Template2 landingPageData={landingPage} />;
    case 'MODELO_3':
      return <div className="text-white">MODELO 3 EM CONSTRUÇÃO</div>;
    case 'MODELO_1':
    default:
      return <Template1 landingPageData={landingPage} />;
  }
}
