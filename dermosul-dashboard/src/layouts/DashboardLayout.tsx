import { Link, Outlet, useNavigate } from "react-router-dom";

export default function DashboardLayout() {
  const nav = useNavigate();

  function logout() {
    localStorage.removeItem("auth");
    nav("/login", { replace: true });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        minHeight: "100vh",
      }}
    >
      <aside
        style={{
          padding: 16,
          borderRight: "1px solid #eee",
          background: "#f0f6f3",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Dermosul</h3>
        <nav style={{ display: "grid", gap: 8 }}>
          <Link to="/dashboard/home">Home</Link>
          <Link to="/dashboard/pedidos">Pedidos</Link>
          <Link to="/dashboard/landing">Landing</Link>
          <Link to="/dashboard/infos">Infos</Link>
        </nav>
        <button onClick={logout} style={{ marginTop: 16 }}>Sair</button>
      </aside>

      <main style={{ padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}