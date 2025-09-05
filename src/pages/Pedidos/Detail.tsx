import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type OrderDetail, type CustomerInfo, type ShippingInfo } from "../../lib/api";

// --- Helpers de formatação e máscaras ---
const currency = (v?: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z"); // Trata como UTC para evitar problemas de fuso horário
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const isoDate = (day?: string, month?: string, year?: string) => {
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const splitDate = (iso?: string) => {
  if (!iso) return { day: "", month: "", year: "" };
  const [year, month, day] = iso.split("-");
  return { day, month, year };
};

const maskCpf = (v?: string) => {
  if (!v) return "";
  const s = v.replace(/\D/g, "");
  return s.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
const unmaskCpf = (v?: string) => (v || "").replace(/\D/g, "");

const maskCep = (v?: string) => {
  if (!v) return "";
  const s = v.replace(/\D/g, "");
  return s.replace(/(\d{5})(\d)/, "$1-$2");
};
const unmaskCep = (v?: string) => (v || "").replace(/\D/g, "");

const maskPhone = (v?: string) => {
  if (!v) return "";
  const s = v.replace(/\D/g, "");
  if (s.length <= 10) return s.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return s.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3");
};
const unmaskPhone = (v?: string) => (v || "").replace(/\D/g, "");

// --- Constantes ---
const STATUS_COLORS: { [key: string]: string } = {
  pago: "bg-emerald-100 text-emerald-700",
  pendente: "bg-amber-100 text-amber-700",
  aguardando_pagamento: "bg-amber-100 text-amber-700",
  cancelado: "bg-rose-100 text-rose-700",
  enviado: "bg-sky-100 text-sky-700",
};
const ALL_STATUSES = ["pago", "aguardando_pagamento", "pendente", "cancelado", "enviado"];

// --- Componente principal ---
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [orderData, setOrderData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<Partial<OrderDetail>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [notes, setNotes] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  // Carrega dados do pedido
  useEffect(() => {
    if (!id) {
      setError("ID do pedido não fornecido.");
      setLoading(false);
      return;
    }

    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getOrderById(id!);
        if (alive) {
          setOrderData(data);
          const initialFormState = {
            status: data.status,
            customer: data.customer,
            shipping: data.shipping,
          };
          setFormState(initialFormState);
        }
      } catch (e: any) {
        if (alive) {
          const errorMessage = e.message || "Falha ao carregar pedido";
          setError(errorMessage);
          console.error("Erro ao carregar pedido:", e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [id]);

  // Carrega notas do pedido
  useEffect(() => {
    let mounted = true;
    async function loadNotes() {
      if (!id) return;
      try {
        const r = await api.getOrderNotes(id);
        if (mounted) setNotes(r.notes || "");
      } catch (e) {
        // silencioso
      }
    }
    loadNotes();
    return () => { mounted = false; };
  }, [id]);

  // Handlers de mudança de input
  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const field = id.replace("customer-", "");
    setFormState((prev) => ({
      ...prev,
      customer: { ...(prev.customer || {} as CustomerInfo), [field]: value },
    }));
    setValidationErrors((prev) => ({ ...prev, [`customer_${field}`]: undefined }));
  };

  const handleBirthdateChange = (field: 'day' | 'month' | 'year', value: string) => {
    setFormState((prev) => {
      const currentBirthdate = prev.customer?.birthdate ? splitDate(prev.customer.birthdate) : { day: "", month: "", year: "" };
      const newBirthdate = { ...currentBirthdate, [field]: value };
      return {
        ...prev,
        customer: {
          ...(prev.customer || {} as CustomerInfo),
          birthdate: isoDate(newBirthdate.day, newBirthdate.month, newBirthdate.year),
        },
      };
    });
    setValidationErrors((prev) => ({ ...prev, customer_birthdate: undefined }));
  };

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const field = id.replace("shipping-", "");
    setFormState((prev) => ({
      ...prev,
      shipping: { ...(prev.shipping || {} as ShippingInfo), [field]: value },
    }));
    setValidationErrors((prev) => ({ ...prev, [`shipping_${field}`]: undefined }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, status: e.target.value as OrderDetail['status'] }));
    setValidationErrors((prev) => ({ ...prev, status: undefined }));
  };

  const handleSaveNotes = async () => {
    if (!id || notesSaving) return;
    setNotesSaving(true);
    setNotesMessage(null);
    try {
      await api.saveOrderNotes(id, notes);
      setNotesMessage("Anotações salvas!");
    } catch (e: any) {
      setNotesMessage(e?.message || "Falha ao salvar anotações.");
    } finally {
      setNotesSaving(false);
      setTimeout(() => setNotesMessage(null), 3000);
    }
  };

  // Salvar alterações
  const handleSave = async () => {
    if (!id || isSaving) return;

    setIsSaving(true);
    setSaveMessage(null);
    setValidationErrors({});
    setError(null);

    try {
      const payload: Partial<OrderDetail> = {
        status: formState.status,
        customer: {
          ...formState.customer,
          cpf: unmaskCpf(formState.customer?.cpf),
          birthdate: isoDate(formState.customer?.birthdate),
          phone: unmaskPhone(formState.customer?.phone),
        } as CustomerInfo,
        shipping: {
          ...formState.shipping,
          postalCode: unmaskCep(formState.shipping?.postalCode),
        } as ShippingInfo,
      };

      const updatedOrder = await api.saveOrder(id, payload);
      setOrderData(updatedOrder);
      setFormState({
        status: updatedOrder.status,
        customer: updatedOrder.customer || {} as CustomerInfo, // Garante que customer seja um objeto
        shipping: updatedOrder.shipping || {} as ShippingInfo, // Garante que shipping seja um objeto
      });
      setSaveMessage("Pedido atualizado com sucesso!");
    } catch (e: any) {
      console.error("Erro ao salvar pedido:", e);
      try {
        const errorObj = JSON.parse(e.message);
        if (errorObj.errors) {
          setValidationErrors(errorObj.errors);
          setError("Por favor, corrija os erros no formulário.");
        } else {
          setError(e.message || "Falha ao salvar pedido.");
        }
      } catch {
        setError(e.message || "Falha ao salvar pedido.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Carregando pedido...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-red-600">
        Falha ao carregar pedido: {error}{" "}
        <Link to="/dashboard/pedidos" className="underline ml-2">Voltar</Link>
      </div>
    );
  }
  if (!orderData) {
    return (
      <div className="p-6">
        Pedido não encontrado. <Link to="/dashboard/pedidos" className="underline">Voltar</Link>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[orderData.status] || "bg-gray-100 text-gray-700";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800">Pedido #{orderData.id}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
              {orderData.status}
            </span>
            <span className="text-sm text-zinc-500">
              em {brDate(orderData.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/pedidos" className="px-4 py-2 rounded-md border bg-white hover:bg-zinc-50">
            Voltar
          </Link>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-emerald-700 text-white hover:bg-emerald-800">
            Imprimir
          </button>
        </div>
      </div>

      {/* Mensagens de feedback */}
      {saveMessage && <div className="bg-green-100 text-green-700 p-3 rounded-md mb-4">{saveMessage}</div>}
      {error && <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status e Salvar */}
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold mb-4">Status do Pedido</h2>
            <div className="flex items-center space-x-4">
              <select
                id="order-status"
                data-testid="order-status"
                value={formState.status ?? orderData.status}
                onChange={handleStatusChange}
                className={`border rounded-md px-3 py-2 ${validationErrors.status ? 'border-red-500' : 'border-gray-300'}`}
                disabled={isSaving}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <button
                id="order-save"
                data-testid="order-save"
                onClick={handleSave}
                className="px-4 py-2 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
            {validationErrors.status && <p className="text-red-500 text-sm mt-1">{validationErrors.status}</p>}
          </div>

          {/* Informações do Cliente */}
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold mb-4">Informações do Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="customer-firstName" className="block text-sm text-gray-600">Nome</label>
                <input
                  id="customer-firstName"
                  data-testid="customer-firstName"
                  type="text"
                  value={formState.customer?.firstName ?? ""}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_firstName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_firstName && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_firstName}</p>}
              </div>
              <div>
                <label htmlFor="customer-lastName" className="block text-sm text-gray-600">Sobrenome</label>
                <input
                  id="customer-lastName"
                  data-testid="customer-lastName"
                  type="text"
                  value={formState.customer?.lastName ?? ""}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_lastName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_lastName && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_lastName}</p>}
              </div>
              <div>
                <label htmlFor="customer-cpf" className="block text-sm text-gray-600">CPF</label>
                <input
                  id="customer-cpf"
                  data-testid="customer-cpf"
                  type="text"
                  value={maskCpf(formState.customer?.cpf)}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_cpf ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_cpf && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_cpf}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nascimento</label>
                <div className="flex gap-2">
                  <input
                    id="customer-birthdate-day"
                    data-testid="customer-birthdate-day"
                    type="text"
                    placeholder="DD"
                    value={splitDate(formState.customer?.birthdate).day}
                    onChange={(e) => handleBirthdateChange('day', e.target.value)}
                    maxLength={2}
                    className={`w-1/3 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_birthdate ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <input
                    id="customer-birthdate-month"
                    data-testid="customer-birthdate-month"
                    type="text"
                    placeholder="MM"
                    value={splitDate(formState.customer?.birthdate).month}
                    onChange={(e) => handleBirthdateChange('month', e.target.value)}
                    maxLength={2}
                    className={`w-1/3 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_birthdate ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <input
                    id="customer-birthdate-year"
                    data-testid="customer-birthdate-year"
                    type="text"
                    placeholder="YYYY"
                    value={splitDate(formState.customer?.birthdate).year}
                    onChange={(e) => handleBirthdateChange('year', e.target.value)}
                    maxLength={4}
                    className={`w-1/3 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_birthdate ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>
                {validationErrors.customer_birthdate && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_birthdate}</p>}
              </div>
              <div>
                <label htmlFor="customer-gender" className="block text-sm text-gray-600">Gênero</label>
                <input
                  id="customer-gender"
                  data-testid="customer-gender"
                  type="text"
                  value={formState.customer?.gender ?? ""}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_gender ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_gender && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_gender}</p>}
              </div>
              <div>
                <label htmlFor="customer-email" className="block text-sm text-gray-600">Email</label>
                <input
                  id="customer-email"
                  data-testid="customer-email"
                  type="email"
                  value={formState.customer?.email ?? ""}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_email ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_email && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_email}</p>}
              </div>
              <div>
                <label htmlFor="customer-phone" className="block text-sm text-gray-600">Telefone</label>
                <input
                  id="customer-phone"
                  data-testid="customer-phone"
                  type="text"
                  value={maskPhone(formState.customer?.phone)}
                  onChange={handleCustomerChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.customer_phone ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.customer_phone && <p className="text-red-500 text-sm mt-1">{validationErrors.customer_phone}</p>}
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="rounded-xl border p-4 bg-white">
            <h2 className="font-semibold mb-4">Endereço de Entrega</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="shipping-postalCode" className="block text-sm text-gray-600">CEP</label>
                <input
                  id="shipping-postalCode"
                  data-testid="shipping-postalCode"
                  type="text"
                  value={maskCep(formState.shipping?.postalCode)}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_postalCode ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_postalCode && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_postalCode}</p>}
              </div>
              <div>
                <label htmlFor="shipping-address1" className="block text-sm text-gray-600">Rua</label>
                <input
                  id="shipping-address1"
                  data-testid="shipping-address1"
                  type="text"
                  value={formState.shipping?.address1 ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_address1 ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_address1 && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_address1}</p>}
              </div>
              <div>
                <label htmlFor="shipping-address2" className="block text-sm text-gray-600">Número</label>
                <input
                  id="shipping-address2"
                  data-testid="shipping-address2"
                  type="text"
                  value={formState.shipping?.address2 ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_address2 ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_address2 && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_address2}</p>}
              </div>
              <div>
                <label htmlFor="shipping-address2_complement" className="block text-sm text-gray-600">Complemento (Opcional)</label>
                <input
                  id="shipping-address2_complement"
                  data-testid="shipping-address2_complement"
                  type="text"
                  value={formState.shipping?.address2_complement ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_address2_complement ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_address2_complement && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_address2_complement}</p>}
              </div>
              <div>
                <label htmlFor="shipping-district" className="block text-sm text-gray-600">Bairro</label>
                <input
                  id="shipping-district"
                  data-testid="shipping-district"
                  type="text"
                  value={formState.shipping?.district ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_district ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_district && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_district}</p>}
              </div>
              <div>
                <label htmlFor="shipping-city" className="block text-sm text-gray-600">Cidade</label>
                <input
                  id="shipping-city"
                  data-testid="shipping-city"
                  type="text"
                  value={formState.shipping?.city ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_city ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_city && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_city}</p>}
              </div>
              <div>
                <label htmlFor="shipping-state" className="block text-sm text-gray-600">Estado (UF)</label>
                <input
                  id="shipping-state"
                  data-testid="shipping-state"
                  type="text"
                  value={formState.shipping?.state ?? ""}
                  onChange={handleShippingChange}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${validationErrors.shipping_state ? 'border-red-500' : 'border-gray-300'}`}
                />
                {validationErrors.shipping_state && <p className="text-red-500 text-sm mt-1">{validationErrors.shipping_state}</p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold mb-4 text-zinc-800">Itens do Pedido</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-500">
                  <tr>
                    <th className="py-2 font-medium">Produto</th>
                    <th className="py-2 font-medium text-center">Qtd.</th>
                    <th className="py-2 font-medium text-right">Preço Unit.</th>
                    <th className="py-2 font-medium text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {orderData.items.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-3">{item.name} <span className="text-zinc-400 font-mono text-xs">({item.sku})</span></td>
                      <td className="py-3 text-center">{item.qty}</td>
                      <td className="py-3 text-right">{currency(item.price)}</td>
                      <td className="py-3 text-right">{currency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Coluna lateral */}
        <div className="space-y-6">
          {/* Resumo Financeiro */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold mb-4 text-zinc-800">Resumo Financeiro</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Subtotal dos itens</span>
                <span>{currency(orderData.totals.itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Frete</span>
                <span>{currency(orderData.totals.shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Desconto</span>
                <span className="text-rose-600">- {currency(orderData.totals.discount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Total</span>
                <span>{currency(orderData.totals.grandTotal)}</span>
              </div>
            </div>
          </div>
          {/* Pagamento */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold mb-4 text-zinc-800">Pagamento</h2>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{orderData.payment.method}</span>
                {orderData.payment.installments > 1 && ` em ${orderData.payment.installments}x`}
              </p>
              <p className="text-sm text-zinc-500">Status: <span className="font-medium text-emerald-700">{orderData.payment.status}</span></p>
              <p className="text-zinc-500">Valor Pago: <span className="font-medium">{currency(orderData.payment.paidAmount)}</span></p>
            </div>
          </div>

          {/* Anotações */}
          <div className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold mb-4 text-zinc-800">Anotações</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Escreva observações sobre o pedido..."
              className="w-full min-h-[120px] border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="px-4 py-2 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {notesSaving ? 'Salvando...' : 'Salvar Anotações'}
              </button>
              {notesMessage && <span className="text-sm text-zinc-600">{notesMessage}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
