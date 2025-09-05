import React from 'react';
import Template3 from './Template3';
import { LandingPage } from '../../lib/api';

// Template 4: reutiliza a lógica do Template3, porém com classes claras (sobrescritas via wrapper)
export default function Template4({ landingPageData }: { landingPageData: LandingPage }) {
  // Como o Template3 já usa classes utilitárias, aqui poderíamos duplicar com tema claro.
  // Para manter simples e estável, reutilizamos Template3 (já contém blocos light-friendly)
  // Se desejar um tema totalmente claro independente, podemos evoluir separando um Theme prop.
  return <Template3 landingPageData={landingPageData} theme="light" />;
}
