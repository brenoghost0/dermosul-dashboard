import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function DashboardLayout() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error("Falha ao fazer logout:", error);
    } finally {
      localStorage.removeItem("auth");
      nav("/login", { replace: true });
    }
  }

  const NavLinks = (
    <nav className="mt-4 grid gap-2">
      <Link className="px-2 py-1 rounded hover:bg-zinc-100" to="/dashboard" onClick={() => setOpen(false)}>Home</Link>
      <Link className="px-2 py-1 rounded hover:bg-zinc-100" to="/dashboard/pedidos" onClick={() => setOpen(false)}>Pedidos</Link>
      <Link className="px-2 py-1 rounded hover:bg-zinc-100" to="/dashboard/landing" onClick={() => setOpen(false)}>Landing</Link>
      <Link className="px-2 py-1 rounded hover:bg-zinc-100" to="/dashboard/configuracoes" onClick={() => setOpen(false)}>Configurações</Link>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Topbar (mobile) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200 sticky top-0 z-40">
        <button
          aria-label="Abrir menu"
          className="p-2 rounded border border-zinc-300"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
        <span />
        <button onClick={logout} className="px-3 py-1 rounded border border-emerald-700 text-emerald-700">Sair</button>
      </header>

      <div className="grid md:grid-cols-[220px_1fr]">
        {/* Sidebar desktop */}
        <aside className="hidden md:block h-[calc(100vh-0px)] sticky top-0 bg-white border-r border-zinc-200 p-5">
          <h3 className="m-0 text-emerald-900 font-bold">Dermosul</h3>
          {NavLinks}
          <button onClick={logout} className="mt-4 px-3 py-2 rounded border border-emerald-700 text-emerald-700 hover:bg-emerald-50">Sair</button>
        </aside>

        {/* Drawer mobile */}
        {open && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-white border-r border-zinc-200 p-5">
              <div className="flex items-center justify-between">
                <h3 className="m-0 text-emerald-900 font-bold">Dermosul</h3>
                <button aria-label="Fechar menu" onClick={() => setOpen(false)} className="p-2">✕</button>
              </div>
              {NavLinks}
              <button onClick={logout} className="mt-4 px-3 py-2 rounded border border-emerald-700 text-emerald-700 hover:bg-emerald-50 w-full">Sair</button>
            </aside>
          </div>
        )}

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
