import { FormEvent, useEffect, useState } from "react";
import { HomeLayoutSection } from "../api";
import { useStoreSettingsContext } from "../StoreSettingsContext";

const DEFAULT_LAYOUT: HomeLayoutSection[] = [
  { id: "announcement-bar", type: "announcement", enabled: true },
  { id: "hero", type: "hero", enabled: true },
  { id: "featured-collection", type: "product-grid", title: "Novidades em Dermocosméticos", collectionSlug: "novidades", limit: 8, enabled: true },
  { id: "bestsellers", type: "product-grid", title: "Os mais pedidos", collectionSlug: "mais-vendidos", limit: 8, enabled: true },
  { id: "banner-strip", type: "banner", bannerKind: "STRIP", enabled: true },
  { id: "testimonials", type: "testimonials", enabled: true },
  { id: "newsletter", type: "newsletter", enabled: true },
];

export default function LayoutSection() {
  const { settings, loading, error, saving, update } = useStoreSettingsContext();
  const [layout, setLayout] = useState<HomeLayoutSection[]>(DEFAULT_LAYOUT);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!settings?.homeLayout || settings.homeLayout.length === 0) {
      setLayout(DEFAULT_LAYOUT);
      return;
    }
    setLayout(normalizeLayout(settings.homeLayout));
  }, [settings?.homeLayout]);

  function move(index: number, direction: -1 | 1) {
    setLayout((prev) => {
      const next = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }

  function toggleEnabled(index: number, enabled: boolean) {
    setLayout((prev) => prev.map((section, idx) => (idx === index ? { ...section, enabled } : section)));
  }

  function updateField(index: number, key: keyof HomeLayoutSection, value: unknown) {
    setLayout((prev) => prev.map((section, idx) => (idx === index ? { ...section, [key]: value } : section)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await update({ homeLayout: layout });
      setFeedback("Layout atualizado com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar layout.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting;

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-2xl font-semibold text-violet-900">Layout da Home</h2>
          <p className="text-sm text-zinc-600">
            Organize a ordem das seções, títulos e coleções utilizadas na Home Dermosul.
          </p>
        </header>

        {(loading || !settings) && <p className="text-sm text-zinc-500">Carregando layout...</p>}

        {!loading && settings && (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {feedback && <p className="text-sm text-violet-700">{feedback}</p>}

            <ol className="grid gap-4">
              {layout.map((section, index) => (
                <li key={section.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-violet-900">
                        {index + 1}. {humanizeSection(section)}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-violet-600">{section.id}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        className="rounded-full border border-violet-200 px-3 py-1 text-violet-700 hover:bg-violet-50"
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        className="rounded-full border border-violet-200 px-3 py-1 text-violet-700 hover:bg-violet-50"
                        disabled={index === layout.length - 1}
                      >
                        ↓
                      </button>
                      <label className="ml-2 flex items-center gap-2 text-zinc-600">
                        <input
                          type="checkbox"
                          checked={section.enabled !== false}
                          onChange={(event) => toggleEnabled(index, event.target.checked)}
                        />
                        Visível
                      </label>
                    </div>
                  </div>

                  {section.type === "product-grid" && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Input
                        label="Título"
                        value={section.title ?? ""}
                        onChange={(value) => updateField(index, "title", value)}
                      />
                      <Input
                        label="Slug da coleção"
                        value={section.collectionSlug ?? ""}
                        onChange={(value) => updateField(index, "collectionSlug", value)}
                      />
                      <Input
                        label="Limite de produtos"
                        type="number"
                        value={section.limit ?? 0}
                        onChange={(value) => updateField(index, "limit", Number(value) || 0)}
                      />
                    </div>
                  )}

                  {section.type === "banner" && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Input
                        label="Tipo de banner"
                        value={section.bannerKind ?? ""}
                        onChange={(value) => updateField(index, "bannerKind", value)}
                        placeholder="HERO, CAROUSEL ou STRIP"
                      />
                      <Input
                        label="Título"
                        value={section.title ?? ""}
                        onChange={(value) => updateField(index, "title", value)}
                      />
                    </div>
                  )}

                  {section.type === "testimonials" && (
                    <p className="mt-3 text-xs text-zinc-500">
                      Depoimentos exibem avaliações cadastradas via CMS. Configure o conteúdo na aba de Textos.
                    </p>
                  )}
                </li>
              ))}
            </ol>

            <div className="flex gap-3">
              <button type="submit" disabled={disabled} className="primary-action">
                {disabled ? "Salvando..." : "Salvar layout"}
              </button>
              <button
                type="button"
                onClick={() => setLayout(DEFAULT_LAYOUT)}
                className="secondary-action"
              >
                Restaurar ordem padrão
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function humanizeSection(section: HomeLayoutSection) {
  switch (section.type) {
    case "announcement":
      return "Barra de anúncio";
    case "hero":
      return "Hero principal";
    case "product-grid":
      return section.title || "Grade de produtos";
    case "banner":
      return "Banner destacado";
    case "testimonials":
      return "Depoimentos";
    case "newsletter":
      return "Newsletter";
    default:
      return section.id;
  }
}

function normalizeLayout(layout: HomeLayoutSection[]): HomeLayoutSection[] {
  const mapped = layout.map((section) => {
    if (section.id === "featured-collection") {
      const normalizedTitle =
        !section.title || section.title === "Lançamentos Dermosul"
          ? "Novidades em Dermocosméticos"
          : section.title;
      return { ...section, enabled: section.enabled !== false, title: normalizedTitle };
    }
    return { ...section, enabled: section.enabled !== false };
  });
  if (mapped.length === 0) return DEFAULT_LAYOUT;
  return mapped;
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}
