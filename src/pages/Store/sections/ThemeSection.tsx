import { FormEvent, useEffect, useMemo, useState } from "react";
import { useStoreSettingsContext } from "../StoreSettingsContext";
import type { StoreTypography } from "../api";
import { FieldLabel, INPUT_CLASS, PANEL_CLASS, SectionHeader, SELECT_CLASS, SUBPANEL_CLASS } from "../ui";

const FONT_OPTIONS = [
  "Montserrat",
  "Inter",
  "Rubik",
  "DM Sans",
  "Work Sans",
  "Nunito",
  "Poppins",
  "Raleway",
];

const DEFAULT_COLORS = {
  primary: "#6C4AB6",
  secondary: "#452A8B",
  accent: "#C8B0F4",
};

type ThemeFormState = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  faviconUrl: string;
  appleTouchIconUrl: string;
  headingFont: string;
  bodyFont: string;
};

const INITIAL_STATE: ThemeFormState = {
  primaryColor: DEFAULT_COLORS.primary,
  secondaryColor: DEFAULT_COLORS.secondary,
  accentColor: DEFAULT_COLORS.accent,
  logoUrl: "",
  faviconUrl: "",
  appleTouchIconUrl: "",
  headingFont: FONT_OPTIONS[0],
  bodyFont: FONT_OPTIONS[1],
};

function buildTypography(headingFont: string, bodyFont: string): StoreTypography {
  return {
    heading: {
      fontFamily: `'${headingFont}', sans-serif`,
      fontWeight: 600,
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
    },
    body: {
      fontFamily: `'${bodyFont}', sans-serif`,
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: "0em",
    },
  };
}

export default function ThemeSection() {
  const { settings, loading, saving, error, update } = useStoreSettingsContext();
  const [form, setForm] = useState<ThemeFormState>(INITIAL_STATE);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [savingState, setSavingState] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setForm({
      primaryColor: settings.primaryColor || DEFAULT_COLORS.primary,
      secondaryColor: settings.secondaryColor || DEFAULT_COLORS.secondary,
      accentColor: settings.accentColor || DEFAULT_COLORS.accent,
      logoUrl: settings.logoUrl || "",
      faviconUrl: settings.faviconUrl || "",
      appleTouchIconUrl: settings.appleTouchIconUrl || "",
      headingFont: extractFont(settings.typography?.heading?.fontFamily, FONT_OPTIONS[0]),
      bodyFont: extractFont(settings.typography?.body?.fontFamily, FONT_OPTIONS[1]),
    });
  }, [settings]);

  const typographyPreview = useMemo(
    () => buildTypography(form.headingFont, form.bodyFont),
    [form.headingFont, form.bodyFont]
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    setSavingState(true);
    try {
      await update({
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        logoUrl: form.logoUrl || null,
        faviconUrl: form.faviconUrl || null,
        appleTouchIconUrl: form.appleTouchIconUrl || null,
        typography: buildTypography(form.headingFont, form.bodyFont),
      });
      setFeedback("Identidade visual atualizada com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar tema.");
    } finally {
      setSavingState(false);
    }
  }

  async function handleRestoreDefaults() {
    setSavingState(true);
    setFeedback(null);
    try {
      await update({
        primaryColor: DEFAULT_COLORS.primary,
        secondaryColor: DEFAULT_COLORS.secondary,
        accentColor: DEFAULT_COLORS.accent,
        typography: buildTypography(FONT_OPTIONS[0], FONT_OPTIONS[1]),
      });
      setFeedback("Paleta Dermosul restaurada.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao restaurar tema.");
    } finally {
      setSavingState(false);
    }
  }

  const disabled = loading || saving || savingState;

  return (
    <section className={PANEL_CLASS}>
      <SectionHeader
        eyebrow="Identidade"
        title="DNA visual da loja"
        description="Ajuste paleta, tipografia e assets globais para manter a experiência Dermosul consistente em cada ponto de contato."
      />

      {error && <Alert tone="error" message={error} />}
      {feedback && <Alert tone="success" message={feedback} />}

      {(loading && !settings) && <Skeleton />}

      {!loading && settings && (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <ColorField
              label="Primária"
              value={form.primaryColor}
              onChange={(value) => setForm((prev) => ({ ...prev, primaryColor: value }))}
            />
            <ColorField
              label="Secundária"
              value={form.secondaryColor}
              onChange={(value) => setForm((prev) => ({ ...prev, secondaryColor: value }))}
            />
            <ColorField
              label="Acento"
              value={form.accentColor}
              onChange={(value) => setForm((prev) => ({ ...prev, accentColor: value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <URLField
              label="Logo (URL)"
              value={form.logoUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, logoUrl: value }))}
            />
            <URLField
              label="Favicon (URL)"
              value={form.faviconUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, faviconUrl: value }))}
            />
            <URLField
              label="Apple Touch Icon (URL)"
              value={form.appleTouchIconUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, appleTouchIconUrl: value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Fonte dos títulos"
              value={form.headingFont}
              options={FONT_OPTIONS}
              onChange={(value) => setForm((prev) => ({ ...prev, headingFont: value }))}
            />
            <SelectField
              label="Fonte dos parágrafos"
              value={form.bodyFont}
              options={FONT_OPTIONS}
              onChange={(value) => setForm((prev) => ({ ...prev, bodyFont: value }))}
            />
          </div>

          <TypographyPreview typography={typographyPreview} colors={form} />

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="inline-flex items-center rounded-full border border-sky-500/60 bg-sky-500/20 px-5 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disabled ? "Salvando…" : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={disabled}
              className="inline-flex items-center rounded-full border border-slate-700 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Restaurar padrão Dermosul
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function extractFont(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const match = value.match(/'([^']+)'/);
  if (match && match[1]) return match[1];
  return value.replace(/,.*$/, "").replace(/"/g, "").trim() || fallback;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={SUBPANEL_CLASS}>
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-12 cursor-pointer rounded-2xl border border-slate-700 bg-slate-900"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}

function URLField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <FieldLabel label={label} hint="Uso opcional">
      <input
        type="url"
        value={value}
        placeholder="https://"
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </FieldLabel>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldLabel label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

function TypographyPreview({
  typography,
  colors,
}: {
  typography: StoreTypography;
  colors: { primaryColor: string; secondaryColor: string; accentColor: string };
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6">
      <div
        className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/60 p-6"
        style={{ fontFamily: typography.body?.fontFamily, color: colors.secondaryColor }}
      >
        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Pré-visualização</p>
        <h4
          className="mt-3 text-2xl font-semibold"
          style={{ fontFamily: typography.heading?.fontFamily, color: colors.primaryColor }}
        >
          Dermosul Clinical Spa
        </h4>
        <p className="mt-2 text-sm" style={{ lineHeight: (typography.body?.lineHeight as number | undefined) || 1.6 }}>
          Active complex exclusivo com niacinamida vetorizada e peptídeos biomiméticos. Dermatologicamente testado e aprovado para peles sensíveis.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: colors.primaryColor }}
          >
            CTA principal
          </span>
          <span
            className="rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: colors.accentColor, color: colors.accentColor }}
          >
            CTA secundária
          </span>
        </div>
      </div>
    </div>
  );
}

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  const palette = tone === "success"
    ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-100"
    : "border-rose-500/40 bg-rose-900/30 text-rose-100";
  return <div className={`rounded-3xl border px-4 py-3 text-sm ${palette}`}>{message}</div>;
}

function Skeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/40" />
      <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/40" />
      <div className="h-32 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/40" />
    </div>
  );
}
