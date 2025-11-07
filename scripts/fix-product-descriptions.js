#!/usr/bin/env node
import 'dotenv/config';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { PrismaClient } from '@prisma/client';
import { HttpFetcher } from '../dist-server/lib/scraping/http.js';

const prisma = new PrismaClient();

const BAD_CHAR_REGEX = /�/;

function log(msg) {
  process.stdout.write(msg + '\n');
}

function extractDetailUrl(raw) {
  if (!raw) return null;
  const detail = raw.detail?.url || raw.detailUrl || raw.url;
  if (typeof detail === 'string') return detail;
  if (typeof raw.preview?.url === 'string') return raw.preview.url;
  return null;
}

function extractDescriptionHtml(html) {
  const $ = cheerio.load(html);
  const selectors = [
    '[itemprop="description"]',
    '#descricao',
    '#description',
    '.descricao',
    '.description',
    '.product-description',
    '.tab-content',
    '.product-info',
    'article'
  ];
  for (const selector of selectors) {
    const el = $(selector).first();
    if (!el.length) continue;
    const content = el.html();
    if (!content) continue;
    const cleaned = sanitizeHtml(content, {
      allowedTags: ['p','strong','em','ul','ol','li','h1','h2','h3','blockquote','img','span','a','br'],
      allowedAttributes: { a: ['href','title','target','rel'], img: ['src','alt','title'], '*': ['style','class'] },
      transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' } }) }
    }).trim();
    if (cleaned) return cleaned;
  }
  return null;
}

function summarizeHtml(html) {
  const $ = cheerio.load(`<div>${html}</div>`);
  const text = $('div').text().replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { descriptionHtml: { contains: '�' } },
    include: { scrapeResults: { take: 1, orderBy: { createdAt: 'desc' } } }
  });

  if (products.length === 0) {
    log('Nenhum produto com descrição corrompida encontrado.');
    return;
  }

  log(`Atualizando ${products.length} produtos...`);
  const fetcher = new HttpFetcher({ maxRequestsPerSecond: 1, allowDynamicRendering: true });
  let success = 0;
  let failure = 0;

  for (const product of products) {
    const detailUrl = extractDetailUrl(product.scrapeResults[0]?.raw);
    if (!detailUrl) {
      log(`Produto ${product.id} (${product.name}) sem URL. Pulando.`);
      failure += 1;
      continue;
    }
    log(`Buscando ${product.id} (${product.name}) em ${detailUrl}`);
    try {
      const html = await fetcher.fetchHtml(detailUrl, { allowDynamic: true, preferDynamic: true });
      const descriptionHtml = extractDescriptionHtml(html);
      if (!descriptionHtml || BAD_CHAR_REGEX.test(descriptionHtml)) {
        log(`Ainda inválido. Pulando ${product.id}.`);
        failure += 1;
        continue;
      }
      const summary = summarizeHtml(descriptionHtml);
      await prisma.product.update({
        where: { id: product.id },
        data: { descriptionHtml, description: summary || product.description },
      });
      success += 1;
    } catch (error) {
      log(`Erro ao atualizar ${product.id}: ${error}`);
      failure += 1;
    }
  }

  await fetcher.close();
  log(`Concluído. Sucesso: ${success}, Falhas: ${failure}`);
}

main().catch((error) => {
  console.error('Falha geral:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
