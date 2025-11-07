import { FormEvent, useEffect, useState } from "react";
import { storeAdminApi, PaymentProvider } from "../api";

interface PaymentFormState {
  id?: string;
  name: string;
  key: string;
  enabled: boolean;
  config: string;
}

const EMPTY_FORM: PaymentFormState = {
  name: "",
  key: "",
  enabled: false,
  config: "",
};

export default function PaymentsSection() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [form, setForm] = useState<PaymentFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listPaymentProviders();
      setProviders(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar provedores de pagamento.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(provider: PaymentProvider) {
    setForm({
      id: provider.id,
      name: provider.name,
      key: provider.key,
      enabled: provider.enabled,
      config: provider.config ? JSON.stringify(provider.config, null, 2) : "",
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
        id: form.id,
        name: form.name,
        key: form.key,
        enabled: form.enabled,
        config: form.config ? safeParseJson(form.config) : null,
      };
      await storeAdminApi.upsertPaymentProvider(payload);
      await loadProviders();
      handleNew();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar provedor de pagamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover provedor?")) return;
    try {
      await storeAdminApi.deletePaymentProvider(id);
      await loadProviders();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover provedor.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Pagamentos</h2>
          <p className="text-sm text-zinc-600">Controle provedores e integrações de pagamento (mockado na fase atual).</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
            <TextInput label="Chave" value={form.key} onChange={(value) => setForm((prev) => ({ ...prev, key: value }))} placeholder="mercado-pago" />
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
              Ativo
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-600">Configuração (JSON)</span>
            <textarea
              value={form.config}
              rows={4}
              onChange={(event) => setForm((prev) => ({ ...prev, config: event.target.value }))}
              className="rounded border border-zinc-200 px-3 py-2 font-mono text-xs"
              placeholder='{ "apiKey": "" }'
            />
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : form.id ? "Atualizar provedor" : "Adicionar provedor"}
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
        <h3 className="mb-4 text-lg font-medium text-violet-900">Provedores cadastrados</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando provedores...</p>
        ) : providers.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum provedor cadastrado.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {providers.map((provider) => (
              <li key={provider.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="font-medium text-zinc-800">{provider.name}</span>
                  <span className="ml-2 text-xs uppercase text-zinc-500">{provider.key}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-1 ${provider.enabled ? "tag" : "chip"}`}>
                    {provider.enabled ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => handleEdit(provider)}
                    className="secondary-action text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("JSON inválido na configuração.");
  }
}
