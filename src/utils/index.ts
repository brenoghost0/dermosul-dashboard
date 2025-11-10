import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';

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

export const generateUniqueId = () => {
  return Math.random().toString(36).substr(2, 9);
};

type PrismaOrderClient = Prisma.TransactionClient | PrismaClient;

export const generateUniqueNumericOrderId = async (
  client: PrismaOrderClient = prisma,
  length = 8,
): Promise<string> => {
  // Garante IDs apenas numéricos e evita colisões consultando o banco
  while (true) {
    const candidate = generateShortId(length);
    const exists = await client.order.findUnique({
      where: { id: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
  }
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
