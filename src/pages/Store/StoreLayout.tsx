import { NavLink, Outlet } from "react-router-dom";
import { StoreSettingsProvider } from "./StoreSettingsContext";
import "./store.css";

const storeSections = [
  { path: "tema", label: "Tema", description: "Personalize cores, tipografia e identidade visual da loja Dermosul." },
  { path: "banners", label: "Banners", description: "Gerencie heros, carrosséis e faixas promocionais da loja." },
  { path: "textos", label: "Textos", description: "Atualize as cópias de vitrines, rodapé e mensagens institucionais." },
  { path: "layout", label: "Layout", description: "Organize as seções da home como vitrines, depoimentos e newsletter." },
  { path: "produtos", label: "Produtos", description: "Cadastre e mantenha o catálogo de produtos Dermosul." },
  { path: "categorias", label: "Categorias", description: "Estruture categorias e defina a ordem de exibição." },
  { path: "colecoes", label: "Coleções", description: "Agrupe produtos em coleções manuais e campanhas." },
  { path: "paginas", label: "Páginas", description: "Gerencie páginas de conteúdo como Sobre, Trocas e Privacidade." },
  { path: "navegacao", label: "Navegação", description: "Configure menus do cabeçalho e rodapé da loja." },
  { path: "frete", label: "Frete", description: "Defina regras de frete, faixas de CEP e frete grátis." },
  { path: "pagamentos", label: "Pagamentos", description: "Configure provedores e métodos de pagamento." },
  { path: "seo", label: "SEO", description: "Ajuste título padrão, meta tags, OG e sitemap." },
  { path: "dominio", label: "Domínio", description: "Configure domínio principal ou subdomínios da loja." },
  { path: "integracoes", label: "Integrações", description: "Conecte pixel, Google Tag Manager, e-mail marketing e mais." },
];

function NavigationPill({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "group flex-1 min-w-[160px]",
          "rounded-3xl border px-4 py-3 text-left transition",
          isActive
            ? "border-sky-500/50 bg-sky-500/10 text-slate-50 shadow-[0_30px_100px_-70px_rgba(34,211,238,0.6)]"
            : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:text-slate-100",
        ].join(" ")
      }
      end
    >
      <span className="text-xs uppercase tracking-[0.35em] text-slate-500 group-hover:text-sky-300">{label}</span>
      <p className="mt-2 text-sm text-slate-400 group-hover:text-slate-200">{description}</p>
    </NavLink>
  );
}

function StoreSectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-4xl border border-slate-800 bg-[#091225]/70 px-6 py-10 shadow-[0_50px_150px_-100px_rgba(34,211,238,0.55)] backdrop-blur-2xl">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Em desenvolvimento</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </header>
      <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
        <p className="text-slate-300">
          Estamos finalizando os controles avançados dessa área. Em breve você poderá orquestrar toda a experiência da Store Dermosul daqui.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Enquanto isso, mantenha foco nos módulos já liberados (tema, banners, texto e catálogo) para garantir consistência da marca.
        </p>
      </div>
    </section>
  );
}

export default function StoreLayout() {
  return (
    <StoreSettingsProvider>
      <div className="store-admin min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-12 space-y-10">
          <header className="rounded-4xl border border-slate-800 bg-[#071024]/80 px-6 py-8 shadow-[0_60px_160px_-90px_rgba(34,211,238,0.6)] backdrop-blur-2xl">
            <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Storefront Dermosul</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-50 md:text-4xl">Design System Operacional da Loja</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Centralize visual, catálogo, conteúdo e integrações da Store Dermosul em um cockpit único. Cada módulo combina precisão operacional com a estética tech do Commerce OS.
            </p>
          </header>

          <nav className="rounded-4xl border border-slate-800 bg-[#091225]/70 px-5 py-6 shadow-[0_45px_140px_-100px_rgba(34,211,238,0.55)] backdrop-blur-2xl">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {storeSections.map((section) => (
                <NavigationPill
                  key={section.path}
                  to={`/dashboard/store/${section.path}`}
                  label={section.label}
                  description={section.description}
                />
              ))}
            </div>
          </nav>

          <Outlet />
        </div>
      </div>
    </StoreSettingsProvider>
  );
}

export function buildStoreSectionPlaceholder(path: string) {
  const match = storeSections.find((section) => section.path === path);
  if (!match) {
    return <StoreSectionPlaceholder title="Sessão da Store" description="Personalize os detalhes da loja Dermosul." />;
  }
  return <StoreSectionPlaceholder title={match.label} description={match.description} />;
}

export { storeSections, StoreSectionPlaceholder };
