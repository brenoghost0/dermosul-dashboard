import { FormEvent, useEffect, useState } from "react";
import { StoreSeoSettings } from "../api";
import { useStoreSettingsContext } from "../StoreSettingsContext";

const DEFAULT_SEO: StoreSeoSettings = {
  defaultTitle: "Dermosul | Dermatologia e beleza guiadas por ciência",
  defaultDescription: "Cuidados completos para a pele com a curadoria clínica Dermosul.",
  ogTitle: "Store Dermosul",
  ogDescription: "Conheça dermocosméticos desenvolvidos por dermatologistas Dermosul.",
  metaImageUrl: "/media/dermosul/og-image.png",
  twitterCard: "summary_large_image",
};

interface SeoFormState {
  defaultTitle: string;
  defaultDescription: string;
  metaImageUrl: string;
  ogTitle: string;
  ogDescription: string;
  twitterCard: string;
}

export default function SeoSection() {
  const { settings, loading, error, saving, update } = useStoreSettingsContext();
  const [form, setForm] = useState<SeoFormState>({
    defaultTitle: DEFAULT_SEO.defaultTitle || "",
    defaultDescription: DEFAULT_SEO.defaultDescription || "",
    metaImageUrl: DEFAULT_SEO.metaImageUrl || "",
    ogTitle: DEFAULT_SEO.ogTitle || "",
    ogDescription: DEFAULT_SEO.ogDescription || "",
    twitterCard: DEFAULT_SEO.twitterCard || "summary_large_image",
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const seo = settings.seoSettings || {};
    setForm({
      defaultTitle: settings.defaultTitle || DEFAULT_SEO.defaultTitle || "",
      defaultDescription: settings.defaultDescription || DEFAULT_SEO.defaultDescription || "",
      metaImageUrl: settings.metaImageUrl || DEFAULT_SEO.metaImageUrl || "",
      ogTitle: seo.ogTitle || DEFAULT_SEO.ogTitle || "",
      ogDescription: seo.ogDescription || DEFAULT_SEO.ogDescription || "",
      twitterCard: seo.twitterCard || DEFAULT_SEO.twitterCard || "summary_large_image",
    });
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await update({
        defaultTitle: form.defaultTitle,
        defaultDescription: form.defaultDescription,
        metaImageUrl: form.metaImageUrl,
        seoSettings: {
          defaultTitle: form.defaultTitle,
          defaultDescription: form.defaultDescription,
          ogTitle: form.ogTitle,
          ogDescription: form.ogDescription,
          metaImageUrl: form.metaImageUrl,
          twitterCard: form.twitterCard,
        },
      });
      setFeedback("SEO atualizado com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar SEO.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-violet-900">SEO</h2>
        <p className="text-sm text-zinc-600">Defina títulos padrão, descrições e metadados da Store Dermosul.</p>
      </header>

      {(loading || !settings) && <p className="text-sm text-zinc-500">Carregando configurações...</p>}

      {!loading && settings && (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-violet-700">{feedback}</p>}

          <TextInput
            label="Título padrão"
            value={form.defaultTitle}
            onChange={(value) => setForm((prev) => ({ ...prev, defaultTitle: value }))}
            required
          />
          <TextArea
            label="Descrição padrão"
            value={form.defaultDescription}
            onChange={(value) => setForm((prev) => ({ ...prev, defaultDescription: value }))}
            rows={3}
          />
          <TextInput
            label="Imagem de destaque (OG)"
            value={form.metaImageUrl}
            onChange={(value) => setForm((prev) => ({ ...prev, metaImageUrl: value }))}
            placeholder="https://..."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="OG title" value={form.ogTitle} onChange={(value) => setForm((prev) => ({ ...prev, ogTitle: value }))} />
            <TextArea label="OG description" value={form.ogDescription} onChange={(value) => setForm((prev) => ({ ...prev, ogDescription: value }))} rows={3} />
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-600">Twitter card</span>
            <select
              value={form.twitterCard}
              onChange={(event) => setForm((prev) => ({ ...prev, twitterCard: event.target.value }))}
              className="rounded border border-zinc-200 px-3 py-2"
            >
              <option value="summary">summary</option>
              <option value="summary_large_image">summary_large_image</option>
            </select>
          </label>

          <div className="flex gap-3">
            <button type="submit" disabled={disabled} className="primary-action">
              {disabled ? "Salvando..." : "Salvar SEO"}
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  defaultTitle: DEFAULT_SEO.defaultTitle || "",
                  defaultDescription: DEFAULT_SEO.defaultDescription || "",
                  metaImageUrl: DEFAULT_SEO.metaImageUrl || "",
                  ogTitle: DEFAULT_SEO.ogTitle || "",
                  ogDescription: DEFAULT_SEO.ogDescription || "",
                  twitterCard: DEFAULT_SEO.twitterCard || "summary_large_image",
                })
              }
              className="secondary-action"
            >
              Restaurar padrão Dermosul
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
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}
