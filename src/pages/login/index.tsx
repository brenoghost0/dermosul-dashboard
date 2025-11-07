import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { http } from "../../lib/api";

const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-400/60 focus:ring-0";
const PRIMARY_BUTTON =
  "inline-flex w-full items-center justify-center rounded-full border border-sky-500/60 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60";

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation() as any;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await http<{ success: boolean; token?: string; message?: string }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pass }),
      });

      if (data.success && data.token) {
        localStorage.setItem("auth", data.token);
        nav(loc?.state?.from?.pathname || "/dashboard", { replace: true });
      } else {
        setErr(data.message || "Usuário ou senha inválidos.");
      }
    } catch (error: any) {
      console.error("Erro ao tentar fazer login:", error);
      setErr(error.message || "Erro ao conectar com o servidor de autenticação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#05080f] via-[#0b1220] to-[#04060a]">
      <div className="absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-500/30 via-cyan-400/20 to-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-10 h-64 w-64 rounded-full bg-gradient-to-br from-fuchsia-500/20 via-sky-400/10 to-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-6 h-80 w-80 rounded-full bg-gradient-to-br from-slate-500/20 via-sky-400/10 to-fuchsia-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-16">
        <div className="mb-10 flex flex-col items-center text-center">
          <span className="text-xs uppercase tracking-[0.35em] text-slate-500">Dermosul Commerce OS</span>
          <h1 className="mt-3 text-3xl font-semibold text-slate-50">Console de Operações</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Acesse o cockpit para gerenciar pedidos, campanhas e storefront com a identidade high-tech da Dermosul.
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <form
            onSubmit={submit}
            autoComplete="off"
            className="relative overflow-hidden rounded-4xl border border-slate-800 bg-[#091225]/80 px-8 py-10 shadow-[0_60px_160px_-90px_rgba(34,211,238,0.65)] backdrop-blur-2xl"
          >
            <div className="absolute -top-24 right-10 h-40 w-40 rounded-full bg-gradient-to-br from-sky-500/20 via-cyan-400/15 to-fuchsia-400/15 blur-3xl" aria-hidden />
            <div className="space-y-6">
              <header className="space-y-2">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Login seguro</p>
                <h2 className="text-2xl font-semibold text-slate-100">Entrar no console</h2>
                <p className="text-sm text-slate-500">Use suas credenciais corporativas para desbloquear o ambiente Dermosul.</p>
              </header>

              {err && (
                <div className="rounded-3xl border border-rose-500/40 bg-rose-900/30 px-4 py-3 text-sm text-rose-100">
                  {err}
                </div>
              )}

              <label className="space-y-2 text-sm">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Usuário</span>
                <input
                  name="username"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                  placeholder="seu.login"
                  className={INPUT_CLASS}
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  value={pass}
                  onChange={(event) => setPass(event.target.value)}
                  placeholder="••••••••"
                  className={INPUT_CLASS}
                />
              </label>

              <button type="submit" disabled={loading} className={PRIMARY_BUTTON}>
                {loading ? "Entrando…" : "Entrar"}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Acesso restrito à equipe Dermosul. Problemas de login? Contate o suporte interno.
          </p>
        </div>
      </div>
    </div>
  );
}
