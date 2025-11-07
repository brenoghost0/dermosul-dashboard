import { FormEvent, useEffect, useState } from "react";
import { StoreDomainSettings } from "../api";
import { useStoreSettingsContext } from "../StoreSettingsContext";

const DEFAULT_DOMAIN: StoreDomainSettings = {
  primaryDomain: "",
  subdomain: "store.dermosul.com.br",
  previewDomain: "https://preview.dermosul.com.br",
  customDomains: [],
};

interface DomainFormState {
  primaryDomain: string;
  subdomain: string;
  previewDomain: string;
  customDomains: string;
}

export default function DomainSection() {
  const { settings, loading, error, saving, update } = useStoreSettingsContext();
  const [form, setForm] = useState<DomainFormState>({
    primaryDomain: "",
    subdomain: DEFAULT_DOMAIN.subdomain || "",
    previewDomain: DEFAULT_DOMAIN.previewDomain || "",
    customDomains: "",
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const domain = settings.domainSettings || DEFAULT_DOMAIN;
    setForm({
      primaryDomain: domain.primaryDomain || "",
      subdomain: domain.subdomain || DEFAULT_DOMAIN.subdomain || "",
      previewDomain: domain.previewDomain || DEFAULT_DOMAIN.previewDomain || "",
      customDomains: (domain.customDomains || []).join("\n"),
    });
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const domains = form.customDomains
        .split(/\r?\n/)
        .map((domain) => domain.trim())
        .filter(Boolean);
      await update({
        domainSettings: {
          primaryDomain: form.primaryDomain || undefined,
          subdomain: form.subdomain || undefined,
          previewDomain: form.previewDomain || undefined,
          customDomains: domains,
        },
      });
      setFeedback("Domínios atualizados com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar domínios.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-violet-900">Domínios</h2>
        <p className="text-sm text-zinc-600">Configure domínio principal, subdomínio e ambientes de preview.</p>
      </header>

      {(loading || !settings) && <p className="text-sm text-zinc-500">Carregando configurações...</p>}

      {!loading && settings && (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-violet-700">{feedback}</p>}

          <TextInput
            label="Domínio principal"
            value={form.primaryDomain}
            onChange={(value) => setForm((prev) => ({ ...prev, primaryDomain: value }))}
            placeholder="loja.dermosul.com.br"
          />
          <TextInput
            label="Subdomínio padrão"
            value={form.subdomain}
            onChange={(value) => setForm((prev) => ({ ...prev, subdomain: value }))}
            placeholder="store.dermosul.com.br"
          />
          <TextInput
            label="Preview"
            value={form.previewDomain}
            onChange={(value) => setForm((prev) => ({ ...prev, previewDomain: value }))}
            placeholder="https://preview.dermosul.com.br"
          />
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-600">Domínios customizados (um por linha)</span>
            <textarea
              value={form.customDomains}
              onChange={(event) => setForm((prev) => ({ ...prev, customDomains: event.target.value }))}
              rows={4}
              className="rounded border border-zinc-200 px-3 py-2 font-mono text-xs"
            />
          </label>

          <div className="flex gap-3">
            <button type="submit" disabled={disabled} className="primary-action">
              {disabled ? "Salvando..." : "Salvar domínios"}
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  primaryDomain: DEFAULT_DOMAIN.primaryDomain || "",
                  subdomain: DEFAULT_DOMAIN.subdomain || "",
                  previewDomain: DEFAULT_DOMAIN.previewDomain || "",
                  customDomains: (DEFAULT_DOMAIN.customDomains || []).join("\n"),
                })
              }
              className="secondary-action"
            >
              Restaurar padrão
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}
