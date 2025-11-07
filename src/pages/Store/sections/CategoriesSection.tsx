import { FormEvent, useEffect, useMemo, useState } from "react";
import { storeAdminApi, Category } from "../api";

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  position: number;
  parentId: string | null;
}

const EMPTY_CATEGORY: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  position: 0,
  parentId: null,
};

export default function CategoriesSection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_CATEGORY);
  const [saving, setSaving] = useState(false);

  const flattenedCategories = useMemo(() => flattenCategories(categories), [categories]);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(category: Category) {
    setForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      position: category.position,
      parentId: category.parentId || null,
    });
  }

  function handleNew() {
    setForm(EMPTY_CATEGORY);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description || null,
        position: Number(form.position) || 0,
        parent: form.parentId ? { connect: { id: form.parentId } } : undefined,
        parentId: form.parentId || null,
      } as any;

      if (form.id) {
        await storeAdminApi.updateCategory(form.id, payload);
      } else {
        await storeAdminApi.createCategory(payload);
      }
      await loadCategories();
      handleNew();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta categoria?")) return;
    try {
      await storeAdminApi.deleteCategory(id);
      await loadCategories();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover categoria.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Categorias</h2>
          <p className="text-sm text-zinc-600">Estruture as categorias usadas na navegação e filtros da loja.</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
            <TextInput label="Slug" value={form.slug} onChange={(value) => setForm((prev) => ({ ...prev, slug: value }))} placeholder="tratamento" />
            <TextArea label="Descrição" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
            <TextInput label="Posição" type="number" value={form.position} onChange={(value) => setForm((prev) => ({ ...prev, position: Number(value) }))} />
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-zinc-600">Categoria pai</span>
              <select
                value={form.parentId || ""}
                onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value || null }))}
                className="rounded border border-zinc-200 px-3 py-2"
              >
                <option value="">Nenhuma (nível raiz)</option>
                {flattenedCategories
                  .filter((cat) => cat.id !== form.id)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {"".padStart(cat.depth * 2, " ")}
                      {cat.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : form.id ? "Atualizar categoria" : "Criar categoria"}
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
        <h3 className="mb-4 text-lg font-medium text-violet-900">Árvore de categorias</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando categorias...</p>
        ) : flattenedCategories.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma categoria cadastrada.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {flattenedCategories.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="font-medium text-zinc-800">
                    {" ".repeat(cat.depth * 2)}
                    {cat.name}
                  </span>
                  <span className="ml-2 text-xs uppercase text-zinc-500">/{cat.slug}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleEdit(cat as Category)}
                    className="secondary-action text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
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

function flattenCategories(categories: Category[], depth = 0): Array<Category & { depth: number }> {
  return categories.flatMap((category) => [
    { ...category, depth },
    ...(category.subcategories ? flattenCategories(category.subcategories, depth + 1) : []),
  ]);
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="rounded border border-zinc-200 px-3 py-2"
      />
    </label>
  );
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
