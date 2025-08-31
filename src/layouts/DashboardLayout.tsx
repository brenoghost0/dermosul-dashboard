import { Link, Outlet, useNavigate } from "react-router-dom";

export default function DashboardLayout() {
  const nav = useNavigate();
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
  return (
    <div style={{display:"grid",gridTemplateColumns:"220px 1fr",minHeight:"100vh",background:"#f7f5ef"}}>
      <aside style={{padding:"20px",borderRight:"1px solid #e8e8e8",background:"#fff"}}>
        <h3 style={{marginTop:0,color:"#194C33"}}>Dermosul</h3>
        <nav style={{display:"grid",gap:"8px"}}>
          <Link to="/dashboard">Home</Link>
          <Link to="/dashboard/pedidos">Pedidos</Link>
          <Link to="/dashboard/landing">Landing</Link>
          <Link to="/dashboard/infos">Infos</Link>
        </nav>
        <button onClick={logout} style={{marginTop:"16px",padding:"8px 12px",borderRadius:"8px",border:"1px solid #194C33",background:"#fff",cursor:"pointer"}}>Sair</button>
      </aside>
      <main style={{padding:"24px"}}>
        <h1 style={{color:"#194C33",marginTop:0}}>Dermosul Dashboard</h1>
        <Outlet />
      </main>
    </div>
  );
}
