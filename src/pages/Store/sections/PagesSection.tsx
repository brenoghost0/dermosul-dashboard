import { FormEvent, useEffect, useState } from "react";
import { storeAdminApi, CmsPage } from "../api";

interface PageFormState {
  id?: string;
  title: string;
  slug: string;
  contentHtml: string;
  published: boolean;
  metaTitle: string;
  metaDescription: string;
}

const EMPTY_PAGE: PageFormState = {
  title: "",
  slug: "",
  contentHtml: "",
  published: true,
  metaTitle: "",
  metaDescription: "",
};

export default function PagesSection() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [form, setForm] = useState<PageFormState>(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  async function loadPages() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listPages();
      setPages(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar páginas.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(page: CmsPage) {
    setForm({
      id: page.id,
      title: page.title,
      slug: page.slug,
      contentHtml: page.contentHtml,
      published: page.published,
      metaTitle: page.metaTitle || "",
      metaDescription: page.metaDescription || "",
    });
  }

  function handleNew() {
    setForm(EMPTY_PAGE);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        contentHtml: form.contentHtml,
        published: form.published,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      };

      if (form.id) {
        await storeAdminApi.updatePage(form.id, payload);
      } else {
        await storeAdminApi.createPage(payload);
      }
      await loadPages();
      handleNew();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar página.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta página?")) return;
    try {
      await storeAdminApi.deletePage(id);
      await loadPages();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover página.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Páginas CMS</h2>
          <p className="text-sm text-zinc-600">Gerencie páginas institucionais como Sobre, Trocas e Privacidade.</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Título" value={form.title} onChange={(value) => setForm((prev) => ({ ...prev, title: value }))} required />
            <TextInput label="Slug" value={form.slug} onChange={(value) => setForm((prev) => ({ ...prev, slug: value }))} placeholder="sobre" />
            <TextInput label="Meta title" value={form.metaTitle} onChange={(value) => setForm((prev) => ({ ...prev, metaTitle: value }))} />
            <TextInput label="Meta description" value={form.metaDescription} onChange={(value) => setForm((prev) => ({ ...prev, metaDescription: value }))} />
          </div>
          <TextArea label="Conteúdo (HTML)" rows={8} value={form.contentHtml} onChange={(value) => setForm((prev) => ({ ...prev, contentHtml: value }))} />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm((prev) => ({ ...prev, published: event.target.checked }))}
            />
            Página publicada
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : form.id ? "Atualizar página" : "Criar página"}
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
        <h3 className="mb-4 text-lg font-medium text-violet-900">Páginas cadastradas</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando páginas...</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma página cadastrada.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pages.map((page) => (
              <li key={page.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="font-medium text-zinc-800">{page.title}</span>
                  <span className="ml-2 text-xs uppercase text-zinc-500">/{page.slug}</span>
                  {!page.published && <span className="ml-2 text-xs text-red-500">Rascunho</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleEdit(page)}
                    className="secondary-action text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(page.id)}
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

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
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

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}
