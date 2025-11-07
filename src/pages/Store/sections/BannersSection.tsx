import { FormEvent, useEffect, useMemo, useState } from "react";
import { storeAdminApi, Banner } from "../api";
import { FieldLabel, INPUT_CLASS, PANEL_CLASS, SectionHeader, SELECT_CLASS } from "../ui";

const KIND_OPTIONS: Array<{ label: string; value: Banner["kind"] }> = [
  { label: "Hero", value: "HERO" },
  { label: "Carrossel", value: "CAROUSEL" },
  { label: "Faixa", value: "STRIP" },
];

type BannerFormState = {
  id?: string;
  kind: Banner["kind"];
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  mobileImageUrl: string;
  position: number;
  active: boolean;
};

const EMPTY_BANNER: BannerFormState = {
  kind: "HERO",
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaHref: "",
  imageUrl: "",
  mobileImageUrl: "",
  position: 0,
  active: true,
};

export default function BannersSection() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_BANNER);
  const [saving, setSaving] = useState(false);
  const [filterKind, setFilterKind] = useState<"ALL" | Banner["kind"]>("ALL");

  const filteredBanners = useMemo(() => {
    if (filterKind === "ALL") return banners;
    return banners.filter((banner) => banner.kind === filterKind);
  }, [banners, filterKind]);

  async function loadBanners() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listBanners(filterKind === "ALL" ? undefined : { kind: filterKind });
      setBanners(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar banners.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKind]);

  function handleEdit(banner: Banner) {
    setForm({
      id: banner.id,
      kind: banner.kind,
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      ctaLabel: banner.ctaLabel || "",
      ctaHref: banner.ctaHref || "",
      imageUrl: banner.imageUrl || "",
      mobileImageUrl: banner.mobileImageUrl || "",
      position: banner.position,
      active: banner.active,
    });
  }

  function handleResetForm() {
    setForm(EMPTY_BANNER);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        kind: form.kind,
        title: form.title || null,
        subtitle: form.subtitle || null,
        ctaLabel: form.ctaLabel || null,
        ctaHref: form.ctaHref || null,
        imageUrl: form.imageUrl,
        mobileImageUrl: form.mobileImageUrl || null,
        position: Number(form.position) || 0,
        active: form.active,
      };
      if (form.id) {
        await storeAdminApi.updateBanner(form.id, payload);
      } else {
        await storeAdminApi.createBanner(payload);
      }
      handleResetForm();
      await loadBanners();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar banner.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este banner?")) return;
    try {
      await storeAdminApi.deleteBanner(id);
      await loadBanners();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover banner.");
    }
  }

  return (
    <section className="space-y-6">
      <div className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Campanhas"
          title="Banners hero, carrossel e faixas"
          description="Controle vitrine principal da Store Dermosul com assets responsivos, CTA e hierarquia de mensagens."
        />

        <div className="mb-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-slate-500">
          <button
            type="button"
            onClick={() => setFilterKind("ALL")}
            className={filterKind === "ALL" ? "primary-action" : "secondary-action"}
          >
            Todos os formatos
          </button>
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterKind(option.value)}
              className={filterKind === option.value ? "primary-action" : "secondary-action"}
            >
              {option.label}
            </button>
          ))}
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <FieldLabel label="Tipo do banner">
              <select
                value={form.kind}
                onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as Banner["kind"] }))}
                className={SELECT_CLASS}
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Posição na home" hint="0 fica no topo">
              <input
                type="number"
                value={form.position}
                onChange={(event) => setForm((prev) => ({ ...prev, position: Number(event.target.value) }))}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <label className="flex flex-col justify-end gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
              Status
              <span className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30"
                />
                Ativo
              </span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Título"
              value={form.title}
              onChange={(value) => setForm((prev) => ({ ...prev, title: value }))}
            />
            <TextInput
              label="Subtítulo"
              value={form.subtitle}
              onChange={(value) => setForm((prev) => ({ ...prev, subtitle: value }))}
            />
            <TextInput
              label="CTA label"
              value={form.ctaLabel}
              onChange={(value) => setForm((prev) => ({ ...prev, ctaLabel: value }))}
            />
            <TextInput
              label="CTA link"
              value={form.ctaHref}
              onChange={(value) => setForm((prev) => ({ ...prev, ctaHref: value }))}
              placeholder="/p/dermosul-dermashield"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Imagem desktop (URL)"
              value={form.imageUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, imageUrl: value }))}
              required
            />
            <TextInput
              label="Imagem mobile (URL)"
              value={form.mobileImageUrl}
              onChange={(value) => setForm((prev) => ({ ...prev, mobileImageUrl: value }))}
              placeholder="Opcional"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando…" : form.id ? "Atualizar banner" : "Criar banner"}
            </button>
            {form.id && (
              <button type="button" onClick={handleResetForm} className="secondary-action">
                Cancelar edição
              </button>
            )}
          </div>

          {error && <Alert tone="error" message={error} />}
        </form>
      </div>

      <div className={PANEL_CLASS}>
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Banners cadastrados</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : filteredBanners.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.25em] text-slate-500">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Imagens</th>
                  <th className="px-4 py-3">CTA</th>
                  <th className="px-4 py-3">Posição</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBanners.map((banner) => (
                  <tr key={banner.id} className="border-b border-slate-800/60">
                    <td className="px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">{banner.kind}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{banner.title || "—"}</div>
                      <div className="text-xs text-slate-500">{banner.subtitle || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <a
                        href={banner.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                      >
                        Desktop
                      </a>
                      {banner.mobileImageUrl && (
                        <a
                          href={banner.mobileImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-3 text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                        >
                          Mobile
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{banner.ctaLabel || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{banner.position}</td>
                    <td className="px-4 py-3">
                      <span className={banner.active ? "tag" : "chip"}>{banner.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(banner)} className="secondary-action text-xs">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(banner.id)} className="danger-action text-xs">
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <FieldLabel label={label}>
      <input
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </FieldLabel>
  );
}

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  const palette = tone === "success"
    ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-100"
    : "border-rose-500/40 bg-rose-900/30 text-rose-100";
  return <div className={`rounded-3xl border px-4 py-3 text-sm ${palette}`}>{message}</div>;
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-10 text-center">
      <p className="text-sm text-slate-400">Nenhum banner cadastrado para o filtro selecionado.</p>
      <p className="mt-1 text-xs text-slate-500">Crie um banner hero ou carrossel para dar ritmo à home Dermosul.</p>
    </div>
  );
}
