import { FormEvent, forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import StorefrontHeader from "./components/Header";
import StorefrontFooter from "./components/Footer";
import { useCart } from "./CartContext";
import { useRecommendations } from "./useRecommendations";
import { useStorefrontContext } from "./StorefrontContext";
import { usePageMeta } from "./usePageMeta";
import { storefrontApi, CheckoutPayload } from "./api";
import type { ShippingMethod, ProductSummary } from "../Store/api";
import PixPaymentModal from "../../components/PixPaymentModal";
import { emitAddedToCartEvent } from "./utils/cartEvents";
import { sanitizeDigits } from "../../utils/sanitizeDigits";

const ORDER_STORAGE_KEY = (orderId: string) => `dermosul_order_${orderId}`;
const CHECKOUT_PROFILE_KEY = "dermosul_checkout_profile";
const CHECKOUT_RESERVATION_KEY = "dermosul_checkout_reservation_expires_at";
const INITIAL_RESERVATION_SECONDS = 12 * 60;

type Step = {
  id: number;
  label: string;
  status: "done" | "current" | "upcoming";
};

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  helperText?: string;
  loading?: boolean;
};

type SelectInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  error?: string;
};

const PIX_BADGES = ["Desconto imediato", "QR Code válido 15 min", "Comprovante automático"];

const PIX_STEPS = [
  "Finalize e gere o QR Code.",
  "Pague pelo app do seu banco ou carteira digital.",
  "Receba confirmação + passo a passo Dermosul.",
];

