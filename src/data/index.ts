// backend/data/index.ts
// Ponto de entrada para a camada de dados, forçando o uso do SQL Adapter.

import * as sqlAdapter from './sql-adapter.js';
import { toISO, lastNDays } from '../utils/index.js';

const DATA_SOURCE = process.env.DATA_SOURCE;

if (DATA_SOURCE !== 'sql') {
  console.error(`FATAL: DATA_SOURCE deve ser 'sql', mas é '${DATA_SOURCE}'. Verifique o arquivo .env`);
  process.exit(1); // Encerra o processo se a configuração estiver errada.
}

console.log("Using SQL adapter");

// Exporta todas as funções do sql-adapter diretamente.
export const {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  statsLast14Days,
  paymentsBreakdown,
  listLandingPages,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  getLandingBySlug,
  createPublicOrder,
  updateLandingPageStatus,
  updateOrderStatusByExternalReference,
  getOrderByExternalReference,
} = sqlAdapter;

export * from "./store-adapter.js";
export * from "./scrape";

// Exportar utilitários de data que são usados pelo server.ts
export { toISO, lastNDays };
