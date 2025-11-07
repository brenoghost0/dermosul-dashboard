import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import type { Page } from 'playwright';
import { HttpFetcher } from './http';
import { getMaxProductsForMode } from './config';
import type { ScrapeMode, ScrapedProductInput, ScrapeRunnerOptions } from './types';
import { classifyProductCategoriesBatch } from '../ai/category-classifier';

interface ProductPreview {
  title: string;
  url: string;
  price?: number;
  sku?: string;
  brand?: string;
  raw?: Record<string, unknown>;
}

function parsePrice(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value
      .replace(/[^\d.,-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sanitizeGalleryUrl(raw: string, skuFragment?: string | null): string | null {
  if (!raw) return null;
  let cleaned = raw
    .replace(/&(?:amp;)?quot;/gi, '')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/gi, '/')
    .replace(/&#34;/gi, '')
    .replace(/\\u0026/gi, '&')
    .trim();
  cleaned = cleaned.replace(/[,\\"]+$/g, '');
  if (!cleaned.startsWith('http')) return null;
  const lower = cleaned.toLowerCase();
  if (!lower.includes('imagens/product')) return null;
  if (lower.includes('youtube') || lower.includes('youtu.be')) return null;
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.m3u8')) return null;
  if (skuFragment) {
    const normalizedSku = skuFragment.toLowerCase();
    const productMatch = cleaned.toLowerCase().match(/\/product\/([^/]+)/);
    if (productMatch && !productMatch[1].includes(normalizedSku)) {
      return null;
    }
  }
  return cleaned;
}

function collectGalleryUrlsFromHtml(html: string, skuFragment?: string | null): string[] {
  const regex = /https:\/\/[^\s"'&]+imagens\/product\/[^\s"'&]+/gi;
  const matches = html.match(regex) ?? [];
  const set = new Set<string>();
  for (const match of matches) {
    const sanitized = sanitizeGalleryUrl(match, skuFragment);
    if (sanitized) {
      set.add(upscaleImage(sanitized));
    }
  }
  return Array.from(set);
}

function upscaleImage(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('cloudinary')) return url;
    const pathname = parsed.pathname;
    const accountMatch = pathname.match(/(\/[^/]+\/image\/upload)/);
    const versionMatch = pathname.match(/\/v\d+\/imagens\/.+/);
    if (accountMatch && versionMatch) {
      const accountSegment = accountMatch[1];
      const remainder = versionMatch[0];
      return `${parsed.origin}${accountSegment}/w_1200,f_auto,fl_progressive,q_auto:best${remainder}`;
    }
    return url;
  } catch {
    return url;
  }
}

function mergeImages(base: URL, ...lists: (string[] | undefined)[]): string[] | undefined {
  const result = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      const absolute = absoluteUrl(base, item) ?? item;
      if (absolute) {
        result.add(upscaleImage(absolute));
      }
    }
  }
  return result.size > 0 ? Array.from(result) : undefined;
}

export interface ScrapeRunnerCallbacks {
  onLog: (message: string, level?: 'info' | 'warn' | 'error', meta?: Record<string, unknown>) => void | Promise<void>;
  onProgress?: (processed: number, total: number) => void | Promise<void>;
  onDiscoveredTotal?: (total: number) => void | Promise<void>;
  onProduct: (product: ScrapedProductInput) => Promise<void>;
  shouldAbort?: () => Promise<boolean> | boolean;
}

export interface ScrapeRunnerResult {
  totalDiscovered: number;
  processed: number;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<void>
) {
  if (items.length === 0) return;
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  let index = 0;

  const worker = async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) break;
      await handler(items[current], current);
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function replaceBranding(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return value ?? null;
  return value.replace(/BLZ/gi, 'Dermosul');
}

function absoluteUrl(base: URL, href?: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isSameHost(url: URL, target: URL): boolean {
  return url.hostname === target.hostname;
}

function traverseJsonLd(node: unknown, visitor: (data: any) => void) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) traverseJsonLd(item, visitor);
    return;
  }
  if (typeof node === 'object') {
    visitor(node);
    for (const value of Object.values(node as Record<string, unknown>)) {
      traverseJsonLd(value, visitor);
    }
  }
}

function extractPreviewsFromJsonLd($: CheerioAPI, baseUrl: URL): ProductPreview[] {
  const previews: ProductPreview[] = [];
  const scripts = $('script[type="application/ld+json"]');

  scripts.each((_, el) => {
    const rawJson = $(el).contents().text();
    if (!rawJson) return;
    try {
      const parsed = JSON.parse(rawJson);
      traverseJsonLd(parsed, (node) => {
        const type = node?.['@type'] || node?.type;
        if (!type) return;
        const normalizedType = Array.isArray(type) ? type : [type];
        if (normalizedType.includes('ItemList') && Array.isArray(node.itemListElement)) {
          for (const entry of node.itemListElement) {
            const item = entry?.item || entry;
            if (item) {
              traverseJsonLd(item, (inner) => {
                if (inner?.['@type'] === 'Product' || (Array.isArray(inner?.['@type']) && inner['@type'].includes('Product'))) {
                  const url = absoluteUrl(baseUrl, inner.url || inner['@id']);
                  if (!url) return;
                  previews.push({
                    title: normalizeWhitespace(inner.name || ''),
                    url,
                    price: parsePrice(inner.offers?.price || inner.price),
                    sku: inner.sku,
                    brand: typeof inner.brand === 'string' ? inner.brand : inner.brand?.name,
                    raw: inner,
                  });
                }
              });
            }
          }
        }
        if (normalizedType.includes('Product')) {
          const url = absoluteUrl(baseUrl, node.url || node['@id']);
          if (!url) return;
          previews.push({
            title: normalizeWhitespace(node.name || ''),
            url,
            price: parsePrice(node.offers?.price || node.price),
            sku: node.sku,
            brand: typeof node.brand === 'string' ? node.brand : node.brand?.name,
            raw: node,
          });
        }
      });
    } catch {
      // ignora erros de JSON malformado
    }
  });

  return previews.filter((item) => item.title && item.url);
}

function extractPreviewsFromDom($: CheerioAPI, baseUrl: URL): ProductPreview[] {
  const previews: ProductPreview[] = [];
  const pushPreview = (preview: ProductPreview | null | undefined) => {
    if (!preview || !preview.url) return;
    previews.push(preview);
  };

  const collectFromElement = (element: cheerio.Cheerio<any>) => {
    const anchor =
      element.is('a[href]')
        ? element
        : element.find('a[href]').not('[href="#"]').not('[href=""]').first();
    if (!anchor || anchor.length === 0) return;

    const href = anchor.attr('href');
    const url = absoluteUrl(baseUrl, href);
    if (!url) return;

    try {
      const destination = new URL(url);
      if (!isSameHost(baseUrl, destination)) return;
    } catch {
      return;
    }

    const titleSource =
      element.attr('data-product-name') ||
      element.find('[data-product-name]').first().text() ||
      element.find('[data-testid="product-name"]').first().text() ||
      anchor.attr('title') ||
      anchor.text();

    const priceSource =
      element.attr('data-price') ||
      element.find('[data-price]').attr('data-price') ||
      element.find('[itemprop="price"]').text() ||
      anchor.data('price');

    const brandSource =
      element.attr('data-brand') ||
      element.find('[data-brand]').attr('data-brand') ||
      element.find('[data-testid="product-brand"]').first().text();

    const skuSource =
      element.attr('data-sku') ||
      anchor.attr('data-sku') ||
      element.find('[data-sku]').attr('data-sku');

    pushPreview({
      title: normalizeWhitespace(titleSource) || url,
      brand: normalizeWhitespace(brandSource) || undefined,
      price: parsePrice(priceSource),
      url,
      sku: skuSource || undefined,
      raw: {
        dataset: element.data(),
      },
    });
  };

  const selectors = [
    '[data-testid^="product-card"]',
    'article[data-event*="product"]',
    'li[data-product]',
    'div[data-product]',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => collectFromElement($(el)));
  }

  return previews;
}

function normalizeProductKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    const normalizedPath = parsed.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    return `${parsed.hostname}${normalizedPath}`;
  } catch {
    return url;
  }
}

function dedupePreviews(previews: ProductPreview[]): ProductPreview[] {
  const seen = new Map<string, ProductPreview>();
  for (const preview of previews) {
    if (!preview.url) continue;
    const key = normalizeProductKey(preview.url);
    if (!seen.has(key)) {
      seen.set(key, preview);
    }
  }
  return Array.from(seen.values());
}

const COOKIE_ACCEPT_SELECTORS = [
  'button#onetrust-accept-btn-handler',
  'button[data-testid="cookie-consent-accept"]',
  'button:has-text("Aceitar")',
  'button:has-text("Aceitar todos os cookies")',
  '#onetrust-accept-btn-handler',
];

const LOAD_MORE_BUTTON_SELECTORS = [
  'button:has-text("Carregar mais produtos")',
  'button:has-text("Carregar mais")',
  'button[data-testid="load-more-button"]',
  '[data-testid="load-more-products"] button',
  'button.load-more',
  '[aria-label*="Carregar mais"]',
];

const MAX_LOAD_MORE_CLICKS = 60;

async function tryClickCookieConsent(page: Page) {
  for (const selector of COOKIE_ACCEPT_SELECTORS) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (!count) continue;
    try {
      if (await locator.isVisible()) {
        await locator.click({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(500);
        break;
      }
    } catch {
      // ignore interaction failures
    }
  }
}

async function tryClickLoadMore(page: Page): Promise<boolean> {
  for (const selector of LOAD_MORE_BUTTON_SELECTORS) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (!count) continue;
    try {
      if (!(await locator.isVisible())) continue;
      const disabled = (await locator.getAttribute('disabled')) ?? (await locator.getAttribute('aria-disabled'));
      if (disabled && disabled !== 'false') continue;
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      await locator.click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function autoExpandCatalogPage(page: Page, signal?: AbortSignal) {
  const throwIfCancelled = () => {
    if (signal?.aborted) {
      throw new Error('SCRAPE_CANCELLED');
    }
  };

  throwIfCancelled();
  await page.waitForTimeout(1000);
  throwIfCancelled();
  await tryClickCookieConsent(page);

  let clicks = 0;
  let idleScrolls = 0;
  const maxIdleScrolls = 3;

  while (clicks < MAX_LOAD_MORE_CLICKS) {
    throwIfCancelled();
    const clicked = await tryClickLoadMore(page);
    if (clicked) {
      clicks += 1;
      idleScrolls = 0;
      continue;
    }

    throwIfCancelled();
    // Try to trigger infinite scroll pages that load when reaching the bottom
    const beforeHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    throwIfCancelled();
    const afterHeight = await page.evaluate(() => document.body.scrollHeight);
    if (afterHeight > beforeHeight) {
      idleScrolls = 0;
      continue;
    }

    idleScrolls += 1;
    if (idleScrolls >= maxIdleScrolls) break;
  }
}

function extractNextPageUrl($: CheerioAPI, baseUrl: URL): string | null {
  const relLink = $('link[rel="next"]').attr('href') || $('a[rel="next"]').attr('href');
  if (relLink) {
    const absolute = absoluteUrl(baseUrl, relLink);
    if (absolute) return absolute;
  }

  const candidates = $('a').filter((_, el) => {
    const text = normalizeWhitespace($(el).text()).toLowerCase();
    return text === 'próxima' || text === 'próximo' || text === 'next' || text.includes('próxima página');
  });
  if (candidates.length > 0) {
    const href = candidates.first().attr('href');
    const absolute = absoluteUrl(baseUrl, href);
    if (absolute) return absolute;
  }

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

function extractAttributes($: CheerioAPI): Record<string, unknown> | undefined {
  const attributes: Record<string, unknown> = {};
  const selectorGroups = [
    'table',
    'dl',
    '[data-specs]',
    '.product-attributes',
    '.characteristics',
  ];

  for (const selector of selectorGroups) {
    const tables = $(selector);
    if (!tables.length) continue;

    tables.each((_, table) => {
      const element = $(table);

      element.find('tr').each((__, row) => {
        const label = normalizeWhitespace($(row).find('th, td').first().text());
        const value = normalizeWhitespace($(row).find('td').last().text());
        if (label && value) {
          attributes[label] = value;
        }
      });

      element.find('dt').each((__, dt) => {
        const label = normalizeWhitespace($(dt).text());
        const dd = normalizeWhitespace($(dt).next('dd').text());
        if (label && dd) attributes[label] = dd;
      });
    });

    if (Object.keys(attributes).length > 0) break;
  }

  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function extractImages($: CheerioAPI, baseUrl: URL, fallbackRaw?: any): string[] | undefined {
  const images = new Set<string>();

  if (fallbackRaw?.image) {
    if (Array.isArray(fallbackRaw.image)) {
      for (const img of fallbackRaw.image) {
        const url = absoluteUrl(baseUrl, img);
        if (url) images.add(url);
      }
    } else {
      const url = absoluteUrl(baseUrl, fallbackRaw.image);
      if (url) images.add(url);
    }
  }

  $('[data-gallery] img, .product-gallery img, .gallery img, img[itemprop="image"]').each((_, img) => {
    const src = $(img).attr('data-src') || $(img).attr('src');
    const url = absoluteUrl(baseUrl, src || undefined);
    if (url) images.add(url);
  });

  if (images.size === 0) return undefined;
  const upscaled = Array.from(images).map((img) => upscaleImage(img));
  return upscaled;
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
      if (html) {
        const cleaned = sanitizeDescription(html);
        if (cleaned) return cleaned;
      }
    }
  }
  return null;
}

function extractShortDescription($: CheerioAPI, fallback?: string): string | null {
  const selectors = [
    '.short-description',
    '.product-short-description',
    '.resumo',
    '.summary',
    'meta[name="description"]',
  ];

  for (const selector of selectors) {
    if (selector.startsWith('meta')) {
      const content = $(selector).attr('content');
      if (content) return normalizeWhitespace(content);
    } else {
      const text = normalizeWhitespace($(selector).first().text());
      if (text) return text;
    }
  }

  if (fallback) return normalizeWhitespace(fallback);
  return null;
}

function mergeProductData(preview: ProductPreview, detail: Partial<ScrapedProductInput>): ScrapedProductInput {
  return {
    title: detail.title || preview.title,
    brand: detail.brand || preview.brand || null,
    price: detail.price ?? preview.price ?? null,
    sku: detail.sku || preview.sku || null,
    shortDescription: replaceBranding(detail.shortDescription || (preview.raw?.description as string | undefined) || null),
    longDescriptionHtml: replaceBranding(detail.longDescriptionHtml || null),
    images: detail.images,
    attributes: detail.attributes,
    detailUrl: preview.url,
    raw: {
      preview: preview.raw,
      detail: detail.raw,
    },
  };
}

function extractProductDetailFromJsonLd($: CheerioAPI, baseUrl: URL): Partial<ScrapedProductInput> {
  const scripts = $('script[type="application/ld+json"]');
  let bestMatch: any = null;

  scripts.each((_, el) => {
    const rawJson = $(el).contents().text();
    if (!rawJson) return;
    try {
      const parsed = JSON.parse(rawJson);
      traverseJsonLd(parsed, (node) => {
        if (!node) return;
        const type = node['@type'] || node.type;
        if (!type) return;
        const typeList = Array.isArray(type) ? type : [type];
        if (typeList.includes('Product')) {
          bestMatch = node;
        }
      });
    } catch {
      // ignora JSON inválido
    }
  });

  if (!bestMatch) {
    return {};
  }

  const images = Array.isArray(bestMatch.image)
    ? bestMatch.image.map((img: string) => absoluteUrl(baseUrl, img)).filter(Boolean) as string[]
    : bestMatch.image
      ? [absoluteUrl(baseUrl, bestMatch.image)].filter(Boolean) as string[]
      : undefined;

  const attributes: Record<string, unknown> = {};
  if (Array.isArray(bestMatch.additionalProperty)) {
    for (const property of bestMatch.additionalProperty) {
      if (property?.name && property?.value) {
        attributes[property.name] = property.value;
      }
    }
  }

  return {
    title: bestMatch.name,
    brand: typeof bestMatch.brand === 'string' ? bestMatch.brand : bestMatch.brand?.name,
    price: parsePrice(bestMatch.offers?.price || bestMatch.price) ?? undefined,
    sku: bestMatch.sku || bestMatch.mpn,
    shortDescription: bestMatch.description,
    longDescriptionHtml: bestMatch.description,
    images,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    raw: bestMatch,
  };
}

async function enrichProduct(
  preview: ProductPreview,
  fetcher: HttpFetcher,
  callbacks: ScrapeRunnerCallbacks,
  options: ScrapeRunnerOptions,
  abortSignal: AbortSignal
): Promise<ScrapedProductInput> {
  await callbacks.onLog(`Extraindo detalhes do produto: ${preview.title}`, 'info', { url: preview.url });
  const html = await fetcher.fetchHtml(preview.url, { allowDynamic: options.allowDynamicRendering, abortSignal });
  const baseUrl = new URL(preview.url);
  const $ = cheerio.load(html);
  const detailFromJson = extractProductDetailFromJsonLd($, baseUrl);
  const descriptionHtml = extractDescriptionHtml($);
  const attributes = extractAttributes($);
  const images = extractImages($, baseUrl, detailFromJson.raw);
  const shortDescription = extractShortDescription($, detailFromJson.shortDescription || preview.raw?.description as string | undefined);
  const galleryImages = collectGalleryUrlsFromHtml(
    html,
    detailFromJson.sku ?? preview.sku ?? null
  );
  const mergedImages = mergeImages(baseUrl, galleryImages, images, detailFromJson.images);

  return mergeProductData(preview, {
    ...detailFromJson,
    longDescriptionHtml: descriptionHtml || detailFromJson.longDescriptionHtml || null,
    shortDescription,
    attributes: attributes || detailFromJson.attributes,
    images: mergedImages,
  });
}

export async function runScrapeProcess(
  sourceUrl: string,
  mode: ScrapeMode,
  callbacks: ScrapeRunnerCallbacks,
  options: ScrapeRunnerOptions = {}
): Promise<ScrapeRunnerResult> {
  const fetcher = new HttpFetcher({
    maxRequestsPerSecond: options.maxRequestsPerSecond,
    allowDynamicRendering: options.allowDynamicRendering ?? true,
  });
  const queue: string[] = [sourceUrl];
  const visited = new Set<string>();
  const previews: ProductPreview[] = [];
  const maxProducts = getMaxProductsForMode(mode);

  const shouldEnhanceCatalog = options.preferDynamicCatalog ?? true;
  const fetchAbortController = new AbortController();
  const isCancellationError = (error: unknown) => error instanceof Error && error.message === 'SCRAPE_CANCELLED';
  const cancelFetcher = async () => {
    fetchAbortController.abort();
    await fetcher.cancel().catch(() => undefined);
  };

  let cancelWatcherActive = true;
  const shouldAbortFn = callbacks.shouldAbort;
  const cancelWatcher = shouldAbortFn
    ? (async () => {
        while (cancelWatcherActive) {
          const shouldStop = await shouldAbortFn();
          if (shouldStop) {
            await cancelFetcher();
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      })()
    : null;

  let processed = 0;
  let aborted = false;
  const detailConcurrency = Math.max(1, Math.floor(options.detailConcurrency ?? 1));
  const detailBatchSize = Math.max(10, Number(process.env.SCRAPER_DETAIL_BATCH_SIZE ?? '60'));
  const categoryBatchSize = Math.max(1, Number(process.env.SCRAPER_CATEGORY_BATCH_SIZE ?? '10'));
  const processedUrls = new Set<string>();
  let scheduledDetailUntil = 0;
  let detailChain = Promise.resolve();
  type PendingCategoryEntry = { product: ScrapedProductInput; key: string };
  const pendingCategoryQueue: PendingCategoryEntry[] = [];
  let categoryFlushPromise: Promise<void> | null = null;

  const flushCategoryQueue = (force = false): Promise<void> | undefined => {
    if (categoryFlushPromise) {
      if (force) {
        return categoryFlushPromise.then(() => flushCategoryQueue(true));
      }
      return categoryFlushPromise;
    }
    if (!force && pendingCategoryQueue.length < categoryBatchSize) return undefined;
    if (pendingCategoryQueue.length === 0) return undefined;
    const batchSize = force ? pendingCategoryQueue.length : Math.min(categoryBatchSize, pendingCategoryQueue.length);
    if (batchSize === 0) return undefined;
    const batch = pendingCategoryQueue.splice(0, batchSize);
    categoryFlushPromise = (async () => {
      const payload = batch.map((entry) => ({
        id: entry.key,
        title: entry.product.title ?? 'Produto Dermosul',
        brand: entry.product.brand ?? null,
        shortDescription: entry.product.shortDescription ?? null,
        longDescriptionHtml: entry.product.longDescriptionHtml ?? null,
        detailUrl: entry.product.detailUrl ?? null,
      }));
      let classificationMap: Record<string, string[]> = {};
      try {
        classificationMap = await classifyProductCategoriesBatch(payload);
      } catch (error) {
        await callbacks.onLog(`Falha ao classificar categorias em lote: ${(error as Error).message}`, 'warn');
      }
      for (const entry of batch) {
        const categories = classificationMap[entry.key];
        if (categories?.length) {
          entry.product.categories = categories;
          await callbacks.onLog(`Categorias sugeridas para "${entry.product.title}": ${categories.join(', ')}`);
        }
        await callbacks.onProduct(entry.product);
        processed += 1;
        if (callbacks.onProgress) {
          await callbacks.onProgress(processed, Math.max(previews.length, processed));
        }
      }
    })().finally(() => {
      categoryFlushPromise = null;
      if (pendingCategoryQueue.length >= categoryBatchSize) {
        const followUp = flushCategoryQueue(false);
        if (followUp) {
          followUp.catch(async (error) => {
            await callbacks.onLog(`Falha ao processar lote de categorias: ${(error as Error).message}`, 'error');
          });
        }
      }
    });
    return categoryFlushPromise;
  };

  const enqueueProductForClassification = (product: ScrapedProductInput) => {
    const key =
      product.detailUrl ??
      `${product.title ?? 'produto'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingCategoryQueue.push({ product, key });
    const maybeFlush = flushCategoryQueue(false);
    if (maybeFlush) {
      maybeFlush.catch(async (error) => {
        aborted = true;
        await callbacks.onLog(`Falha ao processar lote de produtos: ${(error as Error).message}`, 'error');
        await cancelFetcher();
      });
    }
  };

  const handleDetail = async (preview: ProductPreview) => {
    if (aborted) return;
    if (processedUrls.has(preview.url)) return;
    processedUrls.add(preview.url);
    if (callbacks.shouldAbort && await callbacks.shouldAbort()) {
      aborted = true;
      await cancelFetcher();
      await callbacks.onLog('Processamento interrompido pelo usuário.', 'warn');
      return;
    }

    try {
      const product = await enrichProduct(preview, fetcher, callbacks, options, fetchAbortController.signal);
      enqueueProductForClassification(product);
    } catch (error) {
      if (isCancellationError(error)) {
        aborted = true;
        await cancelFetcher();
        await callbacks.onLog('Processamento cancelado durante a coleta de detalhes.', 'warn');
        return;
      }
      await callbacks.onLog(`Falha ao detalhar ${preview.title}: ${(error as Error).message}`, 'error', { url: preview.url });
    }
  };

  const scheduleDetailProcessing = (targetIndex: number) => {
    if (targetIndex <= scheduledDetailUntil) return;
    const sliceStart = scheduledDetailUntil;
    const sliceEnd = Math.min(targetIndex, previews.length);
    if (sliceEnd <= sliceStart) return;
    const slice = previews.slice(sliceStart, sliceEnd);
    scheduledDetailUntil = sliceEnd;
    detailChain = detailChain.then(async () => {
      if (aborted) return;
      await runWithConcurrency(slice, detailConcurrency, handleDetail);
    });
  };

  try {
    while (queue.length > 0) {
      if (callbacks.shouldAbort && await callbacks.shouldAbort()) {
        await callbacks.onLog('Processo de scraping cancelado.', 'warn');
        await cancelFetcher();
        break;
      }

      const currentUrl = queue.shift();
      if (!currentUrl || visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      await callbacks.onLog(`Processando catálogo: ${currentUrl}`);

      try {
        const html = await fetcher.fetchHtml(currentUrl, {
          allowDynamic: options.allowDynamicRendering,
          preferDynamic: options.preferDynamicCatalog ?? true,
          enhancePage: shouldEnhanceCatalog ? async ({ page, signal }) => autoExpandCatalogPage(page, signal) : undefined,
          abortSignal: fetchAbortController.signal,
        });
        const baseUrl = new URL(currentUrl);
        const $ = cheerio.load(html);

        const discovered = dedupePreviews([
          ...extractPreviewsFromJsonLd($, baseUrl),
          ...extractPreviewsFromDom($, baseUrl),
        ]);

        for (const preview of discovered) {
          if (previews.length >= maxProducts) break;
          if (!previews.find((p) => p.url === preview.url)) {
            previews.push(preview);
          }
        }

        const next = extractNextPageUrl($, baseUrl);
        if (next && !visited.has(next) && !queue.includes(next) && previews.length < maxProducts) {
          queue.push(next);
        }

        await callbacks.onLog(`Página processada com ${discovered.length} produtos identificados.`);

        while (previews.length - scheduledDetailUntil >= detailBatchSize) {
          scheduleDetailProcessing(scheduledDetailUntil + detailBatchSize);
        }

        if (previews.length >= maxProducts) break;
      } catch (error) {
        if (isCancellationError(error)) {
          await callbacks.onLog('Processamento cancelado durante a coleta do catálogo.', 'warn');
          await cancelFetcher();
          break;
        }
        await callbacks.onLog(`Falha ao processar ${currentUrl}: ${(error as Error).message}`, 'error');
      }
    }

    await callbacks.onLog(`Total de produtos encontrados: ${previews.length}`);
    if (callbacks.onDiscoveredTotal) {
      await callbacks.onDiscoveredTotal(previews.length);
    }

    while (previews.length - scheduledDetailUntil >= detailBatchSize) {
      scheduleDetailProcessing(scheduledDetailUntil + detailBatchSize);
    }
    scheduleDetailProcessing(previews.length);
    await detailChain;
    await flushCategoryQueue(true);

    return {
      totalDiscovered: previews.length,
      processed,
    };
  } finally {
    cancelWatcherActive = false;
    await cancelWatcher?.catch(() => undefined);
    await fetcher.close();
  }
}
