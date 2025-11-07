import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  storeAdminApi,
  ProductDetail,
  ProductSummary,
  Category,
  Collection,
  PaginatedProducts,
} from "../api";

interface ProductFormState {
  id?: string;
  name: string;
  slug: string;
  brand: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: number;
  active: boolean;
  description: string;
  descriptionHtml: string;
  imageUrls: string;
  categoryIds: string[];
  collectionIds: string[];
}

const EMPTY_PRODUCT: ProductFormState = {
  name: "",
  slug: "",
  brand: "",
  sku: "",
  price: "0",
  compareAtPrice: "",
  stockQuantity: 0,
  active: true,
  description: "",
  descriptionHtml: "",
  imageUrls: "",
  categoryIds: [],
  collectionIds: [],
};

export default function ProductsSection() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [meta, setMeta] = useState<Omit<PaginatedProducts, "items"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [priceAdjust, setPriceAdjust] = useState("");
  const [adjustingPrices, setAdjustingPrices] = useState(false);
  const [priceAdjustProgress, setPriceAdjustProgress] = useState(0);
  const [priceAdjustTotal, setPriceAdjustTotal] = useState<number | null>(null);
  const [priceAdjustProcessed, setPriceAdjustProcessed] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    loadAuxiliaryData();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setSelectedProductIds([]);
  }, [products]);

  async function loadAuxiliaryData() {
    try {
      const [cats, cols] = await Promise.all([storeAdminApi.listCategories(), storeAdminApi.listCollections()]);
      const priorityOrder = [
        "Tratamento",
        "Limpeza",
        "Hidratação",
        "Proteção",
        "Prevenção",
        "Correção",
        "Reparação",
      ];
      const orderedCats = [...cats].sort((a, b) => {
        const indexA = priorityOrder.findIndex((label) => label.toLowerCase() === a.name.toLowerCase());
        const indexB = priorityOrder.findIndex((label) => label.toLowerCase() === b.name.toLowerCase());
        if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        if (indexA !== indexB) return indexA - indexB;
        return a.name.localeCompare(b.name);
      });
      setCategories(orderedCats);
      setCollections(cols);
    } catch (err: any) {
      console.error("Falha ao carregar categorias/coleções", err);
    }
  }

  async function loadProducts(page = 1) {
    setLoading(true);
    try {
      const data = await storeAdminApi.listProducts({ q: search || undefined, page });
      setProducts(data.items);
      setMeta({ page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages });
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  const hasProducts = useMemo(() => products.length > 0, [products]);
  const selectionCount = selectedProductIds.length;
  const allVisibleSelected = selectionCount > 0 && selectionCount === products.length && products.length > 0;

  function handleEdit(product: ProductSummary | ProductDetail) {
    setEditing(true);
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      sku: product.sku,
      price: centsToCurrency(product.price),
      compareAtPrice: product.compareAtPrice ? centsToCurrency(product.compareAtPrice) : "",
      stockQuantity: product.stockQuantity,
      active: product.active,
      description: (product as ProductDetail).description || "",
      descriptionHtml: (product as ProductDetail).descriptionHtml || "",
      imageUrls: ((product.images || []).map((image) => image.url).join("\n")),
      categoryIds: ((product as ProductDetail).productLinks || []).map((link) => link.categoryId),
      collectionIds: ((product as ProductDetail).collectionLinks || []).map((link) => link.collectionId),
    });
  }

  const computeNextSku = useCallback(async () => {
    try {
      const data = await storeAdminApi.listProducts({ page: 1, pageSize: 500, sort: "newest" });
      if (Array.isArray(data.items) && data.items.length > 0) {
        return deriveNextSku(data.items);
      }
    } catch (err) {
      console.warn("[ProductsSection] Falha ao calcular próximo SKU via API", err);
    }
    return deriveNextSku(products);
  }, [products]);

  const handleNewProduct = useCallback(async () => {
    setEditing(false);
    setStatusMessage(null);
    setError(null);
    const fallbackSku = generateSku();
    setForm({ ...EMPTY_PRODUCT, sku: fallbackSku, slug: "" });
    const nextSkuValue = await computeNextSku();
    setForm((prev) => ({ ...prev, sku: nextSkuValue, slug: "" }));
  }, [computeNextSku]);

  useEffect(() => {
    if (!editing && !form.id && !form.sku) {
      computeNextSku().then((nextSkuValue) => {
        setForm((prev) => ({ ...prev, sku: nextSkuValue }));
      });
    }
  }, [computeNextSku, editing, form.id, form.sku]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const payload = {
        id: form.id,
        name: form.name,
        slug: form.slug || slugify(form.name),
        brand: form.brand,
        sku: form.sku,
        price: currencyToCents(form.price),
        compareAtPrice: form.compareAtPrice ? currencyToCents(form.compareAtPrice) : null,
        stockQuantity: Number(form.stockQuantity) || 0,
        active: form.active,
        description: form.description,
        descriptionHtml: form.descriptionHtml || null,
        images: form.imageUrls
          .split(/\r?\n/)
          .map((url) => url.trim())
          .filter(Boolean)
          .map((url, index) => ({ url, position: index })),
        categoryIds: form.categoryIds,
        collectionIds: form.collectionIds,
      };

      const saved = await storeAdminApi.upsertProduct(payload);
      handleEdit(saved);
      await loadProducts(meta?.page || 1);
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar produto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este produto?")) return;
    try {
      await storeAdminApi.deleteProduct(id);
      await loadProducts(meta?.page || 1);
      handleNewProduct();
      setStatusMessage("Produto removido com sucesso.");
      setSelectedProductIds((prev) => prev.filter((selectedId) => selectedId !== id));
    } catch (err: any) {
      setError(err?.message || "Falha ao remover produto.");
    }
  }

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map((product) => product.id));
    }
  };

  async function handleBulkDelete() {
    if (selectedProductIds.length === 0) return;
    if (!confirm(`Remover ${selectedProductIds.length} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    setError(null);
    setStatusMessage(null);
    let failures = 0;
    for (const id of selectedProductIds) {
      try {
        await storeAdminApi.deleteProduct(id);
      } catch (err: any) {
        failures += 1;
        console.error("[ProductsSection] Falha ao remover produto em lote", err);
      }
    }
    setBulkDeleting(false);
    setSelectedProductIds([]);
    await loadProducts(meta?.page || 1);
    handleNewProduct();
    if (failures > 0) {
      setError(`${failures} produto(s) não puderam ser removidos. Tente novamente.`);
    } else {
      setStatusMessage("Produtos removidos com sucesso.");
    }
  }

  function toggleCategory(id: string) {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(id);
      return {
        ...prev,
        categoryIds: exists ? prev.categoryIds.filter((cat) => cat !== id) : [...prev.categoryIds, id],
      };
    });
  }

  function toggleCollection(id: string) {
    setForm((prev) => {
      const exists = prev.collectionIds.includes(id);
      return {
        ...prev,
        collectionIds: exists ? prev.collectionIds.filter((col) => col !== id) : [...prev.collectionIds, id],
      };
    });
  }

  async function handleAdjustPrices() {
    setError(null);
    setStatusMessage(null);
    const normalized = priceAdjust.replace(",", ".").trim();
    const percentage = Number(normalized);
    if (!Number.isFinite(percentage) || percentage === 0) {
      setError("Informe um percentual válido (ex: -10 para reduzir 10%).");
      return;
    }
    const multiplier = 1 + percentage / 100;
    if (multiplier <= 0) {
      setError("O ajuste informado não pode zerar ou deixar os preços negativos.");
      return;
    }

    setAdjustingPrices(true);
    setAdjustingPrices(true);
    setPriceAdjustProgress(0.05);
    setPriceAdjustProcessed(0);
    setPriceAdjustTotal(meta?.total ?? products.length);

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    progressTimer = setInterval(() => {
      setPriceAdjustProgress((prev) => {
        if (prev >= 0.85) return prev;
        return prev + 0.02;
      });
    }, 120);

    try {
      const result = await storeAdminApi.adjustProductPrices(percentage);
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      setPriceAdjustProcessed(result.updated ?? 0);
      setPriceAdjustProgress(1);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadProducts(meta?.page || 1);
      setStatusMessage(
        (result.updated ?? 0) > 0
          ? `Preços ajustados em ${percentage > 0 ? "+" : ""}${percentage}% para ${result.updated} produto(s).`
          : "Nenhum preço precisou ser atualizado."
      );
      setPriceAdjust("");
    } catch (err: any) {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      setError(err?.message || "Falha ao ajustar preços.");
    } finally {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      setAdjustingPrices(false);
      setPriceAdjustProgress(0);
      setPriceAdjustTotal(null);
      setPriceAdjustProcessed(0);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-violet-900">Produtos</h2>
            <p className="text-sm text-zinc-600">Gerencie o catálogo de dermocosméticos Dermosul.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Buscar por nome, SKU ou descrição"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleNewProduct}
              className="primary-action"
            >
              Novo produto
            </button>
          </div>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {statusMessage && <p className="text-sm text-emerald-400">{statusMessage}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
            <TextInput label="Slug" value={form.slug} onChange={(value) => setForm((prev) => ({ ...prev, slug: value }))} placeholder="produto-dermosul" />
            <TextInput label="Marca" value={form.brand} onChange={(value) => setForm((prev) => ({ ...prev, brand: value }))} />
            <TextInput label="SKU" value={form.sku} onChange={(value) => setForm((prev) => ({ ...prev, sku: value }))} />
            <TextInput label="Preço (R$)" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} required />
            <TextInput label="Preço cheio (R$)" value={form.compareAtPrice} onChange={(value) => setForm((prev) => ({ ...prev, compareAtPrice: value }))} />
            <TextInput label="Estoque" type="number" value={form.stockQuantity} onChange={(value) => setForm((prev) => ({ ...prev, stockQuantity: Number(value) }))} />
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
              Produto ativo
            </label>
          </div>

          <TextArea label="Descrição" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} rows={3} />
          <TextArea label="Descrição HTML" value={form.descriptionHtml} onChange={(value) => setForm((prev) => ({ ...prev, descriptionHtml: value }))} rows={4} />
          <TextArea label="Imagens (um URL por linha)" value={form.imageUrls} onChange={(value) => setForm((prev) => ({ ...prev, imageUrls: value }))} rows={4} />

          <div className="grid gap-6 md:grid-cols-2">
            <MultiSelect
              label="Categorias"
              items={categories}
              selected={form.categoryIds}
              onToggle={toggleCategory}
              emptyMessage="Nenhuma categoria cadastrada."
            />
            <MultiSelect
              label="Coleções"
              items={collections}
              selected={form.collectionIds}
              onToggle={toggleCollection}
              emptyMessage="Nenhuma coleção cadastrada."
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : editing ? "Atualizar produto" : "Cadastrar produto"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={handleNewProduct}
                className="secondary-action"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0B1321] p-6 shadow-lg">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-[#0F1E34] p-4 text-slate-200 shadow-inner">
            <div>
              <p className="text-sm font-medium text-slate-100">Ajuste em massa</p>
              <p className="text-xs text-slate-400">Informe um percentual para aumentar ou reduzir todos os preços.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                Percentual
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceAdjust}
                  onChange={(event) => setPriceAdjust(event.target.value)}
                  placeholder="-10"
                  disabled={adjustingPrices}
                  className="w-24 rounded-full border border-slate-600 bg-[#101C2E] px-3 py-1 text-sm text-slate-100 transition focus:border-cyan-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <button
                type="button"
                onClick={handleAdjustPrices}
                disabled={adjustingPrices}
                className="rounded-full border border-cyan-400 bg-cyan-500/20 px-4 py-1.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adjustingPrices ? "Aplicando..." : "Aplicar ajuste"}
              </button>
            </div>
            {adjustingPrices && (
              <div className="mt-3 w-full">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <span>Atualizando preços</span>
                  <span>
                    {Math.round(priceAdjustProgress * 100)}%
                    {priceAdjustTotal !== null
                      ? ` (${Math.min(priceAdjustProcessed, priceAdjustTotal)}/${priceAdjustTotal})`
                      : ""}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 transition-[width] duration-200 ease-out"
                    style={{ width: `${Math.min(priceAdjustProgress * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        <h3 className="mb-4 text-lg font-medium text-violet-900">Catálogo</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando produtos...</p>
        ) : !hasProducts ? (
          <p className="text-sm text-zinc-500">Nenhum produto encontrado.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <div className="text-zinc-600">
                {selectionCount > 0 ? `${selectionCount} produto(s) selecionado(s)` : "Nenhum produto selecionado"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="secondary-action text-xs"
                >
                  {allVisibleSelected ? "Limpar seleção" : "Selecionar todos da página"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectionCount === 0 || bulkDeleting}
                  className="danger-action text-xs disabled:opacity-50"
                >
                  {bulkDeleting ? "Removendo..." : "Remover selecionados"}
                </button>
              </div>
            </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Selecionar todos os produtos desta página"
                    />
                  </th>
                  <th className="px-3 py-2">Produto</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Preço</th>
                  <th className="px-3 py-2">Estoque</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-zinc-100">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        aria-label={`Selecionar ${product.name}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-100">{product.name}</div>
                      <div className="text-xs uppercase text-slate-400">{product.brand}</div>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{product.sku}</td>
                    <td className="px-3 py-3 text-sm text-zinc-700">{formatCurrency(product.price)}</td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{product.stockQuantity}</td>
                    <td className="px-3 py-3">
                      <span className={product.active ? "tag" : "chip"}>{product.active ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-xs">
                      <button
                        onClick={async () => {
                          try {
                            const detail = await storeAdminApi.getProduct(product.id);
                            handleEdit(detail);
                            setStatusMessage(`Editando ${detail.name}.`);
                          } catch (err: any) {
                            setError(err?.message || "Falha ao carregar produto para edição.");
                          }
                        }}
                        className="mr-2 secondary-action text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="danger-action text-xs"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
            <span>
              Página {meta.page} de {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadProducts(Math.max(meta.page - 1, 1))}
                disabled={meta.page === 1}
                className="secondary-action text-xs"
              >
                Anterior
              </button>
              <button
                onClick={() => loadProducts(Math.min(meta.page + 1, meta.totalPages))}
                disabled={meta.page === meta.totalPages}
                className="secondary-action text-xs"
              >
                Próxima
              </button>
            </div>
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
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string | number;
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

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
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

function MultiSelect({
  label,
  items,
  selected,
  onToggle,
  emptyMessage,
}: {
  label: string;
  items: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  emptyMessage: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-zinc-600">{label}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggle(item.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  active
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-200 hover:text-violet-700"
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function currencyToCents(value: string) {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  let normalized = trimmed.replace(/\s+/g, "");

  const hasCommaDecimal = normalized.includes(",") && /,\d{1,2}$/.test(normalized);

  if (hasCommaDecimal) {
    // Formato brasileiro: 1.234,56 -> 1234.56
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    // Formato internacional: 1,234.56 ou 97.00
    normalized = normalized.replace(/,/g, "");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToCurrency(value: number) {
  return (value / 100).toFixed(2);
}

function formatCurrency(value: number) {
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

function generateSku() {
  return `DERM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function deriveNextSku(products: Array<{ sku: string }>) {
  let bestPrefix = "DERM-";
  let bestDigitsLength = 3;
  let highest = 0;

  products.forEach((product) => {
    const raw = (product.sku || "").trim().toUpperCase();
    const match = raw.match(/^(.*?)(\d+)$/);
    if (!match) return;
    const [, prefix, digits] = match;
    const value = parseInt(digits, 10);
    if (!Number.isFinite(value)) return;
    if (value > highest) {
      highest = value;
      bestPrefix = prefix;
      bestDigitsLength = digits.length;
    }
  });

  if (highest === 0 && products.length === 0) {
    return generateSku();
  }

  const nextValue = highest + 1;
  const padded = nextValue.toString().padStart(bestDigitsLength, "0");
  return `${bestPrefix}${padded}`.toUpperCase();
}
