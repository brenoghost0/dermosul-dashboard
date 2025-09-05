import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { http } from "../../lib/api"; // Importar o http wrapper

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false); // Estado de carregamento
  const nav = useNavigate();
  const loc = useLocation() as any;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); // Limpa erros anteriores
    setLoading(true); // Inicia o carregamento
    try {
      const data = await http<{ success: boolean; token?: string; message?: string }>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pass }),
      });

      if (data.success && data.token) {
        localStorage.setItem("auth", data.token);
        nav(loc?.state?.from?.pathname || "/dashboard", { replace: true });
      } else {
        setErr(data.message || "Usuário ou senha inválidos."); // Exibe erro real
      }
    } catch (error: any) {
      console.error("Erro ao tentar fazer login:", error);
      setErr(error.message || "Erro ao conectar com o servidor de autenticação."); // Exibe erro real
    } finally {
      setLoading(false); // Finaliza o carregamento
    }
  }

  return (
    <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f7f5ef"}}>
      <form onSubmit={submit} autoComplete="off" style={{background:"#fff",padding:"24px",borderRadius:"12px",boxShadow:"0 6px 24px rgba(0,0,0,.08)",width:"100%",maxWidth:"360px"}}>
        <h1 style={{margin:"0 0 12px",fontSize:"20px",color:"#194C33"}}>Entrar</h1>
        {err && <div style={{background:"#ffe8e8",color:"#b00020",padding:"8px 10px",borderRadius:"8px",marginBottom:"10px"}}>{err}</div>}
        <label style={{display:"block",fontSize:"14px"}}>Usuário</label>
        <input
          name="username"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          value={user}
          onChange={e=>setUser(e.target.value)}
          placeholder="Usuário"
          style={{width:"100%",padding:"10px",margin:"6px 0 12px",border:"1px solid #ddd",borderRadius:"8px"}}
        />
        <label style={{display:"block",fontSize:"14px"}}>Senha</label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="none"
          value={pass}
          onChange={e=>setPass(e.target.value)}
          placeholder="Senha"
          style={{width:"100%",padding:"10px",margin:"6px 0 16px",border:"1px solid #ddd",borderRadius:"8px"}}
        />
        <button type="submit" disabled={loading} style={{width:"100%",padding:"10px",background:"#194C33",color:"#fff",border:"none",borderRadius:"8px",cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1}}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
