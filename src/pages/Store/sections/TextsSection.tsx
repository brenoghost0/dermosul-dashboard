import { FormEvent, useEffect, useState } from "react";
import { StoreTextBlocks } from "../api";
import { useStoreSettingsContext } from "../StoreSettingsContext";

const DEFAULT_BLOCKS: StoreTextBlocks = {
  announcement: {
    enabled: true,
    message: "Frete Dermosul para as maiores marcas de dermocosméticos em todo Brasil",
    ctaLabel: "Conheça",
    ctaHref: "/c/tratamento",
  },
  hero: {
    tag: "clinical",
    title: "As maiores marcas de dermocosméticos",
    subtitle: "Curadoria Dermosul com entrega brasileira e suporte especialista.",
    ctaPrimary: { label: "Comprar agora", href: "/colecoes/mais-vendidos" },
    ctaSecondary: { label: "Conhecer consultoria", href: "/pg/consultoria" },
  },
  highlights: { title: "Mais pedidos da curadoria Dermosul", subtitle: "Seleção das 10 maiores marcas do mundo" },
  newsletter: {
    title: "Newsletter curadoria Dermosul",
    subtitle: "Conteúdos sobre as grandes marcas direto no seu e-mail.",
    placeholder: "Digite seu e-mail",
    ctaLabel: "Receber novidades",
    legalText: "Ao enviar você concorda em receber comunicações Dermosul sobre nossas marcas parceiras.",
  },
  footer: {
    description: "Dermosul conecta você às 10 maiores marcas de dermocosméticos do mundo com curadoria especializada.",
    contactEmail: "atendimento@dermosul.com.br",
    contactPhone: "+55 11 4000-0000",
    serviceHours: "Seg a Sex, 9h às 18h",
    address: "Av. das Clínicas, 240 - São Paulo/SP",
  },
  checkout: {
    pixMessage: "Pagamento via Pix com confirmação em até 2 horas úteis junto aos nossos parceiros.",
    cardMessage: "Cartão de crédito disponível em breve.",
    successMessage: "Pedido recebido! A curadoria Dermosul acompanha cada etapa com a marca escolhida.",
  },
};

