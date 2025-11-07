import React, { useEffect, useMemo, useRef, useState } from "react";
import { landingPageApi, LandingPage, API_BASE_URL } from "../../lib/api";
import { resolveImageUrl } from "../../lib/media";

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (iso: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type TemplateValue = "MODELO_1" | "MODELO_2" | "MODELO_3" | "MODELO_4";
type StatusValue = "ATIVA" | "PAUSADA";
type StatusFilterValue = "TODOS" | StatusValue;
type TemplateFilterValue = "TODOS" | TemplateValue;

const TEMPLATE_ORDER: TemplateValue[] = ["MODELO_1", "MODELO_2", "MODELO_3", "MODELO_4"];

const TEMPLATE_META: Record<TemplateValue, { label: string; subtitle: string; gradient: string; badgeClass: string }> = {
  MODELO_1: {
    label: "Nebula Prime",
    subtitle: "Hero imersivo com CTA em destaque",
    gradient: "from-sky-500/40 via-cyan-500/15 to-fuchsia-500/20",
    badgeClass: "border border-sky-400/50 bg-sky-500/10 text-sky-200",
  },
  MODELO_2: {
    label: "Pulse Orbit",
    subtitle: "Oferta lateral com storytelling progressivo",
    gradient: "from-violet-500/30 via-slate-900/50 to-sky-500/20",
    badgeClass: "border border-violet-400/40 bg-violet-500/10 text-violet-200",
  },
  MODELO_3: {
    label: "Laser Grid",
    subtitle: "Blocos alternados e depoimentos focados",
    gradient: "from-cyan-500/25 via-emerald-500/10 to-fuchsia-500/15",
    badgeClass: "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
  },
  MODELO_4: {
    label: "Photon Flow",
    subtitle: "Vitrine modular com CTA contínuo",
    gradient: "from-fuchsia-500/25 via-slate-900/55 to-cyan-500/15",
    badgeClass: "border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200",
  },
};

const TEMPLATE_OPTIONS = TEMPLATE_ORDER.map((value) => ({
  value,
  ...TEMPLATE_META[value],
}));

const STATUS_META: Record<StatusValue, { label: string; className: string }> = {
  ATIVA: {
    label: "Ativa",
    className: "border border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
  },
  PAUSADA: {
    label: "Pausada",
    className: "border border-amber-400/50 bg-amber-500/10 text-amber-200",
  },
};

function cn(...classes: Array<string | boolean | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TemplateBadge({ template }: { template?: TemplateValue | null }) {
  const key: TemplateValue = template && TEMPLATE_META[template] ? template : "MODELO_1";
  const meta = TEMPLATE_META[key];
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]", meta.badgeClass)}>
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: StatusValue | string | null | undefined }) {
  const normalized: StatusValue = status === "ATIVA" || status === "PAUSADA" ? status : "PAUSADA";
  const meta = STATUS_META[normalized];
  const label =
    status === "ATIVA" || status === "PAUSADA"
      ? meta.label
      : typeof status === "string" && status.trim().length > 0
        ? status
        : "Status indefinido";
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]", meta.className)}>
      {label}
    </span>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-white/5 px-5 py-4 text-slate-200 shadow-[0_30px_120px_-90px_rgba(34,211,238,0.5)] backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

interface LandingCardProps {
  landingPage: LandingPage;
  shareBaseUrl: string;
  onEdit: (landingPage: LandingPage) => void;
  onToggleStatus: (landingPage: LandingPage) => void;
  onDelete: (id: string) => void;
  onCopyLink: (slug: string) => void;
}

