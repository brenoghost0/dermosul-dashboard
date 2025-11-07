import React from "react";
import ThemeSection from "./sections/ThemeSection";
import BannersSection from "./sections/BannersSection";
import TextsSection from "./sections/TextsSection";
import LayoutSection from "./sections/LayoutSection";
import ProductsSection from "./sections/ProductsSection";
import CategoriesSection from "./sections/CategoriesSection";
import CollectionsSection from "./sections/CollectionsSection";
import PagesSection from "./sections/PagesSection";
import NavigationSection from "./sections/NavigationSection";
import ShippingSection from "./sections/ShippingSection";
import PaymentsSection from "./sections/PaymentsSection";
import SeoSection from "./sections/SeoSection";
import DomainSection from "./sections/DomainSection";
import IntegrationsSection from "./sections/IntegrationsSection";
import { StoreSectionPlaceholder, storeSections } from "./StoreLayout";

type SectionConfig = {
  path: string;
  element: React.ReactNode;
};

const sectionMap: Record<string, React.ReactNode> = {
  tema: <ThemeSection />,
  banners: <BannersSection />,
  textos: <TextsSection />,
  layout: <LayoutSection />,
  produtos: <ProductsSection />,
  categorias: <CategoriesSection />,
  colecoes: <CollectionsSection />,
  paginas: <PagesSection />,
  navegacao: <NavigationSection />,
  frete: <ShippingSection />,
  pagamentos: <PaymentsSection />,
  seo: <SeoSection />,
  dominio: <DomainSection />,
  integracoes: <IntegrationsSection />,
};

const sectionRoutes: SectionConfig[] = storeSections.map((section) => ({
  path: section.path,
  element: sectionMap[section.path] || <StoreSectionPlaceholder title={section.label} description={section.description} />,
}));

export function getStoreSectionRoutes() {
  return sectionRoutes;
}