export default function CheckoutPage() {
  const { settings } = useStorefrontContext();
  const {
    cart,
    loading: cartLoading,
    error: cartError,
    refresh,
    reset,
    addItem,
    removeItem,
    selectShippingMethod,
    applyCoupon,
  } = useCart();
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [cepLookupStatus, setCepLookupStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(INITIAL_RESERVATION_SECONDS);
  const { data: recommendationData, loading: loadingRecommendations } = useRecommendations(6);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [fastCheckoutNotice, setFastCheckoutNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    orderId: string;
    qrCode: string;
    copyPaste: string;
    externalReference: string;
    paymentId?: string | null;
    total: number;
  } | null>(null);
  const reservationExpiredRef = useRef(false);
  const stepRefs = useRef<Record<1 | 2 | 3, HTMLElement | null>>({
    1: null,
    2: null,
    3: null,
  });
  const pendingScrollStep = useRef<1 | 2 | 3 | null>(null);

  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    document: "",
    birthDate: "",
    gender: "",
  });
  const [shippingAddress, setShippingAddress] = useState({
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    district: "",
    city: "",
    state: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao">("pix");
  const [cardData, setCardData] = useState({
    holderName: "",
    number: "",
    expiry: "",
    cvv: "",
    installments: "1",
  });
  const [saveAddress, setSaveAddress] = useState(true);

  const sanitizedPostalCode = sanitizeDigits(shippingAddress.postalCode);
  const hasPostalCode = sanitizedPostalCode.length === 8;
  const freeShippingApplied = Boolean(cart?.luckyWheelPerks?.freeShippingApplied || cart?.freeShippingApplied);

  const contactEmail = settings?.textBlocks?.footer?.contactEmail ?? "atendimento@dermosul.com.br";
  const contactPhoneRaw = settings?.textBlocks?.footer?.contactPhone ?? "+55 11 4000-0000";
  const contactPhoneDisplay = formatDisplayPhone(contactPhoneRaw);
  const contactPhoneLink = `https://wa.me/${phoneDigitsForWhatsapp(contactPhoneRaw)}`;

  const scrollStepIntoView = useCallback((step: 1 | 2 | 3) => {
    if (typeof window === "undefined") return;
    const target = stepRefs.current[step];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
  }, []);

  const registerStepRef = useCallback(
    (step: 1 | 2 | 3) => (node: HTMLElement | null) => {
      stepRefs.current[step] = node;
      if (node && pendingScrollStep.current === step) {
        scrollStepIntoView(step);
        pendingScrollStep.current = null;
      }
    },
    [scrollStepIntoView]
  );

  useEffect(() => {
    if (!hasPostalCode) {
      setShippingMethods([]);
      setSelectedShipping(null);
      setLoading(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const methods = await storefrontApi.listShippingMethods();
        if (!active) return;
        setShippingMethods(methods);
        if (cart?.shippingMethod?.id) {
          setSelectedShipping(cart.shippingMethod.id);
        } else if (methods.length > 0) {
          const first = methods[0].id;
          setSelectedShipping(first);
          selectShippingMethod(first).catch((err) => {
            setError(err?.message || "Falha ao atualizar o frete.");
          });
        }
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Falha ao carregar métodos de frete.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [cart?.shippingMethod?.id, selectShippingMethod, hasPostalCode]);

useEffect(() => {
  try {
    const raw = localStorage.getItem(CHECKOUT_PROFILE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
      if (parsed?.customer) {
        const hydratedCustomer = { ...parsed.customer };
        if (hydratedCustomer.birthDate) {
          hydratedCustomer.birthDate = toDisplayBirthdate(hydratedCustomer.birthDate);
        }
        setCustomer((prev) => ({ ...prev, ...hydratedCustomer }));
      }
      if (parsed?.shippingAddress) {
        setShippingAddress((prev) => ({ ...prev, ...parsed.shippingAddress }));
      }
    } catch (err) {
      console.warn("Perfil de checkout inválido", err);
    }
}, []);

useEffect(() => {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const raw = window.localStorage.getItem(CHECKOUT_RESERVATION_KEY);
  if (raw) {
    const expiresAt = Number(raw);
    if (!Number.isNaN(expiresAt)) {
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      if (remaining > 0) {
        setTimeLeft(remaining);
        return;
      }
    }
  }
  const expiresAt = now + INITIAL_RESERVATION_SECONDS * 1000;
  window.localStorage.setItem(CHECKOUT_RESERVATION_KEY, String(expiresAt));
  setTimeLeft(INITIAL_RESERVATION_SECONDS);
}, []);

useEffect(() => {
  const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        if (next <= 0 && typeof window !== "undefined") {
          window.localStorage.removeItem(CHECKOUT_RESERVATION_KEY);
        }
        return next;
      });
  }, 1000);
  return () => window.clearInterval(timer);
}, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = { customer, shippingAddress };
    try {
      localStorage.setItem(CHECKOUT_PROFILE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Falha ao autosalvar checkout", err);
    }
  }, [customer, shippingAddress]);

  useEffect(() => {
    if (currentStep === 1 && !stepMessage) {
      setStepMessage(
        "Estamos quase lá 💜 Confira seus dados com calma — a Dermosul garante total segurança em cada etapa da sua compra."
      );
    }
  }, [currentStep, stepMessage]);

  const steps = useMemo<Step[]>(() => {
    const mapStatus = (stepId: 1 | 2 | 3): Step["status"] => {
      if (currentStep > stepId) return "done";
      if (currentStep === stepId) return "current";
      return "upcoming";
    };
    return [
      { id: 1, label: "Identificação", status: mapStatus(1) },
      { id: 2, label: "Entrega", status: mapStatus(2) },
      { id: 3, label: "Pagamento", status: mapStatus(3) },
    ];
  }, [currentStep]);

  const checkoutUrl = typeof window !== "undefined" ? `${window.location.origin}/checkout` : undefined;

  usePageMeta({
    title: "Checkout Dermosul",
    description: "Finalize sua compra com a equipe Dermosul e as maiores marcas de dermocosméticos do mundo.",
    image: settings?.metaImageUrl || "/media/dermosul/og-image.png",
    url: checkoutUrl,
  });

  function formatCurrency(value: number) {
    return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDocument(value: string) {
    const digits = sanitizeDigits(value).slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(value: string) {
    const digits = sanitizeDigits(value).slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function formatCep(value: string) {
    const digits = sanitizeDigits(value).slice(0, 8);
    return digits.replace(/(\d{5})(\d{0,3})/, "$1-$2");
  }

  function formatCardNumber(value: string) {
    const digits = sanitizeDigits(value).slice(0, 19);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatCardExpiry(value: string) {
    const digits = sanitizeDigits(value).slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function formatCardCvv(value: string) {
    return sanitizeDigits(value).slice(0, 4);
  }

  function parseCardExpiry(value: string) {
    const digits = sanitizeDigits(value).slice(0, 4);
    if (digits.length < 4) return null;
    const month = digits.slice(0, 2);
    const year = digits.slice(2);
    const monthNumber = Number(month);
    if (monthNumber < 1 || monthNumber > 12) {
      return null;
    }
    const fullYear = year.length === 2 ? `20${year}` : year;
    if (fullYear.length !== 4) {
      return null;
    }
    return { month: month.padStart(2, "0"), year: fullYear };
  }

  function formatBirthdate(value: string) {
    const digits = sanitizeDigits(value).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function parseBirthdateToIso(value: string) {
    const digits = sanitizeDigits(value).slice(0, 8);
    if (digits.length !== 8) return null;
    const day = Number(digits.slice(0, 2));
    const month = Number(digits.slice(2, 4));
    const year = Number(digits.slice(4));
    if (!day || !month || !year) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day ||
      year < 1900
    ) {
      return null;
    }
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  }

  function toDisplayBirthdate(value: string) {
    if (!value) return "";
    if (value.includes("-")) {
      const [year, month, day] = value.split("-");
      if (year && month && day) {
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    }
    return formatBirthdate(value);
  }

  const maskedCustomer = useMemo(
    () => ({
      ...customer,
      phone: formatPhone(customer.phone),
      document: formatDocument(customer.document),
      birthDate: toDisplayBirthdate(customer.birthDate),
    }),
    [customer]
  );

  const maskedAddress = useMemo(
    () => ({
      ...shippingAddress,
      postalCode: formatCep(shippingAddress.postalCode),
    }),
    [shippingAddress]
  );

  function validateIdentificationStep() {
    const errors: Record<string, string> = {};
    if (!customer.firstName.trim()) {
      errors.firstName = "Como podemos te chamar?";
    }
    if (!customer.email.trim()) {
      errors.email = "Precisamos do seu e-mail para continuar.";
    }
    if (!sanitizeDigits(customer.phone)) {
      errors.phone = "Informe um telefone com DDD.";
    }
    if (!customer.gender) {
      errors.gender = "Selecione uma opção.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateDeliveryStep() {
    const errors: Record<string, string> = {};
    if (!customer.document.trim()) {
      errors.document = "Informe o CPF para a nota fiscal.";
    }
    if (sanitizeDigits(customer.document).length !== 11) {
      errors.document = "CPF inválido";
    }
    if (!sanitizeDigits(shippingAddress.postalCode) || sanitizeDigits(shippingAddress.postalCode).length !== 8) {
      errors.postalCode = "CEP inválido";
    }
    if (!shippingAddress.street.trim()) {
      errors.street = "Qual é a rua?";
    }
    if (!shippingAddress.number.trim()) {
      errors.number = "Informe o número";
    }
    if (!shippingAddress.district.trim()) {
      errors.district = "Informe o bairro";
    }
    if (!shippingAddress.city.trim()) {
      errors.city = "Informe a cidade";
    }
    if (!shippingAddress.state.trim()) {
      errors.state = "Informe o estado";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const goToStep = useCallback(
    (step: 1 | 2 | 3, message?: string | null) => {
      setFormErrors({});
      if (message) {
        setStepMessage(message);
      } else {
        setStepMessage(null);
      }

      if (step === currentStep) {
        scrollStepIntoView(step);
        pendingScrollStep.current = null;
        return;
      }

      pendingScrollStep.current = step;
      setCurrentStep(step);
    },
    [currentStep, scrollStepIntoView]
  );

  useEffect(() => {
    if (pendingScrollStep.current === null) return;
    const step = pendingScrollStep.current;
    const target = stepRefs.current[step];
    if (target) {
      scrollStepIntoView(step);
      pendingScrollStep.current = null;
    } else if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      pendingScrollStep.current = null;
    }
  }, [currentStep, scrollStepIntoView]);

  function handleIdentificationNext() {
    if (validateIdentificationStep()) {
      goToStep(2, "Perfeito! Agora nos conte onde as suas marcas favoritas devem chegar.");
    }
  }

  function handleDeliveryNext() {
    if (!cart || !cart.items || cart.items.length === 0) {
      setActionMessage("Seu carrinho está vazio. Adicione produtos para continuar.");
      goToStep(1, "Sua reserva expirou. Escolha seus produtos novamente para prosseguir.");
      return;
    }
    if (validateDeliveryStep()) {
      goToStep(3, "Falta só escolher como prefere pagar ✨");
    }
  }

  function handleBackToIdentification() {
    goToStep(1, "Tudo certo! Ajuste suas informações, se precisar.");
  }

  function handleBackToDelivery() {
    goToStep(2, "Revise o endereço com carinho antes de finalizar.");
  }

  const cepHelperText = useMemo(() => {
    if (cepLookupStatus === "success") {
      return cepMessage || "Endereço preenchido automaticamente.";
    }
    if (cepLookupStatus === "error") {
      return cepMessage || "Não encontramos o CEP informado. Preencha manualmente.";
    }
    return undefined;
  }, [cepLookupStatus, cepMessage]);

  async function finalizeOrder() {
    if (!cart || !cart.items || cart.items.length === 0) {
      setActionMessage("Seu carrinho está vazio. Adicione produtos para continuar.");
      goToStep(1, "Sua reserva expirou. Escolha seus produtos novamente para finalizar.");
      return;
    }
    if (!selectedShipping) {
      setActionMessage("Selecione um método de entrega para continuar.");
      goToStep(2, "Escolha a opção de entrega ideal para você.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setFormErrors({});
    try {
      const sanitizedCustomer = {
        firstName: customer.firstName.trim(),
        lastName: customer.lastName.trim(),
        email: customer.email.trim(),
        phone: sanitizeDigits(customer.phone),
        document: sanitizeDigits(customer.document),
        birthDate: parseBirthdateToIso(customer.birthDate) || "",
        gender: customer.gender || undefined,
      };

      const sanitizedAddress = {
        postalCode: sanitizeDigits(shippingAddress.postalCode),
        street: shippingAddress.street.trim(),
        number: shippingAddress.number.trim(),
        complement: shippingAddress.complement.trim() || undefined,
        district: shippingAddress.district.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
      };

      const requiredFields = {
        firstName: sanitizedCustomer.firstName,
        lastName: sanitizedCustomer.lastName,
        email: sanitizedCustomer.email,
        phone: sanitizedCustomer.phone,
        document: sanitizedCustomer.document,
        birthDate: sanitizedCustomer.birthDate,
        gender: sanitizedCustomer.gender,
        postalCode: sanitizedAddress.postalCode,
        street: sanitizedAddress.street,
        number: sanitizedAddress.number,
        district: sanitizedAddress.district,
        city: sanitizedAddress.city,
        state: sanitizedAddress.state,
      };

      const errors: Record<string, string> = {};
      let parsedCardExpiry: { month: string; year: string } | null = null;
      Object.entries(requiredFields).forEach(([key, value]) => {
        if (!value) errors[key] = "Campo obrigatório";
      });
      if (sanitizedCustomer.document.length !== 11) {
        errors.document = "CPF inválido";
      }
      if (sanitizedAddress.postalCode.length !== 8) {
        errors.postalCode = "CEP inválido";
      }
      if (!sanitizedCustomer.birthDate) {
        errors.birthDate = "Data de nascimento inválida";
      }

      if (paymentMethod === "cartao") {
        if (!cardData.holderName.trim()) {
          errors.cardHolderName = "Informe o nome como está no cartão";
        }
        const cardNumberDigits = sanitizeDigits(cardData.number);
        if (cardNumberDigits.length < 13 || cardNumberDigits.length > 19) {
          errors.cardNumber = "Número do cartão inválido";
        }
        parsedCardExpiry = parseCardExpiry(cardData.expiry);
        if (!parsedCardExpiry) {
          errors.cardExpiry = "Validade inválida";
        }
        const cvvDigits = sanitizeDigits(cardData.cvv);
        if (cvvDigits.length < 3 || cvvDigits.length > 4) {
          errors.cardCvv = "CVV inválido";
        }
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setSubmitting(false);
      return;
    }

    const payload: CheckoutPayload = {
      cartId: cart.id,
      sessionToken: cart.sessionToken || undefined,
      customer: sanitizedCustomer,
      shippingAddress: sanitizedAddress,
      billingAddress: null,
      shippingMethodId: selectedShipping,
      paymentMethod,
      paymentDetails:
        paymentMethod === "cartao"
          ? {
              installments: Math.max(1, parseInt(cardData.installments, 10) || 1),
              creditCard: {
                holderName: cardData.holderName.trim(),
                number: sanitizeDigits(cardData.number),
                expiryMonth: parsedCardExpiry!.month,
                expiryYear: parsedCardExpiry!.year,
                cvv: sanitizeDigits(cardData.cvv),
              },
            }
          : null,
      couponCode: cart.coupon?.code ?? undefined,
    };
      const response = await storefrontApi.checkout(payload);
      sessionStorage.setItem(ORDER_STORAGE_KEY(response.orderId), JSON.stringify(response));
      if (saveAddress) {
        localStorage.setItem(
          CHECKOUT_PROFILE_KEY,
          JSON.stringify({ customer: sanitizedCustomer, shippingAddress: sanitizedAddress })
        );
      }
      if (paymentMethod === "pix" && response.payment.pix) {
        setPixData({
          orderId: response.orderId,
          qrCode: response.payment.pix.qrCode,
          copyPaste: response.payment.pix.copyPaste,
          externalReference: response.payment.externalReference || "",
          paymentId: response.payment.gatewayPaymentId || null,
          total: response.totals.totalCents,
        });
        setIsPixModalOpen(true);
      } else {
        await refresh();
        reset();
        navigate(`/pedido/${response.orderId}/confirmacao`, { replace: true, state: response });
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao concluir checkout.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckPaymentStatus() {
    if (!pixData?.externalReference) return false;
    try {
    const result = await storefrontApi.checkPaymentStatus(
      pixData.externalReference,
      pixData.paymentId ? { paymentId: pixData.paymentId } : undefined
    );
      if (result.paid) {
        setIsPixModalOpen(false);
        const storedOrder = getStoredOrder(pixData.orderId);
        await refresh();
        reset();
        navigate(`/pedido/${pixData.orderId}/confirmacao`, { replace: true, state: storedOrder });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Falha ao verificar status do pagamento:", error);
      return false;
    }
  }

  function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    if (currentStep === 1) {
      handleIdentificationNext();
      return;
    }
    if (currentStep === 2) {
      handleDeliveryNext();
      return;
    }
    if (currentStep === 3) {
      finalizeOrder();
    }
  }

  useEffect(() => {
    if (timeLeft <= 0) {
      if (!reservationExpiredRef.current) {
        reservationExpiredRef.current = true;
        reset();
        refresh().catch(() => {});
        setSelectedShipping(null);
        setActionMessage("Sua reserva expirou e os itens foram liberados.");
        goToStep(1, "Sua reserva expirou. Escolha seus produtos novamente para continuar.");
      }
    } else {
      reservationExpiredRef.current = false;
    }
  }, [timeLeft, reset, refresh, goToStep]);

  useEffect(() => {
    const cepDigits = sanitizeDigits(shippingAddress.postalCode);
    if (cepDigits.length !== 8) {
      if (cepLookupStatus !== "idle") {
        setCepLookupStatus("idle");
        setCepMessage(null);
      }
      return;
    }

    let active = true;
    async function lookupCep() {
      setCepLookupStatus("loading");
      setCepMessage("Consultando endereço...");
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();
        if (!active) return;
        if (data?.erro) {
          setCepLookupStatus("error");
          setCepMessage("CEP não encontrado. Confira e preencha manualmente.");
          return;
        }
        setShippingAddress((prev) => ({
          ...prev,
          street: data.logradouro || prev.street,
          district: data.bairro || prev.district,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        setCepLookupStatus("success");
        setCepMessage("Endereço preenchido automaticamente.");
      } catch (err) {
        if (!active) return;
        setCepLookupStatus("error");
        setCepMessage("Falha ao consultar CEP. Preencha manualmente.");
      }
    }
    lookupCep();
    return () => {
      active = false;
    };
  }, [shippingAddress.postalCode]);

  const rawSubtotal = cart?.subtotalCents ?? 0;
  const rawDiscount = cart?.discountCents ?? 0;
  const rawShipping = cart?.shippingCents ?? 0;
  const effectiveShippingCents = freeShippingApplied ? 0 : hasPostalCode ? rawShipping : 0;
  const total = Math.max(rawSubtotal - rawDiscount + effectiveShippingCents, 0);
  const cartItems = cart?.items || [];
  const countdownLabel = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (timeLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  const recommendedPool = useMemo(() => {
    if (!recommendationData) return [] as ProductSummary[];
    const stack = [
      ...(recommendationData.cartComplements ?? []),
      ...(recommendationData.customerFavorites ?? []),
      ...(recommendationData.trending ?? []),
      ...(recommendationData.newArrivals ?? []),
    ];
    const seen = new Set<string>();
    const aggregated: ProductSummary[] = [];
    for (const item of stack) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      aggregated.push(item);
    }
    return aggregated;
  }, [recommendationData]);

  const crossSellItems = useMemo(
    () =>
      recommendedPool
        .filter((product) => !cartItems.some((item) => item.productId === product.id))
        .slice(0, 3),
    [recommendedPool, cartItems]
  );

  async function handleAddRecommended(product: ProductSummary) {
    try {
      await addItem({ productId: product.id, quantity: 1 });
      emitAddedToCartEvent(product, 1, { origin: "checkout-cross-sell" });
      setActionMessage(`${product.name} foi adicionado à sua bolsa.`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      const message = err?.message || "Falha ao adicionar produto.";
      setActionMessage(message);
      setTimeout(() => setActionMessage(null), 3500);
      throw err instanceof Error ? err : new Error(message);
    }
  }

  const handleRemoveItem = (productId: string, variantId?: string | null) => {
    removeItem(productId, variantId || null).catch((err) => {
      setActionMessage(err?.message || "Falha ao remover produto.");
      setTimeout(() => setActionMessage(null), 3500);
    });
  };

  const hasCart = Boolean(cart);
  const hasItems = Boolean(cart?.items && cart.items.length > 0);
  const showEmptyState = !loading && !cartLoading && (!cart || cart.items.length === 0);

  const headerNotice = useMemo(() => {
    if (stepMessage && fastCheckoutNotice) {
      return `${stepMessage} • ${fastCheckoutNotice}`;
    }
    return stepMessage || fastCheckoutNotice;
  }, [stepMessage, fastCheckoutNotice]);

  return (
    <div className="min-h-screen bg-violet-50/40">
      <StorefrontHeader />
      <CheckoutHeaderBar
        steps={steps}
        countdown={countdownLabel}
        notice={headerNotice}
        currentStep={currentStep}
      />
      <main className="mx-auto max-w-6xl px-4 pb-16 overflow-x-hidden">
        {(cartLoading || loading) && <Alert tone="muted">Carregando o checkout Dermosul com as maiores marcas do mundo...</Alert>}
        {(cartError || error) && <Alert tone="error">{cartError || error}</Alert>}
        {showEmptyState && (
          <Alert tone="muted">Seu carrinho está vazio. Visite a vitrine Dermosul e descubra as maiores marcas de dermocosméticos.</Alert>
        )}

        {hasItems && !loading && hasCart && (
          <form
            className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
            onSubmit={handleFormSubmit}
          >
            <div className="space-y-8 min-w-0">
              {currentStep === 1 && (
                <CheckoutStepCard
                  ref={registerStepRef(1)}
                  step={1}
                  title="Identificação"
                  description="Suas informações são usadas com total segurança para confirmar seu pedido e garantir a entrega correta."
                  footer={
                    <>
                      <span className="flex-1 text-xs text-violet-500">Clique em “Avançar para Entrega” e informe o endereço para receber seu pedido.</span>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                      >
                        Avançar para Entrega
                      </button>
                    </>
                  }
                >
                <div className="rounded-2xl bg-violet-50/60 p-4 text-sm text-violet-700">
                  <p>A Dermosul cuida de cada detalhe.</p>
                  <p className="mt-2 text-xs text-violet-500">Suas informações são tratadas com segurança e sigilo total.</p>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="Nome"
                    value={customer.firstName}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, firstName: value }))}
                    required
                    error={formErrors.firstName}
                  />
                  <TextInput
                    label="Sobrenome"
                    value={customer.lastName}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, lastName: value }))}
                    required
                    error={formErrors.lastName}
                  />
                  <TextInput
                    label="E-mail"
                    type="email"
                    placeholder="seuemail@dominio.com"
                    value={customer.email}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, email: value }))}
                    required
                    autoComplete="email"
                    error={formErrors.email}
                  />
                  <TextInput
                    label="Telefone"
                    value={maskedCustomer.phone}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, phone: value }))}
                    required
                    placeholder="(99) 99999-9999"
                    autoComplete="tel"
                    error={formErrors.phone}
                  />
                  <TextInput
                    label="CPF"
                    value={maskedCustomer.document}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, document: value }))}
                    required
                    placeholder="000.000.000-00"
                    autoComplete="off"
                    error={formErrors.document}
                  />
                  <SelectInput
                    label="Gênero"
                    value={customer.gender}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, gender: value }))}
                    required
                    placeholder="Selecione"
                    options={[
                      { value: "FEMININO", label: "Feminino" },
                      { value: "MASCULINO", label: "Masculino" },
                    ]}
                    error={formErrors.gender}
                  />
                  <TextInput
                    label="Data de nascimento"
                    value={maskedCustomer.birthDate}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, birthDate: value }))}
                    required
                    placeholder="DD/MM/AAAA"
                    autoComplete="bday"
                    error={formErrors.birthDate}
                  />
                </div>
              </CheckoutStepCard>
              )}

              {currentStep === 2 && (
                <CheckoutStepCard
                  ref={registerStepRef(2)}
                  step={2}
                  title="Endereço de entrega"
                  description="Conta pra gente onde a seleção Dermosul das maiores marcas deve chegar."
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={handleBackToIdentification}
                        className="inline-flex items-center justify-center rounded-full border border-violet-200 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      >
                        Voltar à Identificação
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200"
                      >
                        Avançar para Pagamento
                      </button>
                    </>
                  }
                >
                <div className="rounded-2xl bg-violet-50/60 p-4 text-sm text-violet-700">
                  <p>Queremos que seus produtos das grandes marcas cheguem rapidinho — com todo o cuidado Dermosul 💜</p>
                  <p className="mt-2 text-xs text-violet-500">Preenchemos o endereço automaticamente com base no CEP e salvamos pra próxima compra.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <TextInput
                    label="CEP"
                    value={maskedAddress.postalCode}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, postalCode: value }))}
                    required
                    placeholder="00000-000"
                    autoComplete="postal-code"
                    error={formErrors.postalCode}
                    helperText={cepHelperText}
                    loading={cepLookupStatus === "loading"}
                  />
                  <TextInput
                    label="Rua"
                    value={shippingAddress.street}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, street: value }))}
                    required
                    autoComplete="address-line1"
                    error={formErrors.street}
                  />
                  <TextInput
                    label="Número"
                    value={shippingAddress.number}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, number: value }))}
                    required
                    autoComplete="address-line2"
                    error={formErrors.number}
                  />
                  <TextInput
                    label="Complemento"
                    value={shippingAddress.complement}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, complement: value }))}
                    placeholder="Apartamento, bloco, referência"
                    autoComplete="address-line3"
                  />
                  <TextInput
                    label="Bairro"
                    value={shippingAddress.district}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, district: value }))}
                    required
                    autoComplete="address-level2"
                    error={formErrors.district}
                  />
                  <TextInput
                    label="Cidade"
                    value={shippingAddress.city}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, city: value }))}
                    required
                    autoComplete="address-level2"
                    error={formErrors.city}
                  />
                  <TextInput
                    label="Estado"
                    value={shippingAddress.state}
                    onChange={(value) => setShippingAddress((prev) => ({ ...prev, state: value }))}
                    required
                    placeholder="UF"
                    error={formErrors.state}
                  />
                </div>
                <div className="mt-6 space-y-3 text-sm text-violet-800">
                  <p className="font-medium">Método de entrega</p>
                  {!hasPostalCode && (
                    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-3 text-xs text-violet-600">
                      Preencha o CEP para liberar as opções de envio e calcular o frete.
                    </div>
                  )}
                  {hasPostalCode && shippingMethods.length === 0 && (
                    <p className="text-xs text-zinc-500">Estamos carregando opções disponíveis para o CEP informado.</p>
                  )}
                  {hasPostalCode &&
                    shippingMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                          selectedShipping === method.id
                            ? "border-violet-500 bg-violet-50"
                          : "border-violet-100 bg-white hover:border-violet-300"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={selectedShipping === method.id}
                        onChange={() => {
                          setSelectedShipping(method.id);
                          selectShippingMethod(method.id).catch((err) => {
                            setError(err?.message || "Falha ao atualizar o frete.");
                          });
                        }}
                        className="h-4 w-4 text-violet-600"
                        disabled={!hasPostalCode}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-violet-900">{method.name}</p>
                        <p className="text-xs text-violet-600">
                          {method.deliveryEtaText || (hasPostalCode ? "Entrega padrão" : "Calcule após informar o CEP")}
                        </p>
                        {freeShippingApplied && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
                            Frete Dermosul liberado
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-violet-900">
                        {freeShippingApplied ? "R$ 0,00" : hasPostalCode ? formatCurrency(method.flatPriceCents) : "Informe o CEP"}
                      </span>
                    </label>
                    ))}
                </div>
                <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-violet-800 shadow-sm">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(event) => setSaveAddress(event.target.checked)}
                      className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <span>Salvar este endereço para agilizar as próximas compras</span>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-violet-100 bg-white p-4 text-xs text-violet-600">
                    <p className="font-semibold text-violet-900">Área de entrega</p>
                    <p className="mt-2">Detectamos a região para sugerir a melhor rota. Ajuste se preferir outra referência.</p>
                  </div>
                  <div className="flex items-center justify-center rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 text-xs text-violet-500">
                    <span>Mapa ilustrativo — exibiremos sua localização quando o CEP for preenchido ✅</span>
                  </div>
                </div>
              </CheckoutStepCard>
              )}

              {currentStep === 3 && (
                <CheckoutStepCard
                  ref={registerStepRef(3)}
                  step={3}
                  title="Pagamento seguro e imediato"
                  description="Escolha a forma preferida e confirme o pedido com acompanhamento em tempo real."
                  footer={
                    <>
                      <button
                        type="button"
                        onClick={handleBackToDelivery}
                        className="inline-flex items-center justify-center rounded-full border border-violet-200 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      >
                        Voltar à Entrega
                      </button>
                      <span className="w-full text-center text-xs text-violet-500">
                        Pix e cartão processados com antifraude, confirmação instantânea e comprovante automático.
                      </span>
                    </>
                  }
                >
                <div className="checkout-payment-section space-y-5 lg:space-y-6">
                  <PaymentMethodCard
                    active={paymentMethod === "pix"}
                    onSelect={() => setPaymentMethod("pix")}
                    title="Pix Dermosul Marketplace"
                    description="Pagamento instantâneo com QR Code válido por 15 minutos e desconto exclusivo."
                    badge="Recomendado"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex-1 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">Total via Pix</p>
                        <p className="text-3xl font-semibold text-violet-900">{formatCurrency(total)}</p>
                        <p className="text-sm text-violet-600">
                          Prioridade máxima na expedição, confirmação automática e comprovante enviado no mesmo instante.
                        </p>
                      <div className="flex flex-wrap gap-2 text-xs font-semibold text-violet-600">
                          {PIX_BADGES.map((badge) => (
                            <span key={badge} className="rounded-full bg-violet-100 px-3 py-1">
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="w-full rounded-2xl border border-violet-100 bg-white p-4 text-sm text-violet-700 shadow-inner lg:max-w-sm">
                        <p className="text-sm font-semibold text-violet-900">Veja como funciona</p>
                        <ol className="mt-3 list-inside list-decimal space-y-2 pl-4 text-sm text-violet-700">
                          {PIX_STEPS.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </PaymentMethodCard>
                  <PaymentMethodCard
                    title="Cartão de crédito"
                    description="Processado via Asaas com tokenização segura e parcelamento em até 5x sem juros."
                    active={paymentMethod === "cartao"}
                    onSelect={() => setPaymentMethod("cartao")}
                  >
                    {paymentMethod === "cartao" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-violet-50/70 p-4 text-xs text-violet-600">
                          <p>Cobramos via Asaas com antifraude e tokenização. Assim que a operadora aprovar, liberamos o pedido automaticamente.</p>
                        </div>
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextInput
                              label="Nome impresso no cartão"
                              value={cardData.holderName}
                              onChange={(value) => setCardData((prev) => ({ ...prev, holderName: value }))}
                              required
                              autoComplete="off"
                              error={formErrors.cardHolderName}
                            />
                            <TextInput
                              label="Número do cartão"
                              value={cardData.number}
                              onChange={(value) => setCardData((prev) => ({ ...prev, number: formatCardNumber(value) }))}
                              required
                              autoComplete="off"
                              placeholder="0000 0000 0000 0000"
                              error={formErrors.cardNumber}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <TextInput
                              label="Validade (MM/AA)"
                              value={cardData.expiry}
                              onChange={(value) => setCardData((prev) => ({ ...prev, expiry: formatCardExpiry(value) }))}
                              required
                              autoComplete="off"
                              placeholder="MM/AA"
                              error={formErrors.cardExpiry}
                            />
                            <TextInput
                              label="CVV"
                              value={cardData.cvv}
                              onChange={(value) => setCardData((prev) => ({ ...prev, cvv: formatCardCvv(value) }))}
                              required
                              autoComplete="off"
                              placeholder="123"
                              error={formErrors.cardCvv}
                            />
                            <label className="flex flex-col gap-2 text-sm">
                              <span className="font-medium text-zinc-600">Parcelas</span>
                              <select
                                value={cardData.installments}
                                onChange={(event) => setCardData((prev) => ({ ...prev, installments: event.target.value }))}
                                className="rounded border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                              >
                                {Array.from({ length: 5 }).map((_, index) => {
                                  const count = index + 1;
                                  return (
                                    <option key={count} value={String(count)}>
                                      {count}x sem juros
                                    </option>
                                  );
                                })}
                              </select>
                            </label>
                          </div>
                        </div>
                        {error && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                            {error}
                          </div>
                        )}
                        <p className="text-xs text-violet-500">
                          Aprovação em segundos, comprovante automático e acompanhamento via WhatsApp e e-mail.
                        </p>
                      </div>
                    )}
                  </PaymentMethodCard>
                  <PaymentMethodCard
                    title="Boleto bancário"
                    description="Emitimos manualmente para compras corporativas ou pedidos com aprovação especial."
                    disabled
                  >
                    <p className="text-xs text-violet-500">Nosso atendimento gera o boleto e envia o código de barras em minutos.</p>
                    <a
                      href={contactPhoneLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-200 sm:w-auto"
                    >
                      Solicitar pelo WhatsApp
                    </a>
                  </PaymentMethodCard>
                  <div className="rounded-2xl border border-violet-100 bg-white p-4 text-sm text-violet-800 shadow-sm md:hidden">
                    <p className="text-sm font-semibold text-violet-900">Resumo do pedido</p>
                    <ul className="mt-3 space-y-2 text-xs text-violet-700">
                      {cartItems.map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span className="flex-1 truncate font-medium">{item.product.name}</span>
                          <span>{item.quantity}x</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs text-violet-500">Total a pagar: <span className="font-semibold text-violet-900">{formatCurrency(total)}</span></p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !selectedShipping}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Processando..." : "Confirmar pedido com segurança"}
                  </button>
                </div>
              </CheckoutStepCard>
              )}

            </div>

            <CheckoutSummary
              cart={cart}
              cartItems={cartItems}
              total={total}
              formatCurrency={formatCurrency}
              crossSellItems={crossSellItems}
              loadingRecommendations={loadingRecommendations}
              actionMessage={actionMessage}
              onAddCrossSell={handleAddRecommended}
              onRemoveItem={handleRemoveItem}
              contactEmail={contactEmail}
              contactPhoneDisplay={contactPhoneDisplay}
              contactPhoneLink={contactPhoneLink}
              showShippingValue={hasPostalCode}
              freeShippingApplied={freeShippingApplied}
              onApplyCoupon={applyCoupon}
            />
          </form>
        )}
      </main>
      <StorefrontFooter />
      {isPixModalOpen && pixData && (
        <PixPaymentModal
          isOpen={isPixModalOpen}
          onClose={() => setIsPixModalOpen(false)}
          qrCode={pixData.qrCode}
          pixCopyPaste={pixData.copyPaste}
          onCheckPaymentStatus={handleCheckPaymentStatus}
          amount={pixData.total / 100}
        />
      )}
    </div>
  );
}