export default function TextsSection() {
  const { settings, loading, error, saving, update } = useStoreSettingsContext();
  const [blocks, setBlocks] = useState<StoreTextBlocks>(DEFAULT_BLOCKS);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!settings?.textBlocks) {
      setBlocks(DEFAULT_BLOCKS);
      return;
    }
    setBlocks(deepMerge(DEFAULT_BLOCKS, settings.textBlocks));
  }, [settings?.textBlocks]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await update({ textBlocks: blocks });
      setFeedback("Textos atualizados com sucesso.");
    } catch (err: any) {
      setFeedback(err?.message || "Falha ao salvar textos.");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = loading || saving || submitting;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-violet-900">Textos</h2>
        <p className="text-sm text-zinc-600">
          Personalize a comunicação da Store Dermosul em vitrines, banners, newsletter e mensagens de checkout.
        </p>
      </header>

      {(loading || !settings) && <p className="text-sm text-zinc-500">Carregando conteúdos...</p>}

      {!loading && settings && (
        <form className="grid gap-6" onSubmit={handleSubmit}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {feedback && <p className="text-sm text-violet-700">{feedback}</p>}

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Barra de anúncio</legend>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={Boolean(blocks.announcement?.enabled)}
                onChange={(event) =>
                  setBlocks((prev) => updateBlock(prev, ["announcement", "enabled"], event.target.checked))
                }
              />
              Exibir barra superior
            </label>
            <TextInput
              label="Mensagem"
              value={blocks.announcement?.message ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["announcement", "message"], value))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="CTA label"
                value={blocks.announcement?.ctaLabel ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["announcement", "ctaLabel"], value))}
              />
              <TextInput
                label="CTA link"
                value={blocks.announcement?.ctaHref ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["announcement", "ctaHref"], value))}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Hero</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Tag"
                value={blocks.hero?.tag ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "tag"], value))}
              />
              <TextInput
                label="Título"
                value={blocks.hero?.title ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "title"], value))}
              />
              <TextArea
                label="Subtítulo"
                value={blocks.hero?.subtitle ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "subtitle"], value))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="CTA primária"
                value={blocks.hero?.ctaPrimary?.label ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "ctaPrimary", "label"], value))}
              />
              <TextInput
                label="Link CTA primária"
                value={blocks.hero?.ctaPrimary?.href ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "ctaPrimary", "href"], value))}
              />
              <TextInput
                label="CTA secundária"
                value={blocks.hero?.ctaSecondary?.label ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "ctaSecondary", "label"], value))}
              />
              <TextInput
                label="Link CTA secundária"
                value={blocks.hero?.ctaSecondary?.href ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["hero", "ctaSecondary", "href"], value))}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Highlights</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Título"
                value={blocks.highlights?.title ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["highlights", "title"], value))}
              />
              <TextInput
                label="Subtítulo"
                value={blocks.highlights?.subtitle ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["highlights", "subtitle"], value))}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Newsletter</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Título"
                value={blocks.newsletter?.title ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["newsletter", "title"], value))}
              />
              <TextInput
                label="Subtítulo"
                value={blocks.newsletter?.subtitle ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["newsletter", "subtitle"], value))}
              />
              <TextInput
                label="Placeholder"
                value={blocks.newsletter?.placeholder ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["newsletter", "placeholder"], value))}
              />
              <TextInput
                label="CTA"
                value={blocks.newsletter?.ctaLabel ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["newsletter", "ctaLabel"], value))}
              />
            </div>
            <TextArea
              label="Texto legal"
              value={blocks.newsletter?.legalText ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["newsletter", "legalText"], value))}
            />
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Rodapé</legend>
            <TextArea
              label="Descrição institucional"
              value={blocks.footer?.description ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["footer", "description"], value))}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="E-mail"
                value={blocks.footer?.contactEmail ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["footer", "contactEmail"], value))}
              />
              <TextInput
                label="Telefone"
                value={blocks.footer?.contactPhone ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["footer", "contactPhone"], value))}
              />
              <TextInput
                label="Horário de atendimento"
                value={blocks.footer?.serviceHours ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["footer", "serviceHours"], value))}
              />
              <TextInput
                label="Endereço"
                value={blocks.footer?.address ?? ""}
                onChange={(value) => setBlocks((prev) => updateBlock(prev, ["footer", "address"], value))}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border border-violet-100 p-4">
            <legend className="px-2 text-sm font-semibold text-violet-900">Checkout</legend>
            <TextArea
              label="Mensagem Pix"
              value={blocks.checkout?.pixMessage ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["checkout", "pixMessage"], value))}
            />
            <TextArea
              label="Mensagem cartão"
              value={blocks.checkout?.cardMessage ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["checkout", "cardMessage"], value))}
            />
            <TextArea
              label="Mensagem de sucesso"
              value={blocks.checkout?.successMessage ?? ""}
              onChange={(value) => setBlocks((prev) => updateBlock(prev, ["checkout", "successMessage"], value))}
            />
          </fieldset>

          <div className="flex gap-3">
            <button type="submit" disabled={disabled} className="primary-action">
              {disabled ? "Salvando..." : "Salvar textos"}
            </button>
            <button
              type="button"
              onClick={() => setBlocks(DEFAULT_BLOCKS)}
              className="secondary-action"
            >
              Restaurar textos padrão
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function updateBlock(source: StoreTextBlocks, path: string[], value: unknown): StoreTextBlocks {
  const clone = deepClone(source);
  let cursor: any = clone;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    cursor[key] = cursor[key] ?? {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
  return clone;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(target: StoreTextBlocks, source: StoreTextBlocks): StoreTextBlocks {
  const output = deepClone(target);
  const merge = (base: any, patch: any) => {
    Object.entries(patch || {}).forEach(([key, val]) => {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        base[key] = base[key] || {};
        merge(base[key], val);
      } else {
        base[key] = val;
      }
    });
  };
  merge(output, source);
  return output;
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <input
        type="text"
        value={value}
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
