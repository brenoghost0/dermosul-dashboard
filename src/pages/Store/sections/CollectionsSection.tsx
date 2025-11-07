import { FormEvent, useEffect, useState } from "react";
import { storeAdminApi, Collection } from "../api";

interface CollectionFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  position: number;
}

const EMPTY_COLLECTION: CollectionFormState = {
  name: "",
  slug: "",
  description: "",
  position: 0,
};

export default function CollectionsSection() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [form, setForm] = useState<CollectionFormState>(EMPTY_COLLECTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  async function loadCollections() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listCollections();
      setCollections(data);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar coleções.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(collection: Collection) {
    setForm({
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description || "",
      position: collection.position,
    });
  }

  function handleNew() {
    setForm(EMPTY_COLLECTION);
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
      };

      if (form.id) {
        await storeAdminApi.updateCollection(form.id, payload);
      } else {
        await storeAdminApi.createCollection(payload);
      }
      await loadCollections();
      handleNew();
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar coleção.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta coleção?")) return;
    try {
      await storeAdminApi.deleteCollection(id);
      await loadCollections();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover coleção.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Coleções</h2>
          <p className="text-sm text-zinc-600">Agrupe produtos manualmente para destaques e campanhas Dermosul.</p>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nome" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} required />
            <TextInput label="Slug" value={form.slug} onChange={(value) => setForm((prev) => ({ ...prev, slug: value }))} placeholder="mais-vendidos" />
            <TextArea label="Descrição" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} />
            <TextInput label="Posição" type="number" value={form.position} onChange={(value) => setForm((prev) => ({ ...prev, position: Number(value) }))} />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="primary-action">
              {saving ? "Salvando..." : form.id ? "Atualizar coleção" : "Criar coleção"}
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
        <h3 className="mb-4 text-lg font-medium text-violet-900">Coleções cadastradas</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando coleções...</p>
        ) : collections.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhuma coleção cadastrada.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {collections.map((collection) => (
              <li key={collection.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="font-medium text-zinc-800">{collection.name}</span>
                  <span className="ml-2 text-xs uppercase text-zinc-500">/{collection.slug}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => handleEdit(collection)}
                    className="secondary-action text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(collection.id)}
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
