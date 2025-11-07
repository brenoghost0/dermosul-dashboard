import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "../../lib/api";
import { FieldLabel, INPUT_CLASS, PANEL_CLASS, SectionHeader, SELECT_CLASS, SUBPANEL_CLASS, TEXTAREA_CLASS } from "../Store/ui";
import type { LuckyWheelSettings, LuckyWheelPrize, LuckyWheelPrizeType } from "../../types/lucky-wheel";
import { normalizeLuckyWheelSettings } from "../../utils/luckyWheel";

type Profile = { id: string; name: string; email: string; username: string };
type Operator = {
  id: string;
  name: string;
  email: string;
  username: string;
  canGenerateLandings: boolean;
  canViewOrders: boolean;
  canManageAll: boolean;
};

type TabKey = "perfil" | "operadores" | "email" | "ia" | "roleta";

const PRIMARY_BUTTON = "inline-flex items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/20 px-6 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BUTTON = "inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60";
const DANGER_BUTTON = "inline-flex items-center justify-center rounded-full border border-rose-500/60 bg-rose-500/10 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60";

const TAG_PRIMARY = "inline-flex items-center rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-sky-200";
const TAG_MUTED = "inline-flex items-center rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400";

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  { key: "perfil", label: "Perfil", description: "Dados da conta master Dermosul" },
  { key: "operadores", label: "Operadores", description: "Equipe com acesso operacional" },
  { key: "email", label: "E-mail", description: "Configuração de disparos transacionais" },
  { key: "ia", label: "Integração IA", description: "Ative o Assistente Dermosul com OpenAI" },
  { key: "roleta", label: "Roleta da Sorte", description: "Prêmios, limites e estética da experiência gamificada" },
];

export default function Settings() {
  const [tab, setTab] = useState<TabKey>("perfil");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] pb-20">
      <div className="mx-auto max-w-6xl px-4 pt-12 space-y-10">
        <header className="rounded-4xl border border-slate-800 bg-[#071024]/80 px-6 py-8 shadow-[0_60px_160px_-90px_rgba(34,211,238,0.6)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Centro de comando</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-50 md:text-4xl">Configurações avançadas</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Ajuste credenciais, permissões e integrações essenciais para a operação Dermosul Commerce OS sem sair do cockpit administrativo.
          </p>
        </header>

        <nav className="flex flex-wrap gap-3">
          {tabs.map((item) => {
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  "w-full max-w-xs rounded-3xl border px-4 py-4 text-left transition",
                  active
                    ? "border-sky-500/60 bg-sky-500/10 text-slate-100 shadow-[0_30px_90px_-70px_rgba(34,211,238,0.55)]"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                <p className="mt-1 text-xs text-slate-500">{item.description}</p>
              </button>
            );
          })}
        </nav>

        {tab === "perfil" && <ProfileSettings />}
        {tab === "operadores" && <OperatorsSettings />}
        {tab === "email" && <EmailSettings />}
        {tab === "ia" && <AIIntegrationSettings />}
        {tab === "roleta" && <LuckyWheelSettingsTab />}
      </div>
    </div>
  );
}

function ProfileSettings() {
  const [data, setData] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/settings/profile")
      .then(({ data: profile }) => {
        setData(profile);
        setName(profile.name || "");
        setEmail(profile.email || "");
        setUsername(profile.username || "");
      })
      .catch((e) => {
        setErr(e.response?.data?.message || e.message || "Falha ao carregar perfil");
      });
  }, []);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      await apiClient.put("/settings/profile", {
        name,
        email,
        username,
        password: password || undefined,
      });
      setMsg("Perfil atualizado com sucesso");
      setPassword("");
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={PANEL_CLASS}>
      <SectionHeader
        eyebrow="Conta principal"
        title="Identidade do operador master"
        description="Atualize dados de contato e acesso da conta responsável pela operação Dermosul."
      />

      {msg && <Alert tone="success" message={msg} />}
      {err && <Alert tone="error" message={err} />}

      <form className="grid gap-4 md:grid-cols-2">
        <FieldLabel label="Nome completo">
          <input value={name} onChange={(event) => setName(event.target.value)} className={INPUT_CLASS} />
        </FieldLabel>
        <FieldLabel label="E-mail">
          <input value={email} onChange={(event) => setEmail(event.target.value)} className={INPUT_CLASS} type="email" />
        </FieldLabel>
        <FieldLabel label="Login (username)">
          <input value={username} onChange={(event) => setUsername(event.target.value)} className={INPUT_CLASS} />
        </FieldLabel>
        <FieldLabel label="Nova senha (opcional)" hint="Preencha apenas se desejar alterar a senha">
          <input value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT_CLASS} type="password" />
        </FieldLabel>
        <div className="md:col-span-2 flex justify-end">
          <button type="button" onClick={save} disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </section>
  );
}

