import { FormEvent, useEffect, useMemo, useState } from "react";
import { Menu, MenuItem, storeAdminApi } from "../api";

type MenuKey = "HEADER" | "FOOTER";

interface MenuItemFormState {
  id?: string;
  menuKey: MenuKey;
  label: string;
  href: string;
  position: number;
  parentId: string | null;
}

const EMPTY_FORM: MenuItemFormState = {
  menuKey: "HEADER",
  label: "",
  href: "",
  position: 0,
  parentId: null,
};

export default function NavigationSection() {
  const [menus, setMenus] = useState<Record<MenuKey, Menu | null>>({ HEADER: null, FOOTER: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MenuItemFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const headerItems = useMemo(() => (menus.HEADER?.items || []).sort((a, b) => a.position - b.position), [menus.HEADER]);
  const footerItems = useMemo(() => (menus.FOOTER?.items || []).sort((a, b) => a.position - b.position), [menus.FOOTER]);

  useEffect(() => {
    loadMenus();
  }, []);

  async function loadMenus() {
    setLoading(true);
    setError(null);
    try {
      const data = await storeAdminApi.listMenus();
      const mapped: Record<MenuKey, Menu | null> = { HEADER: null, FOOTER: null };
      data.forEach((menu) => {
        mapped[menu.key] = menu;
      });
      setMenus(mapped);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar menus.");
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(menuKey: MenuKey, item: MenuItem) {
    setForm({
      id: item.id,
      menuKey,
      label: item.label,
      href: item.href,
      position: item.position,
      parentId: item.parentId || null,
    });
  }

  function handleNew(menuKey: MenuKey) {
    setForm({ ...EMPTY_FORM, menuKey });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!menus[form.menuKey]) {
      setError("Menu não encontrado.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        label: form.label,
        href: form.href,
        position: Number(form.position) || 0,
        parentId: form.parentId || null,
      };
      if (form.id) {
        await storeAdminApi.updateMenuItem(form.id, { ...payload, menuId: menus[form.menuKey]!.id });
      } else {
        await storeAdminApi.createMenuItem(form.menuKey, payload);
      }
      await loadMenus();
      handleNew(form.menuKey);
    } catch (err: any) {
      setError(err?.message || "Falha ao salvar item de menu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm("Remover este item do menu?")) return;
    try {
      await storeAdminApi.deleteMenuItem(item.id);
      await loadMenus();
    } catch (err: any) {
      setError(err?.message || "Falha ao remover item.");
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <header className="mb-5">
          <h2 className="text-2xl font-semibold text-violet-900">Navegação</h2>
          <p className="text-sm text-zinc-600">Configure os menus do cabeçalho e rodapé da Store Dermosul.</p>
        </header>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando menus...</p>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium text-zinc-600">Menu</span>
                <select
                  value={form.menuKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, menuKey: event.target.value as MenuKey }))}
                  className="rounded border border-zinc-200 px-3 py-2"
                >
                  <option value="HEADER">Cabeçalho</option>
                  <option value="FOOTER">Rodapé</option>
                </select>
              </label>
              <TextInput label="Rótulo" value={form.label} onChange={(value) => setForm((prev) => ({ ...prev, label: value }))} required />
              <TextInput label="Link" value={form.href} onChange={(value) => setForm((prev) => ({ ...prev, href: value }))} placeholder="/pg/politica-de-troca" />
              <TextInput label="Posição" type="number" value={form.position} onChange={(value) => setForm((prev) => ({ ...prev, position: Number(value) }))} />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="primary-action">
                {saving ? "Salvando..." : form.id ? "Atualizar item" : "Adicionar item"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={() => handleNew(form.menuKey)}
                  className="secondary-action"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <MenuList
          title="Menu do cabeçalho"
          items={headerItems}
          onEdit={(item) => handleEdit("HEADER", item)}
          onDelete={handleDelete}
        />
        <MenuList
          title="Menu do rodapé"
          items={footerItems}
          onEdit={(item) => handleEdit("FOOTER", item)}
          onDelete={handleDelete}
        />
      </div>
    </section>
  );
}

function MenuList({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  items: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-violet-900">{title}</h3>
        <span className="text-xs text-zinc-500">{items.length} itens</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum item cadastrado.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
              <div>
                <span className="font-medium text-zinc-800">{item.label}</span>
                <span className="ml-2 text-xs text-zinc-500">{item.href}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => onEdit(item)}
                  className="secondary-action text-xs"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(item)}
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
