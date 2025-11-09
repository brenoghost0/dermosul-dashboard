import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { storeAdminApi, Coupon } from "../api";
import {
  PANEL_CLASS,
  SUBPANEL_CLASS,
  INPUT_CLASS,
  TEXTAREA_CLASS,
  SELECT_CLASS,
  CHECKBOX_CLASS,
  SectionHeader,
  FieldLabel,
  InlineBadge,
} from "../ui";

type CouponFormState = {
  code: string;
  name: string;
  description: string;
  type: "PERCENT" | "AMOUNT";
  value: string;
  freeShipping: boolean;
  autoApply: boolean;
  stackable: boolean;
  usageLimit: string;
  perCustomerLimit: string;
  minSubtotal: string;
  maxDiscount: string;
  newCustomerOnly: boolean;
  targetProducts: string;
  targetCollections: string;
  targetCategories: string;
  excludedProducts: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const CURRENCY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const buildEmptyForm = (): CouponFormState => ({
  code: "",
  name: "",
  description: "",
  type: "PERCENT",
  value: "10",
  freeShipping: false,
  autoApply: false,
  stackable: false,
  usageLimit: "",
  perCustomerLimit: "",
  minSubtotal: "",
  maxDiscount: "",
  newCustomerOnly: false,
  targetProducts: "",
  targetCollections: "",
  targetCategories: "",
  excludedProducts: "",
  startsAt: "",
  endsAt: "",
  active: true,
});

const toCurrencyString = (value?: number | null) => {
  if (!value && value !== 0) return "";
  return (value / 100).toFixed(2);
};

const toPercentString = (value?: number | null) => {
  if (!value && value !== 0) return "";
  return String(value);
};

const parseCurrencyInput = (value: string): number | null => {
  if (!value || !value.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
};

const parseIntegerField = (value: string): number | null => {
  if (!value || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

const parseIdList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  return dayjs(value).format("YYYY-MM-DDTHH:mm");
};

const fromDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = dayjs(value);
  return date.isValid() ? date.toDate().toISOString() : null;
};

const formatUsage = (coupon: Coupon) => {
  if (coupon.usageLimit) {
    return `${coupon.usageCount}/${coupon.usageLimit} usos`;
  }
  return `${coupon.usageCount} usos`;
};

const formatTargetSummary = (coupon: Coupon) => {
  const targets = [
    coupon.targetProductIds?.length ? `${coupon.targetProductIds.length} produtos` : null,
    coupon.targetCollectionIds?.length ? `${coupon.targetCollectionIds.length} coleções` : null,
    coupon.targetCategoryIds?.length ? `${coupon.targetCategoryIds.length} categorias` : null,
  ].filter(Boolean);
  if (targets.length === 0) return "Aplica em todo o catálogo";
  return `Aplica em ${targets.join(", ")}`;
};

const humanizeValue = (coupon: Coupon) => {
  if (coupon.freeShipping) {
    return "Frete grátis";
  }
  if (coupon.type === "PERCENT") {
    return `${coupon.value}%`;
  }
  return CURRENCY.format(coupon.value / 100);
};

const mapCouponToForm = (coupon: Coupon): CouponFormState => ({
  code: coupon.code,
  name: coupon.name ?? "",
  description: coupon.description ?? "",
  type: coupon.type,
  value: coupon.type === "PERCENT" ? toPercentString(coupon.value) : toCurrencyString(coupon.value),
  freeShipping: coupon.freeShipping,
  autoApply: coupon.autoApply,
  stackable: coupon.stackable,
  usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
  perCustomerLimit: coupon.perCustomerLimit ? String(coupon.perCustomerLimit) : "",
  minSubtotal: coupon.minSubtotalCents ? toCurrencyString(coupon.minSubtotalCents) : "",
  maxDiscount: coupon.maxDiscountCents ? toCurrencyString(coupon.maxDiscountCents) : "",
  newCustomerOnly: coupon.newCustomerOnly,
  targetProducts: (coupon.targetProductIds || []).join("\n"),
  targetCollections: (coupon.targetCollectionIds || []).join("\n"),
  targetCategories: (coupon.targetCategoryIds || []).join("\n"),
  excludedProducts: (coupon.excludedProductIds || []).join("\n"),
  startsAt: toDateTimeLocal(coupon.startsAt ?? undefined),
  endsAt: toDateTimeLocal(coupon.endsAt ?? undefined),
  active: coupon.active,
});

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  const palette =
    tone === "success"
      ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-100"
      : "border-rose-500/40 bg-rose-900/20 text-rose-100";
  return <div className={`rounded-3xl border px-4 py-3 text-sm ${palette}`}>{message}</div>;
}

export default function CouponsSection() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(buildEmptyForm);

  const loadCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listCoupons();
      setCoupons(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar cupons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const editingLabel = editingId ? "Editar cupom" : "Novo cupom";

  const handleEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm(mapCouponToForm(coupon));
    setSuccess(null);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setSuccess(null);
    setError(null);
  };

  const handleDelete = async (coupon: Coupon) => {
    const confirmed = window.confirm(`Remover o cupom ${coupon.code}?`);
    if (!confirmed) return;
    setError(null);
    try {
      await storeAdminApi.deleteCoupon(coupon.id);
      setSuccess("Cupom removido com sucesso.");
      if (editingId === coupon.id) {
        resetForm();
      }
      await loadCoupons();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover cupom.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      const payload = buildPayload(form);
      if (!payload.code) {
        throw new Error("Informe o código do cupom.");
      }
      if (payload.type === "PERCENT" && (payload.value <= 0 || payload.value > 100)) {
        throw new Error("Percentual deve estar entre 1 e 100.");
      }
      if (payload.type === "AMOUNT" && payload.value <= 0 && !payload.freeShipping) {
        throw new Error("Informe um valor em reais para o desconto.");
      }

      if (editingId) {
        await storeAdminApi.updateCoupon(editingId, payload);
        setSuccess("Cupom atualizado com sucesso.");
      } else {
        await storeAdminApi.createCoupon(payload);
        setSuccess("Cupom criado com sucesso.");
        resetForm();
      }
      await loadCoupons();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar cupom.");
    } finally {
      setSaving(false);
    }
  };

  const sortedCoupons = useMemo(() => {
    return [...coupons].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [coupons]);

  return (
    <section className={PANEL_CLASS}>
      <SectionHeader
        eyebrow="Incentivos inteligentes"
        title="Cupons Dermosul"
        description="Orquestre campanhas sofisticadas com regras de segmentação, limites por cliente, frete grátis e disparos automáticos."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-sky-400 hover:text-sky-200">
          Novo cupom
        </button>
        <button type="button" onClick={loadCoupons} className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-2 text-sm text-slate-300 hover:border-slate-600">
          Atualizar lista
        </button>
      </div>

      {error && <Alert tone="error" message={error} />}
      {success && <Alert tone="success" message={success} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 px-5 py-10 text-center text-sm text-slate-400">
              Carregando cupons Dermosul...
            </div>
          ) : sortedCoupons.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-10 text-center text-slate-400">
              Ainda não existem cupons ativos. Crie um incentivo estratégico ao lado.
            </div>
          ) : (
            sortedCoupons.map((coupon) => (
              <article
                key={coupon.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/40 px-5 py-5 shadow-[0_25px_120px_-80px_rgba(34,211,238,0.4)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Cupom</p>
                    <h3 className="mt-1 text-xl font-semibold text-slate-50">{coupon.code}</h3>
                    <p className="text-sm text-slate-400">{coupon.name || coupon.description || "Cupom personalizado Dermosul."}</p>
                  </div>
                  <InlineBadge>{coupon.active ? "ATIVO" : "PAUSADO"}</InlineBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="rounded-xl border border-slate-700/60 px-3 py-1">
                    {coupon.type === "PERCENT" ? `${coupon.value}% OFF` : humanizeValue(coupon)}
                  </span>
                  {coupon.freeShipping && (
                    <span className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 px-3 py-1 text-emerald-100">Frete grátis</span>
                  )}
                  {coupon.autoApply && <span className="rounded-xl border border-sky-500/40 bg-sky-900/20 px-3 py-1 text-sky-100">Auto-aplicável</span>}
                  {coupon.stackable && <span className="rounded-xl border border-indigo-500/40 bg-indigo-900/20 px-3 py-1 text-indigo-100">Stackable</span>}
                  {coupon.newCustomerOnly && (
                    <span className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-900/20 px-3 py-1 text-fuchsia-100">Primeira compra</span>
                  )}
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Uso</p>
                    <p className="mt-1 font-medium text-slate-100">{formatUsage(coupon)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Segmentação</p>
                    <p className="mt-1 text-slate-200">{formatTargetSummary(coupon)}</p>
                  </div>
                </div>
                {(coupon.minSubtotalCents || coupon.startsAt || coupon.endsAt) && (
                  <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
                    {coupon.minSubtotalCents && (
                      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Mínimo</p>
                        <p>{CURRENCY.format(coupon.minSubtotalCents / 100)}</p>
                      </div>
                    )}
                    {coupon.startsAt && (
                      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Início</p>
                        <p>{dayjs(coupon.startsAt).format("DD/MM HH:mm")}</p>
                      </div>
                    )}
                    {coupon.endsAt && (
                      <div className="rounded-2xl border border-slate-800/70 bg-slate-900/30 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Fim</p>
                        <p>{dayjs(coupon.endsAt).format("DD/MM HH:mm")}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleEdit(coupon)}
                    className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-sky-400 hover:text-sky-200"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(coupon)}
                    className="rounded-2xl border border-rose-500/40 bg-rose-900/20 px-4 py-2 text-sm text-rose-100 hover:border-rose-400"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className={`${SUBPANEL_CLASS} space-y-4`}>
          <SectionHeader eyebrow="Orquestração" title={editingLabel} description="Defina regras, segmentações e limites de cada incentivo." />
          <FieldLabel label="Código">
            <input
              className={INPUT_CLASS}
              value={form.code}
              onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
              placeholder="EX: DERMOSUL10"
              required
            />
          </FieldLabel>
          <FieldLabel label="Nome interno">
            <input className={INPUT_CLASS} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
          </FieldLabel>
          <FieldLabel label="Descrição curta">
            <textarea className={TEXTAREA_CLASS} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </FieldLabel>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Tipo de benefício">
              <select
                className={SELECT_CLASS}
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as CouponFormState["type"] }))}
              >
                <option value="PERCENT">Percentual (%)</option>
                <option value="AMOUNT">Valor em reais</option>
              </select>
            </FieldLabel>
            <FieldLabel label={form.type === "PERCENT" ? "Percentual de desconto" : "Valor em reais"}>
              <input
                className={INPUT_CLASS}
                type="text"
                inputMode="decimal"
                value={form.value}
                onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                placeholder={form.type === "PERCENT" ? "Ex: 15" : "Ex: 50,00"}
              />
            </FieldLabel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Uso total limite">
              <input
                className={INPUT_CLASS}
                type="number"
                min={0}
                value={form.usageLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
                placeholder="Sem limite"
              />
            </FieldLabel>
            <FieldLabel label="Limite por cliente">
              <input
                className={INPUT_CLASS}
                type="number"
                min={0}
                value={form.perCustomerLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, perCustomerLimit: event.target.value }))}
                placeholder="Sem limite"
              />
            </FieldLabel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Subtotal mínimo (R$)">
              <input
                className={INPUT_CLASS}
                type="text"
                inputMode="decimal"
                value={form.minSubtotal}
                onChange={(event) => setForm((prev) => ({ ...prev, minSubtotal: event.target.value }))}
                placeholder="Ex: 150,00"
              />
            </FieldLabel>
            <FieldLabel label="Desconto máximo (R$)">
              <input
                className={INPUT_CLASS}
                type="text"
                inputMode="decimal"
                value={form.maxDiscount}
                onChange={(event) => setForm((prev) => ({ ...prev, maxDiscount: event.target.value }))}
                placeholder="Opcional"
              />
            </FieldLabel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Início da vigência">
              <input
                className={INPUT_CLASS}
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Fim da vigência">
              <input
                className={INPUT_CLASS}
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
              />
            </FieldLabel>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={form.freeShipping}
                onChange={(event) => setForm((prev) => ({ ...prev, freeShipping: event.target.checked }))}
              />
              Frete grátis ao aplicar
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={form.autoApply}
                onChange={(event) => setForm((prev) => ({ ...prev, autoApply: event.target.checked }))}
              />
              Aplicação automática (quando elegível)
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={form.stackable}
                onChange={(event) => setForm((prev) => ({ ...prev, stackable: event.target.checked }))}
              />
              Permitir combinar com outros cupons
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={form.newCustomerOnly}
                onChange={(event) => setForm((prev) => ({ ...prev, newCustomerOnly: event.target.checked }))}
              />
              Apenas primeira compra
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className={CHECKBOX_CLASS}
                checked={form.active}
                onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Cupom ativo
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Produtos incluídos (IDs separados por vírgula ou linha)" hint="Deixe vazio para aplicar em todos os produtos.">
              <textarea
                className={TEXTAREA_CLASS}
                value={form.targetProducts}
                onChange={(event) => setForm((prev) => ({ ...prev, targetProducts: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Coleções incluídas">
              <textarea
                className={TEXTAREA_CLASS}
                value={form.targetCollections}
                onChange={(event) => setForm((prev) => ({ ...prev, targetCollections: event.target.value }))}
              />
            </FieldLabel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FieldLabel label="Categorias incluídas">
              <textarea
                className={TEXTAREA_CLASS}
                value={form.targetCategories}
                onChange={(event) => setForm((prev) => ({ ...prev, targetCategories: event.target.value }))}
              />
            </FieldLabel>
            <FieldLabel label="Produtos excluídos">
              <textarea
                className={TEXTAREA_CLASS}
                value={form.excludedProducts}
                onChange={(event) => setForm((prev) => ({ ...prev, excludedProducts: event.target.value }))}
              />
            </FieldLabel>
          </div>

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-2xl border border-sky-500/60 bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-100 shadow-[0_20px_60px_-40px_rgba(14,165,233,0.8)] hover:border-sky-300"
              disabled={saving}
            >
              {saving ? "Salvando..." : editingId ? "Atualizar cupom" : "Criar cupom"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function buildPayload(form: CouponFormState) {
  const code = form.code.trim().toUpperCase();
  const payload: Partial<Coupon> & {
    code: string;
    type: "PERCENT" | "AMOUNT";
    value: number;
    freeShipping: boolean;
    autoApply: boolean;
    stackable: boolean;
    newCustomerOnly: boolean;
    targetProductIds: string[];
    targetCollectionIds: string[];
    targetCategoryIds: string[];
    excludedProductIds: string[];
    active: boolean;
  } = {
    code,
    name: form.name.trim() || null,
    description: form.description.trim() || null,
    type: form.type,
    value:
      form.type === "PERCENT"
        ? Math.max(0, Math.round(Number(form.value) || 0))
        : parseCurrencyInput(form.value) ?? 0,
    freeShipping: form.freeShipping,
    autoApply: form.autoApply,
    stackable: form.stackable,
    usageLimit: parseIntegerField(form.usageLimit),
    perCustomerLimit: parseIntegerField(form.perCustomerLimit),
    minSubtotalCents: parseCurrencyInput(form.minSubtotal),
    maxDiscountCents: parseCurrencyInput(form.maxDiscount),
    newCustomerOnly: form.newCustomerOnly,
    targetProductIds: parseIdList(form.targetProducts),
    targetCollectionIds: parseIdList(form.targetCollections),
    targetCategoryIds: parseIdList(form.targetCategories),
    excludedProductIds: parseIdList(form.excludedProducts),
    startsAt: fromDateTimeLocal(form.startsAt),
    endsAt: fromDateTimeLocal(form.endsAt),
    active: form.active,
  };

  return payload;
}
