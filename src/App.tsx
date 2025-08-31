import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/login";
import DashboardLayout from "./layouts/DashboardLayout";
import Home from "./pages/Home";
import Pedidos from "./pages/Pedidos";
import OrderDetail from "./pages/Pedidos/Detail";
import Landing from "./pages/Landing";
import Infos from "./pages/Infos";
import PublicLandingPage from "./pages/public/Landing"; // Importar o componente da landing page pública
import PurchaseSuccessPage from "./pages/public/PurchaseSuccess"; // Importar a página de sucesso
import PublicCheckoutPage from "./pages/public/Checkout"; // Importar a página de checkout pública

function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = !!localStorage.getItem("auth");
  const loc = useLocation();
  return authed ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc }} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="pedidos/:id" element={<OrderDetail />} />
        <Route path="landing" element={<Landing />} />
        <Route path="infos" element={<Infos />} />
      </Route>
      <Route path="/l/:slug" element={<PublicLandingPage />} /> {/* Rota para a landing page pública */}
      <Route path="/purchase-success" element={<PurchaseSuccessPage />} /> {/* Rota para a página de sucesso */}
      <Route path="/public-checkout" element={<PublicCheckoutPage />} /> {/* Rota para a página de checkout pública */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
