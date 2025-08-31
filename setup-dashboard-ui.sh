#!/usr/bin/env bash
set -euo pipefail

echo "▶️ Criando pastas…"
mkdir -p src/components src/pages

echo "▶️ Escrevendo src/components/Sidebar.tsx…"
cat > src/components/Sidebar.tsx <<'TSX'
import { NavLink, useNavigate } from "react-router-dom";

export default function Sidebar() {
  const nav = useNavigate();
  const linkBase: React.CSSProperties = { display:"block", padding:"10px 12px", borderRadius:10 };
  const active = { background:"#e1efe7", fontWeight:700 as const };

  return (
    <aside style={{width:240, padding:14, borderRight:"1px solid #e6e2d9", position:"sticky", top:0, height:"100vh", background:"#f7f5ef"}}>
      <div style={{fontSize:22, fontWeight:800, marginBottom:8}}>Dermosul</div>
      <div style={{fontSize:12, opacity:.7, marginBottom:12}}>Dashboard</div>

      <nav style={{display:"grid", gap:8}}>
        <NavLink to="/dashboard" end style={({isActive}) => ({...linkBase, ...(isActive?active:{})})}>Visão geral</NavLink>
        <NavLink to="/dashboard/pedidos" style={({isActive}) => ({...linkBase, ...(isActive?active:{})})}>Pedidos</NavLink>
        <NavLink to="/dashboard/landing" style={({isActive}) => ({...linkBase, ...(isActive?active:{})})}>Landing Page</NavLink>
        <NavLink to="/dashboard/infos" style={({isActive}) => ({...linkBase, ...(isActive?active:{})})}>Infos</NavLink>
      </nav>

      <div style={{marginTop:16}}>
        <button
          onClick={() => { localStorage.removeItem("auth"); nav("/login"); }}
          style={{width:"100%", background:"#0b3d2e", color:"#fff", border:"none", borderRadius:10, padding:10, cursor:"pointer"}}
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
TSX

echo "▶️ Escrevendo src/components/Topbar.tsx…"
cat > src/components/Topbar.tsx <<'TSX'
export default function Topbar() {
  return (
    <header style={{height:60, borderBottom:"1px solid #e6e2d9", display:"flex", alignItems:"center", padding:"0 16px", background:"#ffffffaa", backdropFilter:"blur(6px)"}}>
      <div style={{fontSize:14, opacity:.75}}>Bem-vindo ao painel Dermosul</div>
    </header>
  );
}
TSX

echo "▶️ Escrevendo páginas internas…"
cat > src/pages/Home.tsx <<'TSX'
function Card({title, value, hint}:{title:string, value:string|number, hint?:string}) {
  return (
    <div style={{background:"#fff", border:"1px solid #e6e2d9", borderRadius:14, padding:16, boxShadow:"0 2px 12px rgba(0,0,0,.04)"}}>
      <div style={{fontSize:13, opacity:.7}}>{title}</div>
      <div style={{fontSize:28, fontWeight:800, marginTop:4}}>{value}</div>
      {hint && <div style={{fontSize:12, opacity:.65, marginTop:4}}>{hint}</div>}
    </div>
  );
}
export default function Home(){
  return (
    <div style={{display:"grid", gap:16, padding:16}}>
      <div style={{display:"grid", gap:16, gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
        <Card title="Pedidos hoje" value={8} hint="Atualizado agora" />
        <Card title="Faturamento" value={"R$ 3.742,00"} hint="Bruto do dia" />
        <Card title="Novas infos" value={21} hint="Últimas 24h" />
      </div>
      <div style={{background:"#fff", border:"1px solid #e6e2d9", borderRadius:14, padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>Atividades recentes</div>
        <ul style={{margin:0, paddingLeft:18}}>
          <li>Pedido #1023 marcado como Enviado</li>
          <li>Landing de “Sérum Facial A” gerada</li>
          <li>3 novas infos adicionadas</li>
        </ul>
      </div>
    </div>
  );
}
TSX

cat > src/pages/Pedidos.tsx <<'TSX'
export default function Pedidos(){
  return (
    <div style={{padding:16}}>
      <div style={{background:"#fff", border:"1px solid #e6e2d9", borderRadius:14, padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>Pedidos</div>
        <div style={{opacity:.7}}>Abas: Todos · Em aberto · Em análise · Enviados · Concluídos</div>
      </div>
    </div>
  );
}
TSX

cat > src/pages/Landing.tsx <<'TSX'
export default function Landing(){
  return (
    <div style={{padding:16}}>
      <div style={{background:"#fff", border:"1px solid #e6e2d9", borderRadius:14, padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>Gerar Landing Page</div>
        <div style={{opacity:.7}}>Formulário de cadastro do produto (em breve)</div>
      </div>
    </div>
  );
}
TSX

cat > src/pages/Infos.tsx <<'TSX'
export default function Infos(){
  return (
    <div style={{padding:16}}>
      <div style={{background:"#fff", border:"1px solid #e6e2d9", borderRadius:14, padding:16}}>
        <div style={{fontWeight:700, marginBottom:8}}>Infos</div>
        <div style={{opacity:.7}}>Tabela de informações (em breve)</div>
      </div>
    </div>
  );
}
TSX

echo "▶️ Escrevendo src/pages/Dashboard.tsx (layout + rotas filhas)…"
cat > src/pages/Dashboard.tsx <<'TSX'
import { Routes, Route } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Home from "./Home";
import Pedidos from "./Pedidos";
import Landing from "./Landing";
import Infos from "./Infos";

export default function Dashboard() {
  return (
    <div style={{minHeight:"100vh", background:"#f7f5ef", color:"#0b3d2e", display:"flex"}}>
      <Sidebar />
      <main style={{flex:1, minWidth:0}}>
        <Topbar />
        <Routes>
          <Route index element={<Home />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="landing" element={<Landing />} />
          <Route path="infos" element={<Infos />} />
        </Routes>
      </main>
    </div>
  );
}
TSX

echo "▶️ Atualizando src/App.tsx (proteção + rotas aninhadas)…"
cat > src/App.tsx <<'TSX'
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const authed = localStorage.getItem("auth") === "ok";
  const loc = useLocation();
  return authed ? children : <Navigate to="/login" replace state={{ from: loc }} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard/*"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
TSX

echo "▶️ Pequeno toque no CSS base…"
cat > src/index.css <<'CSS'
html, body, #root { height: 100%; }
* { box-sizing: border-box; }
body { margin: 0; background: #f7f5ef; color: #0b3d2e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Arial, sans-serif; }
a { color: inherit; text-decoration: none; }
button { font: inherit; }
CSS

echo "✅ UI escrita com sucesso. Se o dev server não estiver rodando, execute: npm run dev"