function CheckoutHeaderBar({
  steps,
  countdown,
  notice,
  currentStep,
}: {
  steps: Step[];
  countdown: string;
  notice: string | null;
  currentStep: Step["id"];
}) {
  const totalSteps = steps.length;
  const progressPercent = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));
  const progressAffirmations: Record<number, string> = {
    1: "Perfeito! Seguimos com seus dados.",
    2: "Falta pouco! Já estamos preparando a embalagem.",
    3: "Estamos quase lá! Só escolher o pagamento.",
  };
  const affirmText = progressAffirmations[currentStep] || "Vamos com calma, passo a passo.";
  return (
    <section className="border-b border-violet-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-violet-900">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-lg">🛡️</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600">Checkout Dermosul</p>
            <p className="text-sm text-violet-700">Compra segura, com acompanhamento de quem entende de pele</p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4 md:pl-10">
          <ol className="flex flex-1 items-center gap-3">
            {steps.map((step, index) => (
              <ProgressStep key={step.id} step={step} isLast={index === steps.length - 1} />
            ))}
          </ol>
          <div className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-fuchsia-600 via-amber-500 to-violet-700 px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_-15px_rgba(168,85,247,0.9)] animate-reservation md:w-auto">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-lg drop-shadow">⚡</span>
            <div className="leading-tight">
              <span className="block text-[10px] uppercase tracking-[0.35em] text-white/80">Oferta garantida</span>
              <div className="mt-0.5 flex items-center gap-2 text-sm">
                <span>Produtos reservados por</span>
                <span className="rounded-lg bg-black/25 px-2 py-0.5 text-[13px] font-bold text-white shadow-inner">
                  {countdown}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full md:flex-[0_0_100%]">
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-violet-600">
            <span>
              Passo {currentStep} de {totalSteps}
            </span>
            <span>{affirmText}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-violet-100">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      {notice && (
        <div className="border-t border-violet-100 bg-violet-50 py-2 text-center text-xs text-violet-700">
          {notice}
        </div>
      )}
    </section>
  );
}

