import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Painel", to: "/dashboard" },
  { label: "Pedidos", to: "/dashboard/pedidos" },
  { label: "Landing pages", to: "/dashboard/landing" },
  { label: "Web Scraping", to: "/dashboard/web-scraping" },
  { label: "Storefront", to: "/dashboard/store" },
  { label: "Configurações", to: "/dashboard/configuracoes" },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch (error) {
      console.error("Falha ao fazer logout:", error);
    } finally {
      localStorage.removeItem("auth");
      navigate("/login", { replace: true });
    }
  }

  const renderNav = (afterNavigate?: () => void) => (
    <nav className="mt-6 grid gap-2 text-sm font-medium text-slate-300">
      {NAV_LINKS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => afterNavigate?.()}
          className="px-3 py-2 rounded-2xl transition hover:bg-white/8 hover:text-sky-300"
        >
          {item.label}
        </Link>
      ))}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => afterNavigate?.()}
        className="px-3 py-2 rounded-2xl border border-sky-400/40 bg-white/5 text-sky-300 transition hover:bg-white/10"
      >
        Visualizar store
      </a>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a] text-slate-100">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/60 bg-[#090e18]/85 px-4 py-3 text-sm backdrop-blur-xl md:hidden">
        <button
          aria-label="Abrir menu"
          className="rounded-2xl border border-slate-700 px-3 py-2"
          onClick={() => setMenuOpen(true)}
        >
          ☰
        </button>
        <div className="text-xs uppercase tracking-[0.5em] text-sky-300">Dermosul</div>
        <button
          onClick={logout}
          className="rounded-full border border-sky-400 px-3 py-1 font-semibold text-sky-300 hover:bg-sky-400/10"
        >
          Sair
        </button>
      </header>

      <div className="grid md:grid-cols-[260px_1fr]">
        <aside className="hidden h-[calc(100vh-0px)] flex-col gap-6 border-r border-slate-800/70 bg-[#090e18]/95 px-6 py-8 text-sm backdrop-blur-2xl md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Console</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Dermosul Commerce OS</h2>
            <p className="mt-3 text-xs text-slate-400">
              Inteligência de preços, estoque multimarcas e performance comercial em uma única plataforma.
            </p>
          </div>
          {renderNav()}
          <div className="mt-auto flex flex-col gap-3 text-xs text-slate-400">
            <div className="rounded-2xl border border-slate-800 bg-white/5 px-3 py-2">
              <p className="font-semibold text-slate-200">Status do cluster</p>
              <p className="mt-1">API online · monitoramento de ofertas ativo · insights preditivos disponíveis</p>
            </div>
            <button
              onClick={logout}
              className="rounded-full border border-slate-700 bg-white/5 px-3 py-2 font-semibold text-slate-200 transition hover:bg-white/10"
            >
              Desconectar
            </button>
          </div>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-slate-800 bg-[#0b1220]/95 px-6 py-6 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Dermosul Commerce OS</h3>
                <button aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="p-2 text-slate-300">
                  ✕
                </button>
              </div>
              {renderNav(() => setMenuOpen(false))}
              <button
                onClick={logout}
                className="mt-6 w-full rounded-full border border-slate-700 bg-white/5 px-3 py-2 font-semibold text-slate-200"
              >
                Desconectar
              </button>
            </aside>
          </div>
        )}

        <main className="px-4 py-6 md:px-10 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
