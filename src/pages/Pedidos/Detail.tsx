import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type CustomerInfo, type OrderDetail, type ShippingInfo } from "../../lib/api";

// --- Helpers de formatação e máscaras ---
const currency = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const isoDateFromParts = (day?: string, month?: string, year?: string) => {
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const splitDate = (iso?: string) => {
  if (!iso) return { day: "", month: "", year: "" };
  const [year, month, day] = iso.split("-");
  return { day, month, year };
};

const maskCpf = (v?: string) => {
  if (!v) return "";
  const s = v.replace(/\D/g, "");
  return s
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
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

// --- Constantes visuais ---
const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pago: { label: "Pago", className: "border border-emerald-400/50 bg-emerald-500/10 text-emerald-200" },
  aguardar_pagamento: { label: "Aguardando", className: "border border-amber-400/50 bg-amber-500/10 text-amber-200" },
  aguardando_pagamento: { label: "Aguardando", className: "border border-amber-400/50 bg-amber-500/10 text-amber-200" },
  pendente: { label: "Pendente", className: "border border-slate-500/50 bg-slate-500/10 text-slate-200" },
  cancelado: { label: "Cancelado", className: "border border-rose-400/50 bg-rose-500/10 text-rose-200" },
  enviado: { label: "Enviado", className: "border border-sky-400/50 bg-sky-500/10 text-sky-200" },
};

const ALL_STATUSES = ["pago", "aguardando_pagamento", "pendente", "cancelado", "enviado"] as const;

const PANEL_CLASS = "rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-6 shadow-[0_50px_160px_-110px_rgba(34,211,238,0.55)] backdrop-blur-2xl";
const SIDE_PANEL_CLASS = "rounded-3xl border border-slate-800 bg-slate-900/50 px-5 py-5 shadow-[0_40px_120px_-110px_rgba(34,211,238,0.45)]";
const PRIMARY_BUTTON = "inline-flex items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BUTTON = "inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60";
const DANGER_BUTTON = "inline-flex items-center justify-center rounded-full border border-rose-500/60 bg-rose-500/10 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60";

const inputClass = (hasError?: boolean) =>
  [
    "w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-400/60 focus:ring-0",
    hasError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60",
  ].join(" ");

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

    const orderId = id;
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getOrderById(orderId);
        if (alive) {
          setOrderData(data);
          setFormState({
            status: data.status,
            customer: data.customer,
            shipping: data.shipping,
          });
        }
      } catch (e: any) {
        if (alive) {
          setError(e.message || "Falha ao carregar pedido");
          console.error("Erro ao carregar pedido:", e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id]);

  // Carrega notas
  useEffect(() => {
    if (!id) return;

    const orderId = id;
    let mounted = true;
    async function loadNotes() {
      try {
        const response = await api.getOrderNotes(orderId);
        if (mounted) setNotes(response.notes || "");
      } catch {
        // ignora erros de notas
      }
    }
    loadNotes();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Handlers de formulário
  const handleCustomerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id: inputId, value } = event.target;
    const field = inputId.replace("customer-", "");
    setFormState((prev) => ({
      ...prev,
      customer: { ...(prev.customer || ({} as CustomerInfo)), [field]: value },
    }));
    setValidationErrors((prev) => ({ ...prev, [`customer_${field}`]: undefined }));
  };

  const handleBirthdateChange = (field: "day" | "month" | "year", value: string) => {
    setFormState((prev) => {
      const current = splitDate(prev.customer?.birthdate);
      const next = { ...current, [field]: value };
      return {
        ...prev,
        customer: {
          ...(prev.customer || ({} as CustomerInfo)),
          birthdate: isoDateFromParts(next.day, next.month, next.year),
        },
      };
    });
    setValidationErrors((prev) => ({ ...prev, customer_birthdate: undefined }));
  };

  const handleShippingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { id: inputId, value } = event.target;
    const field = inputId.replace("shipping-", "");
    setFormState((prev) => ({
      ...prev,
      shipping: { ...(prev.shipping || ({} as ShippingInfo)), [field]: value },
    }));
    setValidationErrors((prev) => ({ ...prev, [`shipping_${field}`]: undefined }));
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, status: event.target.value as OrderDetail["status"] }));
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
          birthdate: isoDateFromParts(
            splitDate(formState.customer?.birthdate).day,
            splitDate(formState.customer?.birthdate).month,
            splitDate(formState.customer?.birthdate).year
          ),
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
        customer: updatedOrder.customer || ({} as CustomerInfo),
        shipping: updatedOrder.shipping || ({} as ShippingInfo),
      });
      setSaveMessage("Pedido atualizado com sucesso!");
    } catch (e: any) {
      console.error("Erro ao salvar pedido:", e);
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.errors) {
          setValidationErrors(parsed.errors);
          setError("Revise os campos sinalizados e tente novamente.");
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#05080f] text-slate-200">
        Carregando pedido…
      </div>
    );
  }

  if (error && !orderData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#05080f] text-slate-200">
        <p>Falha ao carregar pedido: {error}</p>
        <Link to="/dashboard/pedidos" className={SECONDARY_BUTTON}>
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#05080f] text-slate-200">
        <p>Pedido não encontrado.</p>
        <Link to="/dashboard/pedidos" className={SECONDARY_BUTTON}>
          Voltar aos pedidos
        </Link>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[orderData.status] || {
    label: orderData.status,
    className: "border border-slate-600 bg-slate-800/60 text-slate-300",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-12 space-y-8">
        <header className="rounded-4xl border border-slate-800 bg-[#071024]/80 px-6 py-8 shadow-[0_60px_160px_-90px_rgba(34,211,238,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Pedido #{orderData.id}</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
                <span className="text-sm text-slate-400">Recebido em {brDate(orderData.createdAt)}</span>
              </div>
              <p className="max-w-xl text-sm text-slate-400">
                Gerencie status, dados de cliente e logística sem sair do cockpit. Todas as alterações são registradas em tempo real na
                Dermosul Commerce OS.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard/pedidos" className={SECONDARY_BUTTON}>
                Voltar
              </Link>
              <button type="button" onClick={() => window.print()} className={PRIMARY_BUTTON}>
                Imprimir
              </button>
            </div>
          </div>
        </header>

        {saveMessage && <Alert tone="success" message={saveMessage} />}
        {error && <Alert tone="error" message={error} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className={PANEL_CLASS}>
              <SectionHeader
                eyebrow="Fluxo operacional"
                title="Status do pedido"
                description="Mantenha clientes e outros squads sincronizados com o estágio atual da compra."
              />
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <select
                  id="order-status"
                  data-testid="order-status"
                  value={formState.status ?? orderData.status}
                  onChange={handleStatusChange}
                  className={`${inputClass(!!validationErrors.status)} w-full max-w-xs`}
                  disabled={isSaving}
                >
                  {ALL_STATUSES.map((statusKey) => (
                    <option key={statusKey} value={statusKey}>
                      {statusKey.replace(/_/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())}
                    </option>
                  ))}
                </select>
                <button id="order-save" data-testid="order-save" onClick={handleSave} className={PRIMARY_BUTTON} disabled={isSaving}>
                  {isSaving ? "Salvando…" : "Salvar"}
                </button>
              </div>
              {validationErrors.status && <InlineError message={validationErrors.status} />}
            </section>

            <section className={PANEL_CLASS}>
              <SectionHeader
                eyebrow="Cliente"
                title="Informações do comprador"
                description="Atualize dados pessoais e de contato para garantir comunicação assertiva."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  id="customer-firstName"
                  label="Nome"
                  value={formState.customer?.firstName ?? ""}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_firstName}
                />
                <Field
                  id="customer-lastName"
                  label="Sobrenome"
                  value={formState.customer?.lastName ?? ""}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_lastName}
                />
                <Field
                  id="customer-cpf"
                  label="CPF"
                  value={maskCpf(formState.customer?.cpf)}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_cpf}
                />
                <BirthdateField
                  birthdate={formState.customer?.birthdate}
                  onChange={handleBirthdateChange}
                  error={validationErrors.customer_birthdate}
                />
                <Field
                  id="customer-gender"
                  label="Gênero"
                  value={formState.customer?.gender ?? ""}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_gender}
                />
                <Field
                  id="customer-email"
                  label="Email"
                  type="email"
                  value={formState.customer?.email ?? ""}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_email}
                />
                <Field
                  id="customer-phone"
                  label="Telefone"
                  value={maskPhone(formState.customer?.phone)}
                  onChange={handleCustomerChange}
                  error={validationErrors.customer_phone}
                />
              </div>
            </section>

            <section className={PANEL_CLASS}>
              <SectionHeader
                eyebrow="Logística"
                title="Endereço de entrega"
                description="Confirme os dados para garantir SLA de entrega e geração de etiquetas."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  id="shipping-postalCode"
                  label="CEP"
                  value={maskCep(formState.shipping?.postalCode)}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_postalCode}
                />
                <Field
                  id="shipping-address1"
                  label="Rua"
                  value={formState.shipping?.address1 ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_address1}
                />
                <Field
                  id="shipping-address2"
                  label="Número"
                  value={formState.shipping?.address2 ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_address2}
                />
                <Field
                  id="shipping-address2_complement"
                  label="Complemento (opcional)"
                  value={formState.shipping?.address2_complement ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_address2_complement}
                />
                <Field
                  id="shipping-district"
                  label="Bairro"
                  value={formState.shipping?.district ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_district}
                />
                <Field
                  id="shipping-city"
                  label="Cidade"
                  value={formState.shipping?.city ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_city}
                />
                <Field
                  id="shipping-state"
                  label="Estado (UF)"
                  value={formState.shipping?.state ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_state}
                />
                <Field
                  id="shipping-country"
                  label="País"
                  value={formState.shipping?.country ?? ""}
                  onChange={handleShippingChange}
                  error={validationErrors.shipping_country}
                />
              </div>
            </section>

            <section className={PANEL_CLASS}>
              <SectionHeader
                eyebrow="Itens"
                title="Resumo do carrinho"
                description="Visualize o que foi comprado e monitore valores unitários e totais."
              />
              <div className="overflow-hidden rounded-3xl border border-slate-800">
                <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
                  <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.25em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Produto</th>
                      <th className="px-4 py-3 text-center">Qtd.</th>
                      <th className="px-4 py-3 text-right">Preço unit.</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderData.items.map((item, index) => (
                      <tr key={`${item.sku}-${index}`} className="divide-y divide-slate-800/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-500 font-mono">SKU: {item.sku}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-300">{item.qty}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{currency(item.price)}</td>
                        <td className="px-4 py-3 text-right text-slate-100">{currency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <aside className={SIDE_PANEL_CLASS}>
              <h2 className="text-lg font-semibold text-slate-100">Resumo financeiro</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal dos itens</span>
                  <span>{currency(orderData.totals.itemsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Frete</span>
                  <span>{currency(orderData.totals.shipping)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Desconto</span>
                  <span className="text-rose-300">- {currency(orderData.totals.discount)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-3 text-base font-semibold text-slate-100">
                  <span>Total</span>
                  <span>{currency(orderData.totals.grandTotal)}</span>
                </div>
              </div>
            </aside>

            <aside className={SIDE_PANEL_CLASS}>
              <h2 className="text-lg font-semibold text-slate-100">Pagamento</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>
                  <span className="font-semibold text-slate-100">{orderData.payment.method}</span>
                  {orderData.payment.installments > 1 && <span className="text-slate-400"> em {orderData.payment.installments}x</span>}
                </p>
                <p className="text-slate-400">
                  Status: <span className="font-semibold text-sky-200">{orderData.payment.status}</span>
                </p>
                <p>
                  Valor pago: <span className="font-semibold text-slate-100">{currency(orderData.payment.paidAmount)}</span>
                </p>
              </div>
            </aside>

            <aside className={SIDE_PANEL_CLASS}>
              <h2 className="text-lg font-semibold text-slate-100">Anotações</h2>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Compartilhe contexto com o squad de experiência ou logística…"
                className="mt-4 min-h-[140px] w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-400/60 focus:ring-0"
              />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={handleSaveNotes} disabled={notesSaving} className={PRIMARY_BUTTON}>
                  {notesSaving ? "Salvando…" : "Salvar anotações"}
                </button>
                {notesMessage && <span className="text-sm text-slate-400">{notesMessage}</span>}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Componentes auxiliares ---
function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-6 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p>
      <h2 className="text-2xl font-semibold text-slate-100">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </header>
  );
}

function Field({ id, label, value, onChange, type = "text", error }: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="space-y-2 text-sm">
      <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</span>
      <input
        id={id}
        data-testid={id}
        type={type}
        value={value}
        onChange={onChange}
        className={inputClass(!!error)}
      />
      {error && <InlineError message={error} />}
    </label>
  );
}

function BirthdateField({ birthdate, onChange, error }: {
  birthdate?: string;
  onChange: (field: "day" | "month" | "year", value: string) => void;
  error?: string;
}) {
  const parts = splitDate(birthdate);
  return (
    <div className="space-y-2 text-sm">
      <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Nascimento</span>
      <div className="flex gap-3">
        <input
          id="customer-birthdate-day"
          data-testid="customer-birthdate-day"
          type="text"
          placeholder="DD"
          value={parts.day}
          onChange={(event) => onChange("day", event.target.value)}
          maxLength={2}
          className={`${inputClass(!!error)} w-1/3`}
        />
        <input
          id="customer-birthdate-month"
          data-testid="customer-birthdate-month"
          type="text"
          placeholder="MM"
          value={parts.month}
          onChange={(event) => onChange("month", event.target.value)}
          maxLength={2}
          className={`${inputClass(!!error)} w-1/3`}
        />
        <input
          id="customer-birthdate-year"
          data-testid="customer-birthdate-year"
          type="text"
          placeholder="AAAA"
          value={parts.year}
          onChange={(event) => onChange("year", event.target.value)}
          maxLength={4}
          className={`${inputClass(!!error)} w-1/3`}
        />
      </div>
      {error && <InlineError message={error} />}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return <p className="text-xs text-rose-200">{message}</p>;
}

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  const palette = tone === "success"
    ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-100"
    : "border-rose-500/40 bg-rose-900/30 text-rose-100";
  return <div className={`rounded-3xl border px-4 py-3 text-sm ${palette}`}>{message}</div>;
}