function ProgressStep({ step, isLast }: { step: Step; isLast: boolean }) {
  const baseCircle =
    step.status === "done"
      ? "bg-violet-600 text-white"
      : step.status === "current"
      ? "bg-violet-100 text-violet-700"
      : "bg-zinc-200 text-zinc-500";
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${baseCircle}`}>
        {step.status === "done" ? "✓" : step.id}
      </span>
      <span className="font-medium text-violet-800">{step.label}</span>
      {!isLast && <span className="text-violet-200">/</span>}
    </li>
  );
}

const CheckoutStepCard = forwardRef<HTMLElement, {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}>(({ step, title, description, children, footer }, ref) => {
  return (
    <section ref={ref} className="w-full min-w-0 max-w-full rounded-3xl border border-violet-100 bg-white p-4 shadow-sm sm:p-6 overflow-visible">
      <header className="flex w-full flex-col items-start gap-3 sm:flex-row sm:gap-4">
        <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
          {step}
        </span>
        <div className="w-full break-words">
          <h2 className="text-lg font-semibold text-violet-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-violet-600">{description}</p>}
        </div>
      </header>
      <div className="mt-5 space-y-5 text-sm text-violet-800">{children}</div>
      {footer && <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-violet-100 pt-4">{footer}</div>}
    </section>
  );
});

CheckoutStepCard.displayName = "CheckoutStepCard";

function PaymentMethodCard({
  title,
  description,
  badge,
  active,
  disabled,
  onSelect,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}) {
  const border = active ? "border-violet-500 bg-violet-50" : "border-violet-100 bg-white";
  const opacity = disabled ? "opacity-60" : "";
  return (
    <article className={`w-full min-w-0 max-w-full rounded-2xl border px-4 py-4 shadow-sm transition ${border} ${opacity} overflow-visible flex flex-col gap-4`}>
      <header className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
        <div className="flex w-full items-start gap-3">
          <input
            type="radio"
            name="payment-method"
            className="mt-1 h-4 w-4 text-violet-600"
            checked={!!active}
            onChange={onSelect}
            disabled={disabled}
          />
          <div className="w-full min-w-0 break-words">
            <h3 className="text-sm font-semibold text-violet-900">{title}</h3>
            <p className="mt-1 text-xs text-violet-600">{description}</p>
          </div>
        </div>
        {badge && (
          <span className="inline-flex w-full max-w-full min-w-0 justify-center rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.02em] text-white sm:w-auto sm:px-4 sm:tracking-[0.2em]">
            {badge}
          </span>
        )}
      </header>
      {children && <div className="mt-4">{children}</div>}
    </article>
  );
}

function CheckoutSummary({
  cart,
  cartItems,
  total,
  formatCurrency,
  crossSellItems,
  loadingRecommendations,
  actionMessage,
  onAddCrossSell,
  onRemoveItem,
  contactEmail,
  contactPhoneDisplay,
  contactPhoneLink,
  showShippingValue,
  freeShippingApplied,
  onApplyCoupon,
}: {
  cart: NonNullable<ReturnType<typeof useCart>["cart"]>;
  cartItems: typeof cart.items;
  total: number;
  formatCurrency: (value: number) => string;
  crossSellItems: ProductSummary[];
  loadingRecommendations: boolean;
  actionMessage: string | null;
  onAddCrossSell: (product: ProductSummary) => void;
  onRemoveItem: (productId: string, variantId?: string | null) => void;
  contactEmail: string;
  contactPhoneDisplay: string;
  contactPhoneLink: string;
  showShippingValue: boolean;
  freeShippingApplied: boolean;
  onApplyCoupon: (code: string | null) => Promise<void>;
}) {
  const subtotal = formatCurrency(cart.subtotalCents);
  const discount = cart.discountCents > 0 ? formatCurrency(cart.discountCents) : null;
  const shipping = freeShippingApplied ? "Grátis" : showShippingValue ? formatCurrency(cart.shippingCents) : "Informe o CEP";
  const totalFormatted = formatCurrency(total);
  const appliedCoupon = cart.coupon;
  const couponDiscountValue = cart.couponDiscountCents ?? 0;
  const couponDiscountDisplay = couponDiscountValue > 0 ? formatCurrency(couponDiscountValue) : null;
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);

  function InlineAddButton({ onConfirm }: { onConfirm: () => Promise<void> | void }) {
    const [animating, setAnimating] = useState(false);
    const [pending, setPending] = useState(false);
    const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (animationRef.current) clearTimeout(animationRef.current);
      };
    }, []);

    return (
      <button
        type="button"
        onClick={() => {
          if (pending) return;
          setPending(true);
          setAnimating(true);
          if (animationRef.current) clearTimeout(animationRef.current);
          animationRef.current = setTimeout(() => {
            setAnimating(false);
            animationRef.current = null;
          }, 2500);
          Promise.resolve(onConfirm())
            .catch(() => {
              if (animationRef.current) {
                clearTimeout(animationRef.current);
                animationRef.current = null;
              }
              setAnimating(false);
            })
            .finally(() => {
              setPending(false);
            });
        }}
        disabled={pending}
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition duration-300 ${
          animating
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-violet-200 text-violet-700 hover:border-violet-400 hover:bg-violet-50"
        } ${pending ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {animating ? "adicionado" : "adicionar ao carrinho"}
      </button>
    );
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponStatus("loading");
    setCouponFeedback(null);
    try {
      await onApplyCoupon(couponCode.trim().toUpperCase());
      setCouponStatus("success");
      setCouponFeedback("Cupom aplicado com carinho. Atualizamos os valores imediatamente.");
      setCouponCode("");
    } catch (err: any) {
      setCouponStatus("error");
      setCouponFeedback(err?.message || "Não conseguimos aplicar este cupom. Tente novamente.");
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponStatus("loading");
    setCouponFeedback(null);
    try {
      await onApplyCoupon(null);
      setCouponStatus("success");
      setCouponFeedback("Cupom removido. Você pode testar outro código acima.");
    } catch (err: any) {
      setCouponStatus("error");
      setCouponFeedback(err?.message || "Não conseguimos remover o cupom agora.");
    }
  };

  return (
    <aside className="min-w-0 lg:sticky lg:top-6">
      <div className="space-y-6 rounded-3xl border border-violet-100 bg-white p-6 shadow-lg">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-600">Resumo da compra</p>
            <p className="mt-1 text-3xl font-semibold text-violet-900">{totalFormatted}</p>
          </div>
          <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">Equipe Dermosul</div>
        </header>

        <div className="space-y-2 text-sm text-violet-700">
          <SummaryRow label="Subtotal" value={subtotal} />
          {discount && <SummaryRow label="Descontos" value={`- ${discount}`} />}
          <SummaryRow label="Frete" value={shipping} />
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white/80 p-4 shadow-sm">
          <p className="text-sm font-semibold text-violet-900">Cupom / presente Dermosul</p>
          {appliedCoupon && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-500">Cupom ativo</p>
                  <p className="text-lg font-semibold text-emerald-800">{appliedCoupon.code}</p>
                  <p className="text-xs text-emerald-700">{appliedCoupon.name || "Benefício exclusivo Dermosul"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  disabled={couponStatus === "loading"}
                  className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-900 disabled:opacity-60"
                >
                  Remover
                </button>
              </div>
              <p className="mt-2 text-xs text-emerald-700">
                {appliedCoupon.freeShipping && "Frete grátis liberado. "}
                {couponDiscountDisplay ? `Economia de ${couponDiscountDisplay}.` : null}
                {!appliedCoupon.freeShipping && !couponDiscountDisplay && "Benefício aplicado ao pedido."}
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="Digite seu cupom"
              className="w-full rounded-full border border-violet-200 px-4 py-2 text-sm text-violet-900 outline-none transition focus:border-violet-400 focus:ring-0"
              disabled={couponStatus === "loading"}
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={couponStatus === "loading" || !couponCode.trim()}
              className="inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {couponStatus === "loading" ? "Aplicando..." : "Aplicar"}
            </button>
          </div>
          {couponFeedback && (
            <p className={`mt-2 text-xs ${couponStatus === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {couponFeedback}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-violet-50/70 p-4">
          <p className="text-sm font-semibold text-violet-900">Produtos selecionados</p>
          <ul className="mt-3 space-y-2 text-xs text-violet-700">
            {cartItems.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <span className="font-medium text-violet-900">{item.product.name}</span>
                  <span>
                    {item.quantity}x {formatCurrency(item.unitPriceCents)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.productId, item.variantId ?? null)}
                  className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-violet-100 bg-white/80 p-4">
          <p className="text-sm font-semibold text-violet-900">Aproveite e adicione</p>
          {actionMessage && <p className="mt-1 text-xs text-violet-600">{actionMessage}</p>}
          {loadingRecommendations ? (
            <p className="mt-3 text-xs text-zinc-500">Separando inspirações que combinam com você...</p>
          ) : crossSellItems.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">Assim que surgirem combinações perfeitas, mostramos por aqui.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-xs text-violet-700">
              {crossSellItems.map((product) => (
                <li key={product.id} className="flex items-start gap-3">
                  <img
                    src={product.imageUrl || product.images?.[0]?.url || "/media/placeholder-product.svg"}
                    alt={product.name}
                    loading="lazy"
                    onError={(event) => {
                      const target = event.currentTarget;
                      if (!target.dataset.fallbackLoaded) {
                        target.dataset.fallbackLoaded = "true";
                        target.src = "/media/placeholder-product.svg";
                      }
                    }}
                    className="h-12 w-12 rounded-xl border border-violet-100 object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-violet-900">{product.name}</p>
                    <p>{formatCurrency(product.price)}</p>
                    <div className="mt-2">
                      <InlineAddButton onConfirm={() => onAddCrossSell(product)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <TrustBadges />

        <div className="rounded-2xl bg-violet-600/95 p-5 text-white shadow-lg">
          <h3 className="text-sm font-semibold">Precisa de ajuda?</h3>
          <p className="mt-2 text-sm leading-relaxed">
            Converse agora com o <span className="font-semibold">Assistente Dermosul</span> aqui no chat inteligente, ou fale com nossa equipe pelo
            WhatsApp{" "}
            <a href={contactPhoneLink} className="underline hover:text-violet-100" target="_blank" rel="noopener noreferrer">
              {contactPhoneDisplay}
            </a>{" "}
            e pelo e-mail{" "}
            <a href={`mailto:${contactEmail}`} className="underline hover:text-violet-100">
              {contactEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function formatDisplayPhone(raw: string | undefined | null) {
  if (!raw) return "(11) 4000-0000";
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return raw;
  let local = digitsOnly;
  if (local.length > 11) {
    local = local.slice(local.length - 11);
  }
  if (local.length === 11) {
    const ddd = local.slice(0, 2);
    const first = local.slice(2, 7);
    const second = local.slice(7);
    return `(${ddd}) ${first}-${second}`;
  }
  if (local.length === 10) {
    const ddd = local.slice(0, 2);
    const first = local.slice(2, 6);
    const second = local.slice(6);
    return `(${ddd}) ${first}-${second}`;
  }
  if (local.length === 9) {
    const first = local.slice(0, 5);
    const second = local.slice(5);
    return `${first}-${second}`;
  }
  if (local.length === 8) {
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return raw;
}

function phoneDigitsForWhatsapp(raw: string | undefined | null) {
  if (!raw) return "551140000000";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "551140000000";
  if (digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

function TrustBadges() {
  const badges = [
    { icon: "🔒", text: "Ambiente 100% seguro" },
    { icon: "🧴", text: "As maiores marcas de dermocosméticos em um só lugar" },
    { icon: "📦", text: "Produtos originais com envio garantido pela Dermosul" },
  ];
  return (
    <ul className="grid gap-2 text-xs text-violet-600">
      {badges.map((badge) => (
        <li key={badge.text} className="flex items-center gap-2">
          <span>{badge.icon}</span>
          <span>{badge.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Alert({ tone = "muted", children }: { tone?: "muted" | "error" | "success"; children: ReactNode }) {
  const tones: Record<"muted" | "error" | "success", string> = {
    muted: "border-violet-100 bg-white text-violet-900",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-violet-200 bg-violet-50 text-violet-800",
  };
  return <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm shadow-sm ${tones[tone]}`}>{children}</div>;
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  error,
}: SelectInputProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded border px-3 py-2 transition focus:outline-none focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-zinc-200 focus:border-violet-500 focus:ring-violet-200"
        }`}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  autoComplete,
  error,
  helperText,
  loading,
}: TextInputProps) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className={`rounded border px-3 py-2 transition focus:outline-none focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-zinc-200 focus:border-violet-500 focus:ring-violet-200"
        }`}
      />
      {loading && <span className="text-xs text-violet-500">Consultando...</span>}
      {helperText && !error && <span className="text-xs text-violet-500">{helperText}</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

export function getStoredOrder(orderId: string) {
  const raw = sessionStorage.getItem(ORDER_STORAGE_KEY(orderId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
