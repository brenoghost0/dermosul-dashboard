export const generateShortId = (length = 8) => {
  // Gera um ID numérico de 'length' dígitos (default 8)
  // Sem zeros à esquerda sendo removidos: string fixa, ex.: '00342189'
  const nums = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += nums.charAt(Math.floor(Math.random() * nums.length));
  }
  return result;
};

export const toISO = (date: Date) => date.toISOString().slice(0, 10);

export const lastNDays = (n: number) => {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(toISO(d));
  }
  return dates.reverse();
};

import { prisma } from '../db/prisma.js';

export const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateSlug = async (text: string): Promise<string> => {
  const baseSlug = text
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');

  let finalSlug = baseSlug;
  let counter = 1;

  // Verifica se o slug já existe no banco de dados
  while (await prisma.landingPage.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return finalSlug;
};