function LandingCard({
  landingPage,
  shareBaseUrl,
  onEdit,
  onToggleStatus,
  onDelete,
  onCopyLink,
}: LandingCardProps) {
  const image = landingPage.imageUrl ? resolveImageUrl(landingPage.imageUrl) : null;
  const shareUrl = `${shareBaseUrl}${landingPage.slug}`;

  return (
    <article
      className="relative overflow-hidden rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-6 shadow-[0_42px_140px_-90px_rgba(12,170,255,0.55)] transition duration-200 hover:border-slate-700 hover:shadow-[0_46px_140px_-80px_rgba(34,211,238,0.6)]"
    >
      <div
        className="pointer-events-none absolute -top-28 right-0 h-56 w-56 rounded-full bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-fuchsia-500/20 blur-3xl"
        aria-hidden
      />
      <div className="grid gap-6 md:grid-cols-[200px_1fr_auto] md:items-start">
        <div className="relative order-2 flex h-40 w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 md:order-1">
          {image ? (
            <img src={image} alt={landingPage.productTitle} className="h-full w-full object-contain p-4" />
          ) : (
            <div className="text-center text-sm text-slate-500">Pré-visualização indisponível</div>
          )}
          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-slate-500">
            <span>{landingPage.productBrand || "Marca Dermosul"}</span>
            <span>{landingPage.template}</span>
          </div>
        </div>

        <div className="order-1 space-y-4 md:order-2">
          <div className="flex flex-wrap items-center gap-3">
            <TemplateBadge template={landingPage.template as TemplateValue} />
            <StatusBadge status={landingPage.status} />
            {landingPage.freeShipping && (
              <span className="inline-flex items-center rounded-full border border-sky-400/50 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-sky-200">
                Frete grátis
              </span>
            )}
          </div>

          <div>
            <h3 className="text-xl font-semibold text-slate-50">{landingPage.productTitle}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {landingPage.productDescription || "Landing page otimizada para conversão de dermocosméticos."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <span className="text-2xl font-semibold text-slate-50">{BRL(landingPage.productPrice || 0)}</span>
            {!landingPage.freeShipping && (
              <span className="rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-slate-400">
                Frete {BRL(landingPage.shippingValue || 0)}
              </span>
            )}
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-xs text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
            >
              {shareUrl}
            </a>
          </div>

          <div className="grid gap-1 text-xs text-slate-500">
            <span>Criada em {formatDateTime(landingPage.createdAt)}</span>
            {landingPage.updatedAt && <span>Atualizada em {formatDateTime(landingPage.updatedAt)}</span>}
          </div>
        </div>

        <div className="order-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onEdit(landingPage)}
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-500/50 hover:text-sky-200"
          >
            ✏️ Editar
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus(landingPage)}
            className={cn(
              "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition",
              landingPage.status === "ATIVA"
                ? "border-amber-400/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                : "border-emerald-400/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            )}
          >
            {landingPage.status === "ATIVA" ? "⏸ Pausar" : "▶ Ativar"}
          </button>
          <button
            type="button"
            onClick={() => onCopyLink(landingPage.slug)}
            className="inline-flex items-center justify-center rounded-full border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20"
          >
            🔗 Copiar link
          </button>
        <button
          type="button"
          onClick={() => onDelete(landingPage.id)}
          className="inline-flex items-center justify-center rounded-full border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
        >
          🗑 Excluir
        </button>
      </div>
    </div>
  </article>
);
}

interface EditLandingPageModalProps {
  landingPage: LandingPage;
  onClose: () => void;
  onSave: (updatedLandingPage: LandingPage) => void;
}

