import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const resp = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass }),
      });

      if (!resp.ok) {
        const msg = await resp.json().catch(() => ({}));
        throw new Error(msg?.message || "Falha no login");
      }

      const data = await resp.json();
      // manter compatibilidade com seu guard atual:
      localStorage.setItem("auth", data.token || "ok");
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7f5ef" }}>
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 6px 24px rgba(0,0,0,.08)",
          width: "100%",
          maxWidth: "360px",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "20px", color: "#194C33" }}>Entrar</h1>

        {err && (
          <div style={{ background: "#ffe8e8", color: "#b00020", padding: "8px 10px", borderRadius: "8px", marginBottom: "10px" }}>
            {err}
          </div>
        )}

        <label style={{ display: "block", fontSize: "14px" }}>Usuário</label>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="admin"
          style={{ width: "100%", padding: "10px", margin: "6px 0 12px", border: "1px solid #ddd", borderRadius: "8px" }}
        />

        <label style={{ display: "block", fontSize: "14px" }}>Senha</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="123"
          style={{ width: "100%", padding: "10px", margin: "6px 0 16px", border: "1px solid #ddd", borderRadius: "8px" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            background: loading ? "#6b8f7a" : "#194C33",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}