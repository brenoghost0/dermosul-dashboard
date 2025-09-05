"use strict";
// backend/data/index.ts
// Ponto de entrada para a camada de dados, forçando o uso do SQL Adapter.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastNDays = exports.toISO = exports.getOrderByExternalReference = exports.updateOrderStatusByExternalReference = exports.updateLandingPageStatus = exports.createPublicOrder = exports.getLandingBySlug = exports.deleteLandingPage = exports.updateLandingPage = exports.createLandingPage = exports.listLandingPages = exports.paymentsBreakdown = exports.statsLast14Days = exports.deleteOrder = exports.updateOrder = exports.createOrder = exports.getOrderById = exports.listOrders = void 0;
const sqlAdapter = __importStar(require("./sql-adapter.js"));
const index_js_1 = require("../utils/index.js");
Object.defineProperty(exports, "toISO", { enumerable: true, get: function () { return index_js_1.toISO; } });
Object.defineProperty(exports, "lastNDays", { enumerable: true, get: function () { return index_js_1.lastNDays; } });
const DATA_SOURCE = process.env.DATA_SOURCE;
if (DATA_SOURCE !== 'sql') {
    console.error(`FATAL: DATA_SOURCE deve ser 'sql', mas é '${DATA_SOURCE}'. Verifique o arquivo .env`);
    process.exit(1); // Encerra o processo se a configuração estiver errada.
}
console.log("Using SQL adapter");
// Exporta todas as funções do sql-adapter diretamente.
exports.listOrders = sqlAdapter.listOrders, exports.getOrderById = sqlAdapter.getOrderById, exports.createOrder = sqlAdapter.createOrder, exports.updateOrder = sqlAdapter.updateOrder, exports.deleteOrder = sqlAdapter.deleteOrder, exports.statsLast14Days = sqlAdapter.statsLast14Days, exports.paymentsBreakdown = sqlAdapter.paymentsBreakdown, exports.listLandingPages = sqlAdapter.listLandingPages, exports.createLandingPage = sqlAdapter.createLandingPage, exports.updateLandingPage = sqlAdapter.updateLandingPage, exports.deleteLandingPage = sqlAdapter.deleteLandingPage, exports.getLandingBySlug = sqlAdapter.getLandingBySlug, exports.createPublicOrder = sqlAdapter.createPublicOrder, exports.updateLandingPageStatus = sqlAdapter.updateLandingPageStatus, exports.updateOrderStatusByExternalReference = sqlAdapter.updateOrderStatusByExternalReference, exports.getOrderByExternalReference = sqlAdapter.getOrderByExternalReference;