function EditLandingPageModal({ landingPage, onClose, onSave }: EditLandingPageModalProps) {
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(landingPage.imageUrl ?? null);
  const [productTitle, setProductTitle] = useState(landingPage.productTitle);
  const [productDescription, setProductDescription] = useState(landingPage.productDescription);
  const [productBrand, setProductBrand] = useState(landingPage.productBrand);
  const [productPrice, setProductPrice] = useState<number | "">(landingPage.productPrice ?? "");
  const [shippingValue, setShippingValue] = useState<number | "">(landingPage.freeShipping ? "" : landingPage.shippingValue ?? "");
  const [freeShipping, setFreeShipping] = useState(landingPage.freeShipping);
  const [template, setTemplate] = useState<TemplateValue>(
    TEMPLATE_META[landingPage.template as TemplateValue] ? (landingPage.template as TemplateValue) : "MODELO_1"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);

  useEffect(() => {
    setProductImageFile(null);
    setProductImagePreview(landingPage.imageUrl ?? null);
    setProductTitle(landingPage.productTitle);
    setProductDescription(landingPage.productDescription);
    setProductBrand(landingPage.productBrand);
    setProductPrice(landingPage.productPrice ?? "");
    setShippingValue(landingPage.freeShipping ? "" : landingPage.shippingValue ?? "");
    setFreeShipping(landingPage.freeShipping);
    setTemplate(TEMPLATE_META[landingPage.template as TemplateValue] ? (landingPage.template as TemplateValue) : "MODELO_1");
    setError(null);
    setTitleError(null);
    setPriceError(null);
    setBrandError(null);
    setShippingError(null);
  }, [landingPage]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProductImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setProductImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setProductImageFile(null);
      setProductImagePreview(landingPage.imageUrl ?? null);
    }
  };

  const validate = () => {
    let valid = true;
    setTitleError(null);
    setPriceError(null);
    setBrandError(null);
    setShippingError(null);

    if (!productTitle.trim()) {
      setTitleError("O título do produto é obrigatório.");
      valid = false;
    }
    if (productPrice === "" || Number(productPrice) <= 0 || Number.isNaN(Number(productPrice))) {
      setPriceError("Informe um preço positivo.");
      valid = false;
    }
    if (!productBrand.trim()) {
      setBrandError("Informe a marca do produto.");
      valid = false;
    }
    if (!freeShipping && (shippingValue === "" || Number(shippingValue) < 0 || Number.isNaN(Number(shippingValue)))) {
      setShippingError("Informe um frete válido ou marque frete grátis.");
      valid = false;
    }

    return valid;
  };

  const handleSave = async () => {
    if (!validate()) {
      setError("Ajuste os campos destacados para continuar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await landingPageApi.updateLandingPage(landingPage.id, {
        image: productImageFile || undefined,
        template,
        productTitle,
        productDescription,
        productBrand,
        productPrice: Number(productPrice),
        shippingValue: freeShipping ? 0 : Number(shippingValue),
        freeShipping,
      });
      onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Falha ao atualizar a landing page.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#01030a]/80 px-4 backdrop-blur">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-4xl border border-slate-800 bg-gradient-to-br from-[#071022] via-[#050914] to-[#02040a] px-6 py-6 shadow-[0_60px_160px_-80px_rgba(34,211,238,0.65)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition hover:border-rose-500/60 hover:text-rose-200"
        >
          ✕
        </button>

        <header className="mb-6 space-y-2 pr-10">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Editar landing</p>
          <h2 className="text-2xl font-semibold text-slate-50">{landingPage.productTitle}</h2>
          <p className="text-sm text-slate-400">
            Ajuste copy, preços, template ou imagem da campanha sem perder o histórico de performance.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-3xl border border-rose-500/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
              Foto do produto
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-2 w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500/10 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-sky-200 hover:border-sky-500/40"
              />
            </label>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
              {productImagePreview ? (
                <img src={productImagePreview} alt="Pré-visualização" className="h-40 w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-xs uppercase tracking-[0.25em] text-slate-500">
                  Pré-visualização
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
              Título do produto
              <input
                type="text"
                value={productTitle}
                onChange={(event) => {
                  setProductTitle(event.target.value);
                  setTitleError(null);
                }}
                className={cn(
                  "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                  titleError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
                )}
              />
              {titleError && <span className="mt-2 block text-xs text-rose-200">{titleError}</span>}
            </label>

            <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
              Marca
              <input
                type="text"
                value={productBrand}
                onChange={(event) => {
                  setProductBrand(event.target.value);
                  setBrandError(null);
                }}
                className={cn(
                  "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                  brandError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
                )}
              />
              {brandError && <span className="mt-2 block text-xs text-rose-200">{brandError}</span>}
            </label>

            <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
              Descrição
              <textarea
                rows={4}
                value={productDescription}
                onChange={(event) => setProductDescription(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
            Preço
            <input
              type="number"
              value={productPrice}
              onChange={(event) => {
                const value = event.target.value;
                setProductPrice(value === "" ? "" : Number(value));
                setPriceError(null);
              }}
              className={cn(
                "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                priceError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
              )}
            />
            {priceError && <span className="mt-2 block text-xs text-rose-200">{priceError}</span>}
          </label>

          <label className="block text-xs uppercase tracking-[0.25em] text-slate-500 md:col-span-2">
            Frete
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                value={freeShipping ? "" : shippingValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setShippingValue(value === "" ? "" : Number(value));
                  setShippingError(null);
                }}
                disabled={freeShipping}
                className={cn(
                  "w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                  freeShipping ? "cursor-not-allowed border-slate-700 bg-slate-800/40 text-slate-400" : "border-slate-700 bg-slate-900/60",
                  shippingError && !freeShipping && "border-rose-500/60 bg-rose-500/10"
                )}
              />
              <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(event) => {
                    setFreeShipping(event.target.checked);
                    if (event.target.checked) {
                      setShippingError(null);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30"
                />
                Frete grátis
              </label>
            </div>
            {shippingError && !freeShipping && <span className="mt-2 block text-xs text-rose-200">{shippingError}</span>}
          </label>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Template</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTemplate(option.value)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-3xl border px-4 py-4 text-left transition",
                  template === option.value
                    ? "border-sky-400/60 bg-sky-500/10 text-slate-100 shadow-[0_30px_80px_-70px_rgba(34,211,238,0.6)]"
                    : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
                )}
              >
                <div className={cn("h-16 w-full rounded-2xl bg-gradient-to-br", option.gradient)} />
                <div>
                  <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                  <p className="text-xs text-slate-400">{option.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-transparent px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productPrice, setProductPrice] = useState<number | "">("");
  const [shippingValue, setShippingValue] = useState<number | "">("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [template, setTemplate] = useState<TemplateValue>("MODELO_1");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [editingLandingPage, setEditingLandingPage] = useState<LandingPage | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilterValue>("TODOS");
  const [filterTemplate, setFilterTemplate] = useState<TemplateFilterValue>("TODOS");
  const [createTitleError, setCreateTitleError] = useState<string | null>(null);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
  const [createPriceError, setCreatePriceError] = useState<string | null>(null);
  const [createBrandError, setCreateBrandError] = useState<string | null>(null);
  const [createShippingError, setCreateShippingError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setFetching(true);
      setGlobalError(null);
      try {
        const data = await landingPageApi.listLandingPages();
        if (mounted) {
          setLandingPages(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (mounted) setGlobalError(err?.message || "Não foi possível carregar as landing pages.");
      } finally {
        if (mounted) setFetching(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (successMessage || formError) {
      const timer = window.setTimeout(() => {
        setSuccessMessage(null);
        setFormError(null);
      }, 3200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [successMessage, formError]);

  const shareBaseUrl = useMemo(() => {
    if (typeof window !== "undefined" && window.location) {
      return `${window.location.origin.replace(/\/$/, "")}/l/`;
    }
    const base = (API_BASE_URL || "").replace(/\/$/, "");
    return base ? `${base}/l/` : "/l/";
  }, []);

  const templateCount = useMemo(() => {
    const initial: Record<TemplateValue, number> = {
      MODELO_1: 0,
      MODELO_2: 0,
      MODELO_3: 0,
      MODELO_4: 0,
    };
    landingPages.forEach((page) => {
      const key = TEMPLATE_META[page.template as TemplateValue] ? (page.template as TemplateValue) : "MODELO_1";
      initial[key] += 1;
    });
    return initial;
  }, [landingPages]);

  const metrics = useMemo(() => {
    const total = landingPages.length;
    const active = landingPages.filter((page) => page.status === "ATIVA").length;
    const paused = landingPages.filter((page) => page.status === "PAUSADA").length;
    const avgTicketRaw = total > 0 ? landingPages.reduce((acc, page) => acc + (page.productPrice || 0), 0) / total : 0;
    return {
      total,
      active,
      paused,
      avgTicket: avgTicketRaw,
    };
  }, [landingPages]);

  const statusCount: Record<StatusFilterValue, number> = {
    TODOS: metrics.total,
    ATIVA: metrics.active,
    PAUSADA: metrics.paused,
  };

  const filteredLandingPages = useMemo(() => {
    return landingPages.filter((page) => {
      const statusOk = filterStatus === "TODOS" || page.status === filterStatus;
      const templateOk = filterTemplate === "TODOS" || page.template === filterTemplate;
      return statusOk && templateOk;
    });
  }, [landingPages, filterStatus, filterTemplate]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProductImageFile(file);
      setCreateImageError(null);
      const reader = new FileReader();
      reader.onloadend = () => setProductImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setProductImageFile(null);
      setProductImagePreview(null);
    }
  };

  const validateCreateForm = () => {
    let valid = true;
    setCreateTitleError(null);
    setCreateImageError(null);
    setCreatePriceError(null);
    setCreateBrandError(null);
    setCreateShippingError(null);

    if (!productTitle.trim()) {
      setCreateTitleError("Informe um título para a landing.");
      valid = false;
    }
    if (!productImageFile) {
      setCreateImageError("Envie uma imagem do produto.");
      valid = false;
    }
    if (productPrice === "" || Number(productPrice) <= 0 || Number.isNaN(Number(productPrice))) {
      setCreatePriceError("Informe um preço válido e maior que zero.");
      valid = false;
    }
    if (!productBrand.trim()) {
      setCreateBrandError("Informe a marca do produto.");
      valid = false;
    }
    if (!freeShipping && (shippingValue === "" || Number(shippingValue) < 0 || Number.isNaN(Number(shippingValue)))) {
      setCreateShippingError("Informe um valor de frete válido ou marque frete grátis.");
      valid = false;
    }

    return valid;
  };

  const resetForm = () => {
    setProductImageFile(null);
    setProductImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setProductTitle("");
    setProductDescription("");
    setProductBrand("");
    setProductPrice("");
    setShippingValue("");
    setFreeShipping(false);
    setTemplate("MODELO_1");
  };

  const handleGenerateLandingPage = async () => {
    if (!validateCreateForm()) {
      setFormError("Revise os campos obrigatórios antes de gerar a landing.");
      return;
    }

    setLoading(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const created = await landingPageApi.createLandingPage({
        image: productImageFile || undefined,
        template,
        productTitle,
        productDescription,
        productBrand,
        productPrice: Number(productPrice),
        shippingValue: freeShipping ? 0 : Number(shippingValue),
        freeShipping,
      });

      setLandingPages((prev) => [created, ...prev]);
      setSuccessMessage("Landing criada com sucesso! 🚀");
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || "Não foi possível criar a landing page.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (slug: string) => {
    const shareUrl = `${shareBaseUrl}${slug}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setSuccessMessage("Link copiado para a área de transferência.");
        return;
      }
      throw new Error("Clipboard indisponível");
    } catch {
      window.prompt("Copie o link da landing:", shareUrl);
      setSuccessMessage("Link pronto para compartilhamento.");
    }
  };

  const handleEdit = (landingPage: LandingPage) => {
    setEditingLandingPage(landingPage);
  };

  const handleSaveEditedLandingPage = (updated: LandingPage) => {
    setLandingPages((prev) => prev.map((page) => (page.id === updated.id ? updated : page)));
    setSuccessMessage("Landing atualizada com sucesso.");
    setEditingLandingPage(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja excluir esta landing? Essa ação não pode ser desfeita.")) {
      return;
    }
    setLoading(true);
    setFormError(null);

    try {
      await landingPageApi.deleteLandingPage(id);
      setLandingPages((prev) => prev.filter((page) => page.id !== id));
      setSuccessMessage("Landing removida.");
    } catch (err: any) {
      setFormError(err?.message || "Falha ao excluir a landing page.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (landingPage: LandingPage) => {
    const newStatus: StatusValue = landingPage.status === "ATIVA" ? "PAUSADA" : "ATIVA";
    const confirmation =
      newStatus === "PAUSADA"
        ? "Deseja pausar esta landing? Ela deixará de receber tráfego."
        : "Deseja ativar esta landing? Ela voltará a receber tráfego.";

    if (!window.confirm(confirmation)) {
      return;
    }
    setLoading(true);
    setFormError(null);

    try {
      const updated = await landingPageApi.updateLandingPageStatus(landingPage.id, newStatus);
      setLandingPages((prev) => prev.map((page) => (page.id === landingPage.id ? updated : page)));
      setSuccessMessage(newStatus === "ATIVA" ? "Landing ativada." : "Landing pausada.");
    } catch (err: any) {
      setFormError(err?.message || "Não foi possível alterar o status da landing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] pb-24">
      <div className="mx-auto max-w-7xl px-4 pt-12">
        <header className="rounded-4xl border border-slate-800 bg-[#071024]/80 px-6 py-8 shadow-[0_60px_160px_-90px_rgba(34,211,238,0.6)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Campanhas</p>
              <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">Landing Pages Inteligentes</h1>
              <p className="text-sm text-slate-400">
                Gere narrativas de produto com estética high-tech, acione frete estratégico e acompanhe status em um cockpit único.
              </p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-3 md:w-auto">
              <MetricCard label="Ativas" value={String(metrics.active)} hint="Campanhas recebendo tráfego neste momento." />
              <MetricCard label="Pausadas" value={String(metrics.paused)} hint="Materiais prontos para reativação." />
              <MetricCard label="Ticket médio" value={BRL(metrics.avgTicket || 0)} hint="Preço médio dos produtos cadastrados." />
            </div>
          </div>
        </header>

        <section className="mt-10 rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-8 shadow-[0_50px_140px_-100px_rgba(34,211,238,0.55)] backdrop-blur-2xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-[#0a1326] via-[#060b18] to-[#03060d] p-6">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Blueprint</p>
                <h2 className="text-2xl font-semibold text-slate-50">Construa sua próxima landing</h2>
                <p className="text-sm text-slate-400">
                  Combine imagem, copy e template para lançar campanhas em minutos com a identidade Dermosul Commerce OS.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4">
                {productImagePreview ? (
                  <img src={productImagePreview} alt="Pré-visualização" className="h-48 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-700 text-xs uppercase tracking-[0.25em] text-slate-500">
                    <span>Pré-visualização</span>
                    <span className="text-[10px] text-slate-600">Faça upload para visualizar</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {formError && (
                <div className="rounded-3xl border border-rose-500/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
                  {formError}
                </div>
              )}
              {successMessage && (
                <div className="rounded-3xl border border-emerald-500/40 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100">
                  {successMessage}
                </div>
              )}

              <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                Foto do produto
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className={cn(
                    "mt-2 w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500/10 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-[0.2em] file:text-sky-200 hover:border-sky-500/40",
                    createImageError && "border-rose-500/60 bg-rose-500/10"
                  )}
                />
                {createImageError && <span className="mt-2 block text-xs text-rose-200">{createImageError}</span>}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                  Título
                  <input
                    type="text"
                    value={productTitle}
                    onChange={(event) => {
                      setProductTitle(event.target.value);
                      setCreateTitleError(null);
                    }}
                    className={cn(
                      "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                      createTitleError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
                    )}
                  />
                  {createTitleError && <span className="mt-2 block text-xs text-rose-200">{createTitleError}</span>}
                </label>

                <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                  Marca
                  <input
                    type="text"
                    value={productBrand}
                    onChange={(event) => {
                      setProductBrand(event.target.value);
                      setCreateBrandError(null);
                    }}
                    className={cn(
                      "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                      createBrandError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
                    )}
                  />
                  {createBrandError && <span className="mt-2 block text-xs text-rose-200">{createBrandError}</span>}
                </label>
              </div>

              <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                Descrição
                <textarea
                  rows={4}
                  value={productDescription}
                  onChange={(event) => setProductDescription(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                  Preço
                  <input
                    type="number"
                    value={productPrice}
                    onChange={(event) => {
                      const value = event.target.value;
                      setProductPrice(value === "" ? "" : Number(value));
                      setCreatePriceError(null);
                    }}
                    className={cn(
                      "mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                      createPriceError ? "border-rose-500/60 bg-rose-500/10" : "border-slate-700 bg-slate-900/60"
                    )}
                  />
                  {createPriceError && <span className="mt-2 block text-xs text-rose-200">{createPriceError}</span>}
                </label>

                <label className="block text-xs uppercase tracking-[0.25em] text-slate-500">
                  Frete
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      value={freeShipping ? "" : shippingValue}
                      onChange={(event) => {
                        const value = event.target.value;
                        setShippingValue(value === "" ? "" : Number(value));
                        setCreateShippingError(null);
                      }}
                      disabled={freeShipping}
                      className={cn(
                        "w-full rounded-2xl border px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-0",
                        freeShipping ? "cursor-not-allowed border-slate-700 bg-slate-800/40 text-slate-400" : "border-slate-700 bg-slate-900/60",
                        createShippingError && !freeShipping && "border-rose-500/60 bg-rose-500/10"
                      )}
                    />
                    <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                      <input
                        type="checkbox"
                        checked={freeShipping}
                        onChange={(event) => {
                          setFreeShipping(event.target.checked);
                          if (event.target.checked) {
                            setCreateShippingError(null);
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30"
                      />
                      Frete grátis
                    </label>
                  </div>
                  {createShippingError && !freeShipping && (
                    <span className="mt-2 block text-xs text-rose-200">{createShippingError}</span>
                  )}
                </label>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Template</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {TEMPLATE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTemplate(option.value)}
                      className={cn(
                        "flex flex-col items-start gap-3 rounded-3xl border px-4 py-4 text-left transition",
                        template === option.value
                          ? "border-sky-400/60 bg-sky-500/10 text-slate-100 shadow-[0_30px_80px_-70px_rgba(34,211,238,0.6)]"
                          : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700"
                      )}
                    >
                      <div className={cn("h-16 w-full rounded-2xl bg-gradient-to-br", option.gradient)} />
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{option.label}</p>
                        <p className="text-xs text-slate-400">{option.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleGenerateLandingPage}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Gerando…" : "Gerar landing page"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-8 shadow-[0_50px_140px_-110px_rgba(34,211,238,0.55)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Portfólio</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-50">Landings em operação</h2>
              <p className="text-sm text-slate-400">
                Filtre por status ou template para planejar ativações rápidas com o squad de mídia.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {( ["TODOS", "ATIVA", "PAUSADA"] as StatusFilterValue[] ).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition",
                    filterStatus === status
                      ? "border-sky-500/60 bg-sky-500/15 text-sky-100"
                      : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  <span>{status === "TODOS" ? "Todas" : status === "ATIVA" ? "Ativas" : "Pausadas"}</span>
                  <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">
                    {statusCount[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFilterTemplate("TODOS")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition",
                filterTemplate === "TODOS"
                  ? "border-sky-500/60 bg-sky-500/15 text-sky-100"
                  : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              )}
            >
              <span>Todos os modelos</span>
              <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">{metrics.total}</span>
            </button>
            {TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterTemplate(option.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition",
                  filterTemplate === option.value
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                )}
              >
                <span>{option.label}</span>
                <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-400">
                  {templateCount[option.value]}
                </span>
              </button>
            ))}
          </div>

          {globalError && (
            <div className="mt-6 rounded-3xl border border-rose-500/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
              {globalError}
            </div>
          )}

          <div className="mt-8 grid gap-5">
            {fetching && (
              <div className="grid gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-40 animate-pulse rounded-4xl border border-slate-800 bg-slate-900/50"
                  />
                ))}
              </div>
            )}

            {!fetching && filteredLandingPages.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-4xl border border-slate-800 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                <span className="text-4xl">🛰️</span>
                <p className="mt-3 text-sm text-slate-300">Nenhuma landing encontrada para os filtros atuais.</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ajuste os filtros ou gere uma nova landing para o portfólio Dermosul.
                </p>
              </div>
            )}

            {!fetching &&
              filteredLandingPages.map((landingPage) => (
                <LandingCard
                  key={landingPage.id}
                  landingPage={landingPage}
                  shareBaseUrl={shareBaseUrl}
                  onEdit={handleEdit}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                  onCopyLink={handleCopyLink}
                />
              ))}
          </div>
        </section>
      </div>

      {editingLandingPage && (
        <EditLandingPageModal
          landingPage={editingLandingPage}
          onClose={() => setEditingLandingPage(null)}
          onSave={handleSaveEditedLandingPage}
        />
      )}
    </div>
  );
}