function OperatorsSettings() {
  const [list, setList] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    canGenerateLandings: true,
    canViewOrders: true,
    canManageAll: false,
  });
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    apiClient
      .get("/settings/operators")
      .then(({ data }) => setList(data))
      .catch((e) => setErr(e.response?.data?.message || e.message || "Falha ao carregar operadores"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      await apiClient.post("/settings/operators", form);
      setForm({
        name: "",
        email: "",
        username: "",
        password: "",
        canGenerateLandings: true,
        canViewOrders: true,
        canManageAll: false,
      });
      load();
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || "Erro ao criar operador");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir operador?")) return;
    await apiClient.delete(`/settings/operators/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Equipe"
          title="Cadastrar operador de conta"
          description="Defina quem pode gerar landings, acompanhar pedidos e ajustar integrações."
        />

        {err && <Alert tone="error" message={err} />}

        <div className="grid gap-4 md:grid-cols-2">
          <FieldLabel label="Nome">
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className={INPUT_CLASS} />
          </FieldLabel>
          <FieldLabel label="E-mail">
            <input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className={INPUT_CLASS} type="email" />
          </FieldLabel>
          <FieldLabel label="Username">
            <input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} className={INPUT_CLASS} />
          </FieldLabel>
          <FieldLabel label="Senha provisória">
            <input value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} className={INPUT_CLASS} type="password" />
          </FieldLabel>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ToggleField
            label="Gerar landings"
            checked={form.canGenerateLandings}
            onChange={(value) => setForm((prev) => ({ ...prev, canGenerateLandings: value }))}
            description="Permite criar e editar landing pages."
          />
          <ToggleField
            label="Ver pedidos"
            checked={form.canViewOrders}
            onChange={(value) => setForm((prev) => ({ ...prev, canViewOrders: value }))}
            description="Acesso à área de pedidos e exportações."
          />
          <ToggleField
            label="Administrador"
            checked={form.canManageAll}
            onChange={(value) => setForm((prev) => ({ ...prev, canManageAll: value }))}
            description="Controle total sobre todas as configurações."
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={create} disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? "Salvando…" : "Adicionar operador"}
          </button>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Time ativo"
          title="Operadores cadastrados"
          description="Gerencie quem está conectado à operação Dermosul."
        />

        {loading ? (
          <p className="text-sm text-slate-500">Carregando operadores…</p>
        ) : list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-10 text-center text-sm text-slate-400">
            Nenhum operador cadastrado até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-[0.25em] text-slate-500">
                  <th className="px-4 py-3">Operador</th>
                  <th className="px-4 py-3">Permissões</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((operator) => (
                  <tr key={operator.id} className="border-b border-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-100">{operator.name}</div>
                      <div className="text-xs text-slate-500">{operator.email}</div>
                      <div className="text-xs text-slate-600">@{operator.username}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        {operator.canGenerateLandings && <span className={TAG_PRIMARY}>Landings</span>}
                        {operator.canViewOrders && <span className={TAG_PRIMARY}>Pedidos</span>}
                        {operator.canManageAll && <span className={TAG_PRIMARY}>Admin</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => remove(operator.id)} className={DANGER_BUTTON}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LuckyWheelSettingsTab() {
  const [settings, setSettings] = useState<LuckyWheelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const probabilityTotal = useMemo(() => {
    if (!settings) return 0;
    return settings.prizes.reduce((sum, prize) => sum + (prize.enabled === false ? 0 : Number(prize.probability || 0)), 0);
  }, [settings]);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.get<LuckyWheelSettings>("/admin/lucky-wheel");
      setSettings(normalizeLuckyWheelSettings(data));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao carregar a roleta.");
    } finally {
      setLoading(false);
    }
  }

  const updateSettings = (mutator: (draft: LuckyWheelSettings) => LuckyWheelSettings) => {
    setSettings((current) => {
      if (!current) return current;
      const draft = JSON.parse(JSON.stringify(current)) as LuckyWheelSettings;
      const next = mutator(draft);
      return normalizeLuckyWheelSettings(next);
    });
    setSuccess(null);
  };

  const handleGeneralUpdate = (patch: Partial<LuckyWheelSettings>) => {
    updateSettings((draft) => ({ ...draft, ...patch }));
  };

  const toggleShowOn = (page: "cart" | "checkout" | "post_purchase") => {
    updateSettings((draft) => {
      const pages = new Set(draft.displayRules.showOn);
      if (pages.has(page)) {
        if (pages.size > 1) {
          pages.delete(page);
        }
      } else {
        pages.add(page);
      }
      draft.displayRules.showOn = Array.from(pages) as Array<"cart" | "checkout" | "post_purchase">;
      return draft;
    });
  };

  const handleDisplayRuleUpdate = (patch: Partial<LuckyWheelSettings["displayRules"]>) => {
    updateSettings((draft) => ({
      ...draft,
      displayRules: {
        ...draft.displayRules,
        ...patch,
      },
    }));
  };

  const handleLimitsUpdate = (patch: Partial<LuckyWheelSettings["limits"]>) => {
    updateSettings((draft) => ({
      ...draft,
      limits: {
        ...draft.limits,
        ...patch,
      },
    }));
  };

  const handleMessagesUpdate = (patch: Partial<LuckyWheelSettings["messages"]>) => {
    updateSettings((draft) => ({
      ...draft,
      messages: {
        ...draft.messages,
        ...patch,
      },
    }));
  };

  const handleDesignUpdate = (patch: Partial<LuckyWheelSettings["design"]>) => {
    updateSettings((draft) => ({
      ...draft,
      design: {
        ...draft.design,
        ...patch,
        sound: {
          ...draft.design.sound,
          ...(patch.sound ?? {}),
        },
      },
    }));
  };

  const handleSoundUpdate = (patch: Partial<NonNullable<LuckyWheelSettings["design"]["sound"]>>) => {
    updateSettings((draft) => ({
      ...draft,
      design: {
        ...draft.design,
        sound: {
          enabled: patch.enabled ?? draft.design.sound?.enabled ?? false,
          spin: patch.spin ?? draft.design.sound?.spin ?? null,
          win: patch.win ?? draft.design.sound?.win ?? null,
          lose: patch.lose ?? draft.design.sound?.lose ?? null,
        },
      },
    }));
  };

  const handlePrizeChange = (id: string, patch: Partial<LuckyWheelPrize>) => {
    updateSettings((draft) => ({
      ...draft,
      prizes: draft.prizes.map((prize) => (prize.id === id ? { ...prize, ...patch } : prize)),
    }));
  };

  const handlePrizeLimitChange = (id: string, patch: Partial<NonNullable<LuckyWheelPrize["limit"]>>) => {
    updateSettings((draft) => ({
      ...draft,
      prizes: draft.prizes.map((prize) =>
        prize.id === id
          ? {
              ...prize,
              limit: {
                daily: prize.limit?.daily ?? null,
                monthly: prize.limit?.monthly ?? null,
                total: prize.limit?.total ?? null,
                ...patch,
              },
            }
          : prize
      ),
    }));
  };

  const handlePrizeCouponChange = (id: string, patch: Partial<NonNullable<LuckyWheelPrize["coupon"]>> | null) => {
    updateSettings((draft) => ({
      ...draft,
      prizes: draft.prizes.map((prize) => {
        if (prize.id !== id) return prize;
        if (patch === null) {
          return { ...prize, coupon: null };
        }
        const baseCoupon = prize.coupon ?? {
          type: prize.type === "AMOUNT_DISCOUNT" ? "AMOUNT" : "PERCENT",
          value: prize.type === "AMOUNT_DISCOUNT" ? 5000 : 10,
          autoApply: true,
          durationMinutes: 1440,
        };
        return {
          ...prize,
          coupon: {
            ...baseCoupon,
            ...patch,
          },
        };
      }),
    }));
  };

  const handlePrizeTypeChange = (id: string, type: LuckyWheelPrizeType) => {
    updateSettings((draft) => ({
      ...draft,
      prizes: draft.prizes.map((prize) => {
        if (prize.id !== id) return prize;
        const next: LuckyWheelPrize = {
          ...prize,
          type,
        };
        if (type === "PERCENT_DISCOUNT") {
          next.coupon = {
            type: "PERCENT",
            value: prize.coupon?.type === "PERCENT" ? prize.coupon.value : 10,
            autoApply: prize.coupon?.autoApply ?? true,
            durationMinutes: prize.coupon?.durationMinutes ?? 1440,
          };
          next.freeShipping = false;
          next.freeOrder = false;
        } else if (type === "AMOUNT_DISCOUNT") {
          next.coupon = {
            type: "AMOUNT",
            value: prize.coupon?.type === "AMOUNT" ? prize.coupon.value : 5000,
            autoApply: prize.coupon?.autoApply ?? true,
            durationMinutes: prize.coupon?.durationMinutes ?? 1440,
          };
          next.freeShipping = false;
          next.freeOrder = false;
        } else if (type === "FREE_SHIPPING") {
          next.coupon = null;
          next.freeShipping = true;
          next.freeOrder = false;
        } else if (type === "FREE_ORDER") {
          next.coupon = null;
          next.freeShipping = false;
          next.freeOrder = true;
        } else if (type === "MESSAGE") {
          next.coupon = null;
          next.freeShipping = false;
          next.freeOrder = false;
        }
        return next;
      }),
    }));
  };

  const addPrize = () => {
    updateSettings((draft) => ({
      ...draft,
      prizes: [
        ...draft.prizes,
        {
          id: `prize_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          label: "Novo prêmio Dermosul",
          description: "",
          type: "MESSAGE",
          probability: 10,
          enabled: true,
          message: draft.messages.almostThere,
          coupon: null,
          freeShipping: false,
          freeOrder: false,
          sliceColor: "#F4ECFF",
          textColor: "#4A3AA1",
          icon: "sparkles",
          limit: { daily: null, monthly: null, total: null },
        },
      ],
    }));
  };

  const removePrize = (id: string) => {
    updateSettings((draft) => ({
      ...draft,
      prizes: draft.prizes.filter((prize) => prize.id !== id),
    }));
  };

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data } = await apiClient.put<LuckyWheelSettings>("/admin/lucky-wheel", settings);
      setSettings(data);
      setSuccess("Roleta atualizada com sucesso.");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao salvar a roleta.");
    } finally {
      setSaving(false);
    }
  }

  const parseNumber = (value: string): number | null => {
    if (value === "" || value === null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  };

  if (loading) {
    return (
      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Roleta da Sorte"
          title="Experiência gamificada Dermosul"
          description="Carregando configurações da roleta personalizada..."
        />
        <p className="text-sm text-slate-400">Aguarde um instante enquanto buscamos as preferências salvas.</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Roleta da Sorte"
          title="Experiência gamificada Dermosul"
          description="Não foi possível carregar a configuração atual."
        />
        {error ? <Alert tone="error" message={error} /> : <p className="text-sm text-slate-400">Tente recarregar a página para tentar novamente.</p>}
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={loadSettings} className={SECONDARY_BUTTON}>
            Recarregar
          </button>
        </div>
      </section>
    );
  }

  const sessionPages = settings.displayRules.showOn;
  const frequency = settings.displayRules.frequency;

  const probabilityBadgeTone = probabilityTotal === 100 ? "text-emerald-300" : probabilityTotal > 0 ? "text-amber-300" : "text-rose-300";

  return (
    <div className="space-y-8">
      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Experiência surpresa"
          title="Configura a Roleta da Sorte Dermosul"
          description="Delimite onde a roleta aparece, personalize o tom de voz e mantenha o controle dos limites de prêmios."
        />

        {success && <Alert tone="success" message={success} />}
        {error && <Alert tone="error" message={error} />}

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/40 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-slate-100">Roleta ativa</p>
                <p className="text-xs text-slate-500">Quando desativada, o componente não aparece na loja.</p>
              </div>
              <button
                type="button"
                onClick={() => handleGeneralUpdate({ enabled: !settings.enabled })}
                className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                  settings.enabled ? "border-sky-500/60 bg-sky-500/40" : "border-slate-700 bg-slate-900"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${settings.enabled ? "translate-x-7" : "translate-x-1"}`}
                />
              </button>
            </div>

            <FieldLabel label="Título da experiência">
              <input
                value={settings.headline}
                onChange={(event) => handleGeneralUpdate({ headline: event.target.value })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Subtítulo">
              <input
                value={settings.subheadline ?? ""}
                onChange={(event) => handleGeneralUpdate({ subheadline: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Uma frase elegante que contextualiza a roleta"
              />
            </FieldLabel>
            <FieldLabel label="Texto descritivo">
              <textarea
                value={settings.description ?? ""}
                onChange={(event) => handleGeneralUpdate({ description: event.target.value })}
                className={TEXTAREA_CLASS}
                placeholder="Conte como a roleta foi pensada como um gesto de carinho Dermosul"
              />
            </FieldLabel>
          </div>

          <div className="space-y-4">
            <FieldLabel label="Call-to-action (texto superior)">
              <input
                value={settings.ctaLabel}
                onChange={(event) => handleGeneralUpdate({ ctaLabel: event.target.value })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Texto do botão">
              <input
                value={settings.buttonLabel}
                onChange={(event) => handleGeneralUpdate({ buttonLabel: event.target.value })}
                className={INPUT_CLASS}
              />
            </FieldLabel>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/40 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Exibir em</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { value: "cart", label: "Carrinho" },
                  { value: "checkout", label: "Checkout" },
                  { value: "post_purchase", label: "Pós-compra" },
                ].map((option) => {
                  const active = sessionPages.includes(option.value as typeof sessionPages[number]);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleShowOn(option.value as "cart" | "checkout" | "post_purchase")}
                      className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                        active
                          ? "border border-sky-500/50 bg-sky-500/20 text-sky-100"
                          : "border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <FieldLabel label="Frequência de exibição">
              <select
                value={frequency}
                onChange={(event) => handleDisplayRuleUpdate({ frequency: event.target.value as LuckyWheelSettings["displayRules"]["frequency"] })}
                className={SELECT_CLASS}
              >
                <option value="once_per_session">Uma vez por sessão</option>
                <option value="once_per_customer">Uma vez por cliente</option>
                <option value="always">Permitir giros mais vezes</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Exibir novamente após (horas)" hint="Deixe vazio para não considerar janela de tempo">
              <input
                type="number"
                min={0}
                value={settings.displayRules.showAgainAfterHours ?? ""}
                onChange={(event) =>
                  handleDisplayRuleUpdate({
                    showAgainAfterHours: parseNumber(event.target.value),
                  })
                }
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Máximo de giros por sessão" hint="Deixe vazio para usar o comportamento padrão da frequência">
              <input
                type="number"
                min={0}
                value={settings.displayRules.perSessionMaxSpins ?? ""}
                onChange={(event) =>
                  handleDisplayRuleUpdate({
                    perSessionMaxSpins: parseNumber(event.target.value),
                  })
                }
                className={INPUT_CLASS}
              />
            </FieldLabel>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <FieldLabel label="Limite global diário" hint="Número máximo de prêmios liberados por dia (em todos os tipos).">
            <input
              type="number"
              min={0}
              value={settings.limits.globalDaily ?? ""}
              onChange={(event) => handleLimitsUpdate({ globalDaily: parseNumber(event.target.value) })}
              className={INPUT_CLASS}
            />
          </FieldLabel>
          <FieldLabel label="Limite global mensal" hint="Controle o total de premiações em cada mês.">
            <input
              type="number"
              min={0}
              value={settings.limits.globalMonthly ?? ""}
              onChange={(event) => handleLimitsUpdate({ globalMonthly: parseNumber(event.target.value) })}
              className={INPUT_CLASS}
            />
          </FieldLabel>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Prêmios e probabilidades"
          title="Curadoria de presentes Dermosul"
          description="Defina os prêmios, probabilidades e limites individuais para equilibrar desejo e sustentabilidade."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${probabilityBadgeTone}`}>
            Soma das probabilidades ativas: <span className="font-semibold">{probabilityTotal}%</span>
          </p>
          <button type="button" onClick={addPrize} className={SECONDARY_BUTTON}>
            Adicionar prêmio
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {settings.prizes.map((prize, index) => (
            <LuckyWheelPrizeCard
              key={prize.id}
              prize={prize}
              order={index + 1}
              disableRemove={settings.prizes.length <= 2}
              onChange={(patch) => handlePrizeChange(prize.id, patch)}
              onRemove={() => removePrize(prize.id)}
              onTypeChange={(type) => handlePrizeTypeChange(prize.id, type)}
              onLimitChange={(patch) => handlePrizeLimitChange(prize.id, patch)}
              onCouponChange={(patch) => handlePrizeCouponChange(prize.id, patch)}
            />
          ))}
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <SectionHeader
          eyebrow="Mensagem e estética"
          title="Identidade que abraça o cliente"
          description="Ajuste cores, tipografia e voz pra manter a experiência leve, afetiva e com o jeitinho Dermosul."
        />

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <FieldLabel label="Tipografia principal">
              <input
                value={settings.design.fontFamily ?? ""}
                onChange={(event) => handleDesignUpdate({ fontFamily: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Poppins, Outfit, sans-serif"
              />
            </FieldLabel>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField
                label="Cor da borda"
                value={settings.design.borderColor ?? "#BFA8FF"}
                onChange={(value) => handleDesignUpdate({ borderColor: value })}
              />
              <ColorField
                label="Cor de destaque"
                value={settings.design.highlightColor ?? "#F5E9FF"}
                onChange={(value) => handleDesignUpdate({ highlightColor: value })}
              />
              <ColorField
                label="Cor do ponteiro"
                value={settings.design.pointerColor ?? "#D9B76E"}
                onChange={(value) => handleDesignUpdate({ pointerColor: value })}
              />
              <ColorField
                label="Cor do botão"
                value={settings.design.buttonColor ?? "#6B3DE4"}
                onChange={(value) => handleDesignUpdate({ buttonColor: value })}
              />
            </div>
            <FieldLabel label="Logo central (URL)" hint="Use uma imagem PNG transparente para o centro da roleta.">
              <input
                value={settings.design.logoUrl ?? ""}
                onChange={(event) => handleDesignUpdate({ logoUrl: event.target.value || null })}
                className={INPUT_CLASS}
                placeholder="https://..."
              />
            </FieldLabel>
            <FieldLabel label="Opacidade do overlay" hint="Entre 0 e 1">
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                value={settings.design.overlayOpacity ?? 0.72}
                onChange={(event) => handleDesignUpdate({ overlayOpacity: Number(event.target.value) })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Raio do blur de fundo (px)">
              <input
                type="number"
                min={0}
                value={settings.design.blurRadius ?? 22}
                onChange={(event) => handleDesignUpdate({ blurRadius: Number(event.target.value) })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
          </div>
          <div className={`${SUBPANEL_CLASS} space-y-4`}>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Mensagens padrão</p>
            <FieldLabel label="Mensagem padrão de vitória">
              <textarea
                value={settings.messages.winDefault}
                onChange={(event) => handleMessagesUpdate({ winDefault: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Mensagem de não premiado">
              <textarea
                value={settings.messages.loseDefault}
                onChange={(event) => handleMessagesUpdate({ loseDefault: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Mensagem de quase lá">
              <textarea
                value={settings.messages.almostThere}
                onChange={(event) => handleMessagesUpdate({ almostThere: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Mensagem quando o cliente já participou">
              <textarea
                value={settings.messages.alreadyPlayed}
                onChange={(event) => handleMessagesUpdate({ alreadyPlayed: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Mensagem quando limites são atingidos">
              <textarea
                value={settings.messages.blocked}
                onChange={(event) => handleMessagesUpdate({ blocked: event.target.value })}
                className={TEXTAREA_CLASS}
              />
            </FieldLabel>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.design.sound?.enabled ?? false}
                  onChange={(event) => handleSoundUpdate({ enabled: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30"
                />
                Habilitar efeitos sonoros (spin e vitória)
              </label>
              {settings.design.sound?.enabled && (
                <div className="mt-3 space-y-3">
                  <FieldLabel label="Som ao girar (URL opcional)">
                    <input
                      value={settings.design.sound?.spin ?? ""}
                      onChange={(event) => handleSoundUpdate({ spin: event.target.value || null })}
                      className={INPUT_CLASS}
                    />
                  </FieldLabel>
                  <FieldLabel label="Som de vitória (URL opcional)">
                    <input
                      value={settings.design.sound?.win ?? ""}
                      onChange={(event) => handleSoundUpdate({ win: event.target.value || null })}
                      className={INPUT_CLASS}
                    />
                  </FieldLabel>
                  <FieldLabel label="Som neutro (URL opcional)">
                    <input
                      value={settings.design.sound?.lose ?? ""}
                      onChange={(event) => handleSoundUpdate({ lose: event.target.value || null })}
                      className={INPUT_CLASS}
                    />
                  </FieldLabel>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={loadSettings} className={SECONDARY_BUTTON} disabled={saving}>
          Recarregar
        </button>
        <button type="button" onClick={handleSave} className={PRIMARY_BUTTON} disabled={saving}>
          {saving ? "Salvando..." : "Salvar roleta"}
        </button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (next: string) => void }) {
  return (
    <FieldLabel label={label}>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || "#ffffff"}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded-2xl border border-slate-700 bg-slate-900/60"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT_CLASS} flex-1`}
        />
      </div>
    </FieldLabel>
  );
}

function LuckyWheelPrizeCard({
  prize,
  order,
  disableRemove,
  onChange,
  onRemove,
  onTypeChange,
  onLimitChange,
  onCouponChange,
}: {
  prize: LuckyWheelPrize;
  order: number;
  disableRemove: boolean;
  onChange: (patch: Partial<LuckyWheelPrize>) => void;
  onRemove: () => void;
  onTypeChange: (type: LuckyWheelPrizeType) => void;
  onLimitChange: (patch: Partial<NonNullable<LuckyWheelPrize["limit"]>>) => void;
  onCouponChange: (patch: Partial<NonNullable<LuckyWheelPrize["coupon"]>> | null) => void;
}) {
  const isDiscount = prize.type === "PERCENT_DISCOUNT" || prize.type === "AMOUNT_DISCOUNT";
  const isMessage = prize.type === "MESSAGE";
  const prizeLimit = prize.limit ?? { daily: null, monthly: null, total: null };
  const coupon = prize.coupon ?? null;

  return (
    <div className={`${SUBPANEL_CLASS} space-y-4 border-slate-800/80`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Prêmio {order.toString().padStart(2, "0")}</p>
          <h3 className="text-lg font-semibold text-slate-100">{prize.label || "Prêmio sem título"}</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ enabled: !(prize.enabled === false) })}
            className={`rounded-full px-4 py-1 text-xs font-semibold transition ${
              prize.enabled === false
                ? "border border-slate-700 bg-slate-900/40 text-slate-400"
                : "border border-sky-500/50 bg-sky-500/20 text-sky-100"
            }`}
          >
            {prize.enabled === false ? "Inativo" : "Ativo"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disableRemove}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              disableRemove
                ? "cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500"
                : "border-rose-500/60 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            }`}
          >
            Remover
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldLabel label="Nome do prêmio">
          <input
            value={prize.label}
            onChange={(event) => onChange({ label: event.target.value })}
            className={INPUT_CLASS}
          />
        </FieldLabel>
        <FieldLabel label="Probabilidade (%)" hint="Considere a soma geral ser 100%">
          <input
            type="number"
            min={0}
            value={prize.probability}
            onChange={(event) => onChange({ probability: Number(event.target.value) })}
            className={INPUT_CLASS}
          />
        </FieldLabel>
        <FieldLabel label="Tipo de recompensa">
          <select
            value={prize.type}
            onChange={(event) => onTypeChange(event.target.value as LuckyWheelPrizeType)}
            className={SELECT_CLASS}
          >
            <option value="PERCENT_DISCOUNT">Cupom percentual</option>
            <option value="AMOUNT_DISCOUNT">Cupom valor fixo</option>
            <option value="FREE_SHIPPING">Frete grátis</option>
            <option value="FREE_ORDER">Pedido 100% grátis</option>
            <option value="MESSAGE">Mensagem carinhosa</option>
            <option value="CUSTOM">Customizado</option>
          </select>
        </FieldLabel>
        <ColorField label="Cor do setor" value={prize.sliceColor ?? "#F4ECFF"} onChange={(value) => onChange({ sliceColor: value })} />
        <ColorField label="Cor do texto" value={prize.textColor ?? "#4A3AA1"} onChange={(value) => onChange({ textColor: value })} />
        <FieldLabel label="Ícone (nome opcional)">
          <input
            value={prize.icon ?? ""}
            onChange={(event) => onChange({ icon: event.target.value || null })}
            className={INPUT_CLASS}
            placeholder="sparkles, gift, crown..."
          />
        </FieldLabel>
      </div>

      {isDiscount && (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Cupom</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <FieldLabel label={prize.type === "PERCENT_DISCOUNT" ? "Percentual (%)" : "Valor em centavos"}>
              <input
                type="number"
                min={0}
                value={coupon?.value ?? ""}
                onChange={(event) => onCouponChange({ value: Number(event.target.value) })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Duração (minutos)" hint="Deixe vazio para não expirar">
              <input
                type="number"
                min={0}
                value={coupon?.durationMinutes ?? ""}
                onChange={(event) => onCouponChange({ durationMinutes: parseNumberField(event.target.value) })}
                className={INPUT_CLASS}
              />
            </FieldLabel>
            <FieldLabel label="Aplicar automaticamente">
              <select
                value={coupon?.autoApply ? "yes" : "no"}
                onChange={(event) => onCouponChange({ autoApply: event.target.value === "yes" })}
                className={SELECT_CLASS}
              >
                <option value="yes">Sim</option>
                <option value="no">Não</option>
              </select>
            </FieldLabel>
          </div>
        </div>
      )}

      {isMessage && (
        <FieldLabel label="Mensagem exibida">
          <textarea
            value={prize.message ?? ""}
            onChange={(event) => onChange({ message: event.target.value })}
            className={TEXTAREA_CLASS}
          />
        </FieldLabel>
      )}

      <FieldLabel label="Mensagem de destaque (após brilhar)">
        <textarea
          value={prize.resultMessage ?? ""}
          onChange={(event) => onChange({ resultMessage: event.target.value })}
          className={TEXTAREA_CLASS}
        />
      </FieldLabel>

      <div className="grid gap-4 md:grid-cols-3">
        <FieldLabel label="Limite diário">
          <input
            type="number"
            min={0}
            value={prizeLimit.daily ?? ""}
            onChange={(event) => onLimitChange({ daily: parseNumberField(event.target.value) })}
            className={INPUT_CLASS}
          />
        </FieldLabel>
        <FieldLabel label="Limite mensal">
          <input
            type="number"
            min={0}
            value={prizeLimit.monthly ?? ""}
            onChange={(event) => onLimitChange({ monthly: parseNumberField(event.target.value) })}
            className={INPUT_CLASS}
          />
        </FieldLabel>
        <FieldLabel label="Limite total">
          <input
            type="number"
            min={0}
            value={prizeLimit.total ?? ""}
            onChange={(event) => onLimitChange({ total: parseNumberField(event.target.value) })}
            className={INPUT_CLASS}
          />
        </FieldLabel>
      </div>

      {prize.type === "FREE_SHIPPING" && (
        <p className="text-xs text-slate-500">
          Este prêmio sinaliza frete grátis. O backend registra a condição para aplicação na jornada do cliente.
        </p>
      )}
      {prize.type === "FREE_ORDER" && (
        <p className="text-xs text-slate-500">Pedido integralmente gratuito — use com limites bem definidos.</p>
      )}
    </div>
  );
}

const parseNumberField = (value: string): number | null => {
  if (value === "" || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
};

function EmailSettings() {
  const [cfg, setCfg] = useState<{
    host: string;
    port: number;
    user: string;
    from: string;
    replyTo: string;
    configured: boolean;
  } | null>(null);
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<"pago" | "pendente" | "enviado">("pago");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient
      .get("/settings/email")
      .then((r) => setCfg(r.data))
      .catch((e) => setErr(e.response?.data?.message || e.message || "Erro ao carregar configuração de e-mail"));
  }, []);

  async function sendTest() {
    setSending(true);
    setMsg(null);
    setErr(null);
    try {
      await apiClient.post("/settings/email/test", { to, kind });
      setMsg("E-mail de teste enviado. Verifique sua caixa de entrada.");
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || "Falha ao enviar e-mail de teste");
    } finally {
      setSending(false);
    }
  }

  const statusLabel = useMemo(() => (cfg?.configured ? "Configurado" : "Não configurado"), [cfg]);

  return (
    <section className={PANEL_CLASS}>
      <SectionHeader
        eyebrow="Transacionais"
        title="Infraestrutura de e-mail"
        description="Configure SMTP e valide disparos críticos como confirmação de pagamento e envio."
      />

      {msg && <Alert tone="success" message={msg} />}
      {err && <Alert tone="error" message={err} />}

      <div className="grid gap-3 rounded-3xl border border-slate-800 bg-slate-900/50 px-5 py-5 text-sm text-slate-400">
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500">Remetente:</span>
          <span className="text-slate-200">{cfg?.from || "—"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500">Servidor:</span>
          <span className="text-slate-200">{cfg ? `${cfg.host || "—"}:${cfg.port || 0}` : "—"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500">Usuário:</span>
          <span className="text-slate-200">{cfg?.user || "—"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500">Reply-to:</span>
          <span className="text-slate-200">{cfg?.replyTo || "—"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500">Status:</span>
          <span className={cfg?.configured ? TAG_PRIMARY : TAG_MUTED}>{statusLabel}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
        <FieldLabel label="Enviar e-mail de teste">
          <input value={to} onChange={(event) => setTo(event.target.value)} className={INPUT_CLASS} type="email" placeholder="destinatario@exemplo.com" />
        </FieldLabel>
        <FieldLabel label="Template">
          <select value={kind} onChange={(event) => setKind(event.target.value as any)} className={SELECT_CLASS}>
            <option value="pago">Pagamento aprovado</option>
            <option value="pendente">Pedido pendente</option>
            <option value="enviado">Pedido enviado</option>
          </select>
        </FieldLabel>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={sendTest} disabled={sending || !to} className={PRIMARY_BUTTON}>
          {sending ? "Enviando teste…" : "Enviar e-mail de teste"}
        </button>
        <p className="text-xs text-slate-500 max-w-md">
          Para alterar servidor ou credenciais SMTP, edite as variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` no `.env` e faça o deploy.
        </p>
      </div>
    </section>
  );
}

function AIIntegrationSettings() {
  const [configured, setConfigured] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get("/admin/ai-integration")
      .then(({ data }) => {
        if (mounted) {
          setConfigured(Boolean(data?.configured));
        }
      })
      .catch(() => {
        if (mounted) {
          setFeedback({ tone: "error", message: "Não foi possível verificar o status da integração." });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await apiClient.post("/admin/ai-integration", { apiKey: apiKey.trim() });
      setConfigured(true);
      setApiKey("");
      setFeedback({ tone: "success", message: "Chave OpenAI salva com sucesso. O Assistente Dermosul está ativo." });
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Erro ao salvar a chave.";
      setFeedback({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={PANEL_CLASS}>
      <SectionHeader
        eyebrow="IA conversacional"
        title="Assistente Dermosul"
        description="Cadastre sua chave OpenAI para ativar respostas automáticas usando os dados da loja."
      />

      {feedback && <Alert tone={feedback.tone} message={feedback.message} />}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-200">
            Chave secreta
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className={`${INPUT_CLASS} mt-2`}
              required
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            A chave é armazenada cifrada. Utilize modelos GPT-4 ou GPT-4.1 para melhores respostas.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="submit" disabled={saving || !apiKey.trim()} className={PRIMARY_BUTTON}>
            {saving ? "Salvando…" : configured ? "Atualizar chave" : "Ativar assistente"}
          </button>
          <span className="text-xs text-slate-400">
            Status:{" "}
            <span className={configured ? "text-emerald-400" : "text-rose-400"}>
              {loading ? "verificando…" : configured ? "Assistente ativo" : "Assistente desativado"}
            </span>
          </span>
        </div>
      </form>
    </section>
  );
}

function ToggleField({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-400">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500/30"
          />
          Ativo
        </label>
      </div>
    </div>
  );
}

function Alert({ tone, message }: { tone: "success" | "error"; message: string }) {
  const palette = tone === "success"
    ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-100"
    : "border-rose-500/40 bg-rose-900/30 text-rose-100";
  return <div className={`rounded-3xl border px-4 py-3 text-sm ${palette}`}>{message}</div>;
}
