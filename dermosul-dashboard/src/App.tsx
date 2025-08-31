import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/login";
import Home from "./pages/home";
import Pedidos from "./pages/pedidos";
import Detail from "./pages/pedidos/Detail";
import Landing from "./pages/landing";
import Infos from "./pages/infos";
import DashboardLayout from "./layouts/DashboardLayout";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthed = localStorage.getItem("auth") === "ok";
  const loc = useLocation();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc }} />;
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
        <Route path="home" element={<Home />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="pedidos/:id" element={<Detail />} />
        <Route path="landing" element={<Landing />} />
        <Route path="infos" element={<Infos />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}