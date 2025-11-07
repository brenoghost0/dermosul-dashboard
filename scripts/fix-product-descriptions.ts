import 'dotenv/config';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { prisma } from '../src/db/prisma';
import { HttpFetcher } from '../src/lib/scraping/http';

const BAD_CHAR_REGEX = /[\uFFFDˆ]/;

type ProductWithSource = Awaited<ReturnType<typeof loadProducts>>[number];

async function loadProducts() {
  return prisma.product.findMany({
    include: {
      scrapeResults: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          raw: true,
        },
      },
    },
  });
}

function needsRepair(product: { descriptionHtml: string | null; description: string | null }): boolean {
  return Boolean(
    (product.descriptionHtml && BAD_CHAR_REGEX.test(product.descriptionHtml)) ||
      (product.description && BAD_CHAR_REGEX.test(product.description))
  );
}

function extractDetailUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = (raw as any).detail?.url || (raw as any).detailUrl || (raw as any).url;
  if (typeof candidate === 'string') return candidate;
  const previewUrl = (raw as any).preview?.url;
  if (typeof previewUrl === 'string') return previewUrl;
  return null;
}

function sanitizeDescription(html: string | null | undefined): string | null {
  if (!html) return null;
  const cleaned = sanitizeHtml(html, {
    allowedTags: [
      'p',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'blockquote',
      'img',
      'span',
      'a',
      'br',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
      '*': ['style', 'class'],
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
    },
  });
  return cleaned.trim() ? cleaned : null;
}

function extractDescriptionHtml($: CheerioAPI): string | null {
  const selectors = [
    '[itemprop="description"]',
    '#descricao',
    '#description',
    '.descricao',
    '.description',
    '.product-description',
    '.tab-content',
    '.product-info',
    'article',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element && element.length > 0) {
      const html = element.html();
      if (!html) continue;
      const cleaned = sanitizeDescription(html);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function summarizeHtml(html: string): string {
  const $ = cheerio.load(`<div>${html}</div>`);
  const text = $('div').text().replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

async function repairProductDescription(product: ProductWithSource, fetcher: HttpFetcher) {
  const scrapeResult = product.scrapeResults[0];
  if (!scrapeResult) {
    console.warn(`Produto ${product.id} não possui scrapeResult associado. Pulando.`);
    return { updated: false, reason: 'missing_scrape_result' } as const;
  }

  const detailUrl = extractDetailUrl(scrapeResult.raw);
  if (!detailUrl) {
    console.warn(`Não consegui determinar a URL do produto ${product.id}. Pulando.`);
    return { updated: false, reason: 'missing_url' } as const;
  }

  const html = await fetcher.fetchHtml(detailUrl, { allowDynamic: true, preferDynamic: true });
  const $ = cheerio.load(html);
  const descriptionHtml = extractDescriptionHtml($);
  if (!descriptionHtml) {
    console.warn(`Não encontrei descrição para ${product.id} (${detailUrl}).`);
    return { updated: false, reason: 'missing_description' } as const;
  }

  if (BAD_CHAR_REGEX.test(descriptionHtml)) {
    console.warn(`Descrição de ${product.id} ainda contém caracteres inválidos. Pulando update.`);
    console.warn(`Trecho problemático: ${descriptionHtml.slice(0, 240).replace(/\s+/g, ' ')}`);
    return { updated: false, reason: 'still_invalid' } as const;
  }

  const summary = summarizeHtml(descriptionHtml);
  await prisma.product.update({
    where: { id: product.id },
    data: {
      descriptionHtml: descriptionHtml,
      description: summary || product.description,
    },
  });

  return { updated: true } as const;
}

async function main() {
  const products = await loadProducts();
  const toRepair = products.filter(needsRepair);
  if (toRepair.length === 0) {
    console.log('Nenhum produto precisa de reparo.');
    return;
  }

  console.log(`Encontrados ${toRepair.length} produtos com descrições corrompidas. Refazendo...`);
  const fetcher = new HttpFetcher({ maxRequestsPerSecond: 2, allowDynamicRendering: true });

  let success = 0;
  let failures = 0;

  for (const product of toRepair) {
    try {
      const result = await repairProductDescription(product, fetcher);
      if (result.updated) {
        success += 1;
      } else {
        failures += 1;
      }
    } catch (error) {
      failures += 1;
      console.error(`Erro ao atualizar produto ${product.id}:`, error);
    }
  }

  await fetcher.close();

  console.log(`Atualização concluída. Sucesso: ${success}. Falhas: ${failures}.`);
}

main()
  .catch((error) => {
    console.error('Falha geral ao reparar descrições:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
