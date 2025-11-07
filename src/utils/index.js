"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = exports.generateUniqueId = exports.lastNDays = exports.toISO = exports.generateShortId = void 0;
const generateShortId = (length = 8) => {
    // Gera um ID numérico de 'length' dígitos (default 8)
    // Sem zeros à esquerda sendo removidos: string fixa, ex.: '00342189'
    const nums = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += nums.charAt(Math.floor(Math.random() * nums.length));
    }
    return result;
};
exports.generateShortId = generateShortId;
const toISO = (date) => date.toISOString().slice(0, 10);
exports.toISO = toISO;
const lastNDays = (n) => {
    const dates = [];
    for (let i = 0; i < n; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push((0, exports.toISO)(d));
    }
    return dates.reverse();
};
exports.lastNDays = lastNDays;
const prisma_1 = require("../db/prisma");
const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
};
exports.generateUniqueId = generateUniqueId;
const generateSlug = async (text) => {
    const baseSlug = text
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');
    let finalSlug = baseSlug;
    let counter = 1;
    // Verifica se o slug já existe no banco de dados
    while (await prisma_1.prisma.landingPage.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    return finalSlug;
};
exports.generateSlug = generateSlug;
