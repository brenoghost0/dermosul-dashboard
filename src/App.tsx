import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/login";
import DashboardLayout from "./layouts/DashboardLayout";
import Home from "./pages/Home";
import Pedidos from "./pages/Pedidos";
import OrderDetail from "./pages/Pedidos/Detail";
import Landing from "./pages/Landing";
import Settings from "./pages/Settings";
import PublicLandingPage from "./pages/public/Landing";
import PurchaseSuccessPage from "./pages/public/PurchaseSuccess";
import PublicCheckoutPage from "./pages/public/Checkout";
import StoreLayout from "./pages/Store/StoreLayout";
import { getStoreSectionRoutes } from "./pages/Store/sections";
import StorefrontShell from "./pages/storefront/StorefrontShell";
import HomePage from "./pages/storefront/HomePage";
import CategoryPage from "./pages/storefront/CategoryPage";
import CollectionPage from "./pages/storefront/CollectionPage";
import ProductPage from "./pages/storefront/ProductPage";
import SearchPage from "./pages/storefront/SearchPage";
import CartPage from "./pages/storefront/CartPage";
import CheckoutPage from "./pages/storefront/CheckoutPage";
import OrderConfirmationPage from "./pages/storefront/OrderConfirmationPage";
import CmsPageView from "./pages/storefront/CmsPage";
import WebScrapingPage from "./pages/WebScraping";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = !!localStorage.getItem("auth");
  const loc = useLocation();
  return authed ? <>{children}</> : <Navigate to="/login" replace state={{ from: loc }} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StorefrontShell />}>
        <Route index element={<HomePage />} />
        <Route path="c/:slug" element={<CategoryPage />} />
        <Route path="colecoes/:slug" element={<CollectionPage />} />
        <Route path="p/:slug" element={<ProductPage />} />
        <Route path="buscar" element={<SearchPage />} />
        <Route path="carrinho" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="pedido/:id/confirmacao" element={<OrderConfirmationPage />} />
        <Route path="pg/:slug" element={<CmsPageView />} />
        <Route path="contato" element={<Navigate to="/pg/contato" replace />} />
        <Route path="sobre" element={<Navigate to="/pg/sobre" replace />} />
        <Route path="politica-de-troca" element={<Navigate to="/pg/politica-de-troca" replace />} />
      </Route>
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
        <Route path="web-scraping" element={<WebScrapingPage />} />
        <Route path="infos" element={<Settings />} />
        <Route path="configuracoes" element={<Settings />} />
        <Route path="store/*" element={<StoreLayout />}>
          <Route index element={<Navigate to="tema" replace />} />
          {getStoreSectionRoutes().map((section) => (
            <Route key={section.path} path={section.path} element={section.element} />
          ))}
        </Route>
      </Route>
      <Route path="/l/:slug" element={<PublicLandingPage />} /> {/* Rota para a landing page pública */}
      <Route path="/purchase-success" element={<PurchaseSuccessPage />} /> {/* Rota para a página de sucesso */}
      <Route path="/public-checkout" element={<PublicCheckoutPage />} /> {/* Rota para a página de checkout pública */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
