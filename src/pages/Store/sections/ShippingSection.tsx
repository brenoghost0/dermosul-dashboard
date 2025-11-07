import { FormEvent, useEffect, useState } from "react";
import { storeAdminApi, ShippingMethod } from "../api";

interface ShippingFormState {
  id?: string;
  name: string;
  carrier: string;
  flatPrice: string;
  freeOver: string;
  deliveryEtaText: string;
  active: boolean;
  zipRange: string;
}

const EMPTY_FORM: ShippingFormState = {
  name: "",
  carrier: "Correios",
  flatPrice: "0",
  freeOver: "",
  deliveryEtaText: "Entrega em até 5 dias úteis",
  active: true,
  zipRange: "",
};

export default function ShippingSection() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [form, setForm] = useState<ShippingFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMethods();
  }, []);

  async function loadMethods() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listShippingMethods();
      setMethods(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar métodos de frete.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(method: ShippingMethod) {
    setForm({
      id: method.id,
      name: method.name,
      carrier: method.carrier || "",
      flatPrice: centsToCurrency(method.flatPriceCents),
      freeOver: method.freeOverCents ? centsToCurrency(method.freeOverCents) : "",
      deliveryEtaText: method.deliveryEtaText || "",
      active: method.active,
      zipRange: method.zipRange ? JSON.stringify(method.zipRange, null, 2) : "",
    });
  }

  function handleNew() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        carrier: form.carrier || null,
        flatPriceCents: currencyToCents(form.flatPrice),
        freeOverCents: form.freeOver ? currencyToCents(form.freeOver) : null,
        deliveryEtaText: form.deliveryEtaText || null,
        active: form.active,
        zipRange: form.zipRange ? safeParseJson(form.zipRange) : null,
      } as any;

      if (form.id) {
        await storeAdminApi.updateShippingMethod(form.id, payload);
      } else {
        await storeAdminApi.createShippingMethod(payload);
      }
      await loadMethods();
      handleNew();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar método de frete.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover método de frete?")) return;
    try {
      await storeAdminApi.deleteShippingMethod(id);
      await loadMethods();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover método.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Frete</h2>
          <p className="text-sm text-zinc-600">Defina métodos, valores e faixas de CEP atendidos pela Dermosul.</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nome do método" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
            <TextInput label="Transportadora" value={form.carrier} onChange={(value) => setForm((prev) => ({ ...prev, carrier: value }))} />
            <TextInput label="Valor fixo (R$)" value={form.flatPrice} onChange={(value) => setForm((prev) => ({ ...prev, flatPrice: value }))} />
            <TextInput label="Frete grátis acima de (R$)" value={form.freeOver} onChange={(value) => setForm((prev) => ({ ...prev, freeOver: value }))} />
            <TextInput label="Prazo estimado" value={form.deliveryEtaText} onChange={(value) => setForm((prev) => ({ ...prev, deliveryEtaText: value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
            Método ativo
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-600">Faixa de CEP (JSON)</span>
            <textarea
              value={form.zipRange}
              rows={4}
              onChange={(event) => setForm((prev) => ({ ...prev, zipRange: event.target.value }))}
              className="rounded border border-zinc-200 px-3 py-2 font-mono text-xs"
              placeholder='{ "prefixes": ["010", "011"] }'
            />
            <span className="text-xs text-zinc-500">Aceita chaves como prefixes, ranges ou list.</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : form.id ? "Atualizar método" : "Adicionar método"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={handleNew}
                className="secondary-action"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-violet-900">Métodos cadastrados</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando métodos...</p>
        ) : methods.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum método cadastrado.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {methods.map((method) => (
              <li key={method.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="font-medium text-zinc-800">{method.name}</span>
                  <span className="ml-2 text-xs text-zinc-500">{method.deliveryEtaText || "Prazo não definido"}</span>
                  <div className="text-xs text-zinc-500">
                    {formatCurrency(method.flatPriceCents)} {method.freeOverCents ? `• Frete grátis acima de ${formatCurrency(method.freeOverCents)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-1 ${method.active ? "tag" : "chip"}`}>
                    {method.active ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => handleEdit(method)}
                    className="secondary-action text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="danger-action text-xs"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}

function centsToCurrency(value: number) {
  return (value / 100).toFixed(2);
}

function currencyToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(/,/g, ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("JSON inválido para faixa de CEP.");
  }
}
