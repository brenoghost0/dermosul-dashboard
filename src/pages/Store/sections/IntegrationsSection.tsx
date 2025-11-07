import { FormEvent, useEffect, useState } from "react";
import { StoreIntegrationsSettings } from "../api";
import { useStoreSettingsContext } from "../StoreSettingsContext";

const DEFAULT_INTEGRATIONS: StoreIntegrationsSettings = {
  googleAnalyticsId: "",
  googleTagManagerId: "",
  metaPixelId: "",
  tiktokPixelId: "",
  pinterestTagId: "",
  emailMarketing: { provider: "rd-station", apiKey: "", listId: "" },
  whatsappBusiness: { number: "+55 11 4000-0000", message: "Olá! Gostaria de falar com a Dermosul." },
  customScripts: [],
};

interface IntegrationsFormState {
  googleAnalyticsId: string;
  googleTagManagerId: string;
  metaPixelId: string;
  tiktokPixelId: string;
  pinterestTagId: string;
  emailProvider: string;
  emailApiKey: string;
  emailListId: string;
  whatsappNumber: string;
  whatsappMessage: string;
  customScripts: string;
}

export default function IntegrationsSection() {
  const { settings, loading, error, saving, update } = useStoreSettingsContext();
  const [form, setForm] = useState<IntegrationsFormState>({
    googleAnalyticsId: "",
    googleTagManagerId: "",
    metaPixelId: "",
    tiktokPixelId: "",
    pinterestTagId: "",
    emailProvider: "rd-station",
    emailApiKey: "",
    emailListId: "",
    whatsappNumber: "",
    whatsappMessage: "",
    customScripts: "",
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const integrations = settings.integrations || DEFAULT_INTEGRATIONS;
    setForm({
      googleAnalyticsId: integrations.googleAnalyticsId || "",
      googleTagManagerId: integrations.googleTagManagerId || "",
      metaPixelId: integrations.metaPixelId || "",
      tiktokPixelId: integrations.tiktokPixelId || "",
      pinterestTagId: integrations.pinterestTagId || "",
      emailProvider: integrations.emailMarketing?.provider || "rd-station",
      emailApiKey: integrations.emailMarketing?.apiKey || "",
      emailListId: integrations.emailMarketing?.listId || "",
      whatsappNumber: integrations.whatsappBusiness?.number || "",
      whatsappMessage: integrations.whatsappBusiness?.message || "",
      customScripts: integrations.customScripts && integrations.customScripts.length > 0 ? JSON.stringify(integrations.customScripts, null, 2) : "",
    });
  }, [settings]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const scripts = form.customScripts.trim()
        ? safeParseJson(form.customScripts)
        : [];
      await update({
        integrations: {
          googleAnalyticsId: form.googleAnalyticsId || undefined,
          googleTagManagerId: form.googleTagManagerId || undefined,
          metaPixelId: form.metaPixelId || undefined,
          tiktokPixelId: form.tiktokPixelId || undefined,
          pinterestTagId: form.pinterestTagId || undefined,
          emailMarketing: {
            provider: form.emailProvider || undefined,
            apiKey: form.emailApiKey || undefined,
            listId: form.emailListId || undefined,
          },
          whatsappBusiness: {
            number: form.whatsappNumber || undefined,
            message: form.whatsappMessage || undefined,
          },
          customScripts: Array.isArray(scripts) ? scripts : [],
        },
      });
      setFeedback("Integrações atualizadas com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar integrações.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-violet-900">Integrações</h2>
        <p className="text-sm text-zinc-600">Configure pixels, analytics e ferramentas de marketing Dermosul.</p>
      </header>

      {(loading || !settings) && <p className="text-sm text-zinc-500">Carregando integrações...</p>}

      {!loading && settings && (
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-violet-700">{feedback}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Google Analytics ID" value={form.googleAnalyticsId} onChange={(value) => setForm((prev) => ({ ...prev, googleAnalyticsId: value }))} />
            <TextInput label="Google Tag Manager ID" value={form.googleTagManagerId} onChange={(value) => setForm((prev) => ({ ...prev, googleTagManagerId: value }))} />
            <TextInput label="Meta Pixel ID" value={form.metaPixelId} onChange={(value) => setForm((prev) => ({ ...prev, metaPixelId: value }))} />
            <TextInput label="TikTok Pixel ID" value={form.tiktokPixelId} onChange={(value) => setForm((prev) => ({ ...prev, tiktokPixelId: value }))} />
            <TextInput label="Pinterest Tag ID" value={form.pinterestTagId} onChange={(value) => setForm((prev) => ({ ...prev, pinterestTagId: value }))} />
          </div>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">E-mail marketing</legend>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Provider" value={form.emailProvider} onChange={(value) => setForm((prev) => ({ ...prev, emailProvider: value }))} />
              <TextInput label="API key" value={form.emailApiKey} onChange={(value) => setForm((prev) => ({ ...prev, emailApiKey: value }))} />
              <TextInput label="List ID" value={form.emailListId} onChange={(value) => setForm((prev) => ({ ...prev, emailListId: value }))} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">WhatsApp Business</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Número" value={form.whatsappNumber} onChange={(value) => setForm((prev) => ({ ...prev, whatsappNumber: value }))} />
              <TextInput label="Mensagem padrão" value={form.whatsappMessage} onChange={(value) => setForm((prev) => ({ ...prev, whatsappMessage: value }))} />
            </div>
          </fieldset>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-zinc-600">Scripts customizados (JSON)</span>
            <textarea
              value={form.customScripts}
              rows={4}
              onChange={(event) => setForm((prev) => ({ ...prev, customScripts: event.target.value }))}
              className="rounded border border-zinc-200 px-3 py-2 font-mono text-xs"
              placeholder='[
  {"id":"pixel-hotjar","position":"head","code":"<script>...</script>"}
]'
            />
          </label>

          <div className="flex gap-3">
            <button type="submit" disabled={disabled} className="primary-action">
              {disabled ? "Salvando..." : "Salvar integrações"}
            </button>
            <button
              type="button"
              onClick={() =>
                setForm({
                  googleAnalyticsId: DEFAULT_INTEGRATIONS.googleAnalyticsId || "",
                  googleTagManagerId: DEFAULT_INTEGRATIONS.googleTagManagerId || "",
                  metaPixelId: DEFAULT_INTEGRATIONS.metaPixelId || "",
                  tiktokPixelId: DEFAULT_INTEGRATIONS.tiktokPixelId || "",
                  pinterestTagId: DEFAULT_INTEGRATIONS.pinterestTagId || "",
                  emailProvider: DEFAULT_INTEGRATIONS.emailMarketing?.provider || "rd-station",
                  emailApiKey: DEFAULT_INTEGRATIONS.emailMarketing?.apiKey || "",
                  emailListId: DEFAULT_INTEGRATIONS.emailMarketing?.listId || "",
                  whatsappNumber: DEFAULT_INTEGRATIONS.whatsappBusiness?.number || "",
                  whatsappMessage: DEFAULT_INTEGRATIONS.whatsappBusiness?.message || "",
                  customScripts: DEFAULT_INTEGRATIONS.customScripts && DEFAULT_INTEGRATIONS.customScripts.length > 0 ? JSON.stringify(DEFAULT_INTEGRATIONS.customScripts, null, 2) : "",
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

function safeParseJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error("Scripts devem ser um array de objetos.");
    }
    return parsed;
  } catch (error: any) {
    throw new Error(error?.message || "JSON inválido nos scripts customizados.");
  }
}
