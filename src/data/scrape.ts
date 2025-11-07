import { Prisma, ScrapeJobStatus, Category } from '@prisma/client';
import { prisma } from '../db/prisma';
import { generateShortId } from '../utils/index';
import type { ScrapedProductInput } from '../lib/scraping/types';

export type ScrapeLogLevel = 'info' | 'warn' | 'error';

export interface ScrapeJobLogEntry {
  id: string;
  level: ScrapeLogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface CreateScrapeJobOptions {
  userId?: string | null;
  sourceUrl: string;
  mode?: string;
  initialLogMessage?: string;
}

export interface PersistScrapedProductOptions {
  commitToCatalog?: boolean;
  overwriteExisting?: boolean;
}

const MAX_LOG_ENTRIES = 500;

function nowIso(): string {
  return new Date().toISOString();
}

function asJsonArray(value: unknown): Prisma.JsonArray {
  if (Array.isArray(value)) {
    return value as Prisma.JsonArray;
  }
  return [];
}

function buildLogEntry(message: string, level: ScrapeLogLevel = 'info', context?: Record<string, unknown>): ScrapeJobLogEntry {
  return {
    id: generateShortId(12),
    level,
    message,
    timestamp: nowIso(),
    context,
  };
}

export async function createScrapeJobRecord(options: CreateScrapeJobOptions) {
  const { sourceUrl, userId = null, mode = 'full', initialLogMessage } = options;
  const logs: Prisma.JsonArray = initialLogMessage
    ? asJsonArray([buildLogEntry(initialLogMessage)])
    : asJsonArray([]);

  return prisma.scrapeJob.create({
    data: {
      sourceUrl,
      userId,
      mode,
      logs,
    },
  });
}

export async function getScrapeJobById(jobId: string) {
  return prisma.scrapeJob.findUnique({
    where: { id: jobId },
  });
}

export async function listScrapeJobs(limit = 20) {
  return prisma.scrapeJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function listScrapeResults(jobId: string) {
  return prisma.scrapeResult.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function setScrapeJobTotals(jobId: string, totals: { totalFound?: number | null; processed?: number | null }) {
  const data: Prisma.ScrapeJobUpdateInput = {};
  if (typeof totals.totalFound === 'number') {
    data.totalFound = totals.totalFound;
  }
  if (typeof totals.processed === 'number') {
    data.processed = totals.processed;
  }
  if (Object.keys(data).length === 0) {
    return;
  }
  await prisma.scrapeJob.update({ where: { id: jobId }, data });
}

export async function incrementScrapeJobProcessed(jobId: string) {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      processed: { increment: 1 },
    },
  });
}

export async function setScrapeJobStatus(jobId: string, status: ScrapeJobStatus) {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: status === 'done' || status === 'failed' || status === 'cancelled' ? new Date() : undefined,
    },
  });
}

export async function markScrapeJobFinished(jobId: string, status: Extract<ScrapeJobStatus, 'done' | 'cancelled' | 'failed'>) {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
    },
  });
}

export async function appendScrapeJobLog(jobId: string, entry: ScrapeJobLogEntry) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.scrapeJob.findUnique({
      where: { id: jobId },
      select: { logs: true },
    });

    const logs = asJsonArray(job?.logs);
    logs.push(entry as unknown as Prisma.JsonValue);

    const trimmed = logs.slice(-MAX_LOG_ENTRIES);

    await tx.scrapeJob.update({
      where: { id: jobId },
      data: {
        logs: trimmed,
      },
    });
  });
}

export async function setScrapeJobCancelRequested(jobId: string, cancelRequested: boolean) {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      cancelRequested,
    },
  });
}

export async function deleteFinishedScrapeJobs() {
  const deletableStatuses: ScrapeJobStatus[] = [ScrapeJobStatus.done, ScrapeJobStatus.failed, ScrapeJobStatus.cancelled];
  return prisma.scrapeJob.deleteMany({
    where: {
      status: {
        in: deletableStatuses,
      },
    },
  });
}

function createBaseSlug(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `produto-${generateShortId()}`;
}

async function ensureUniqueSlug(baseSlug: string, tx: Prisma.TransactionClient): Promise<string> {
  const normalized = baseSlug ? createBaseSlug(baseSlug) : createBaseSlug(`produto-${generateShortId()}`);
  let candidate = normalized;
  let counter = 1;

  while (await tx.product.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter++}`;
  }

  return candidate;
}

async function ensureUniqueCategorySlug(baseSlug: string, tx: Prisma.TransactionClient): Promise<string> {
  const normalized = baseSlug ? createBaseSlug(baseSlug) : createBaseSlug(`categoria-${generateShortId()}`);
  let candidate = normalized;
  let counter = 1;

  while (await tx.category.findUnique({ where: { slug: candidate } })) {
    candidate = `${normalized}-${counter++}`;
  }

  return candidate;
}

function normalizeCategoryNames(values?: (string | null | undefined)[]): string[] {
  if (!values?.length) return [];
  const map = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  }
  return Array.from(map.values());
}

async function ensureCategories(
  names: string[],
  tx: Prisma.TransactionClient
): Promise<Category[]> {
  const categories: Category[] = [];
  for (const name of names) {
    const existing = await tx.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      categories.push(existing);
      continue;
    }
    const slugBase = createBaseSlug(name);
    const slug = await ensureUniqueCategorySlug(slugBase, tx);
    const created = await tx.category.create({
      data: {
        name,
        slug,
      },
    });
    categories.push(created);
  }
  return categories;
}

function normalizeSku(sku?: string | null): string {
  const trimmed = sku?.trim();
  if (trimmed) return trimmed;
  return `SCRAPE-${generateShortId(10).toUpperCase()}`;
}

function toPriceCents(price?: number | null): number | null {
  if (typeof price !== 'number' || Number.isNaN(price)) return null;
  return Math.max(0, Math.round(price * 100));
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function persistScrapedProduct(jobId: string, payload: ScrapedProductInput, options: PersistScrapedProductOptions = {}) {
  const { commitToCatalog = true, overwriteExisting = true } = options;

  const priceCents = toPriceCents(payload.price);
  const sku = normalizeSku(payload.sku);
  const shortDescription = payload.shortDescription?.trim() || null;
  const longDescriptionHtml = payload.longDescriptionHtml?.trim() || null;
  const brand = payload.brand?.trim() || null;
  const normalizedCategories = normalizeCategoryNames(payload.categories);

  return prisma.$transaction(async (tx) => {
    let productId: string | null = null;
    let productRecord = null;
    let ensuredCategories: Category[] = [];

    if (commitToCatalog && normalizedCategories.length > 0) {
      ensuredCategories = await ensureCategories(normalizedCategories, tx);
    }
    const primaryCategoryId = ensuredCategories[0]?.id ?? null;

    if (commitToCatalog) {
      const existingBySku = await tx.product.findUnique({ where: { sku } });
      const slugBase = createBaseSlug(payload.title || sku);

      if (existingBySku && overwriteExisting) {
        const desiredStock = existingBySku.stockQuantity && existingBySku.stockQuantity > 0 ? existingBySku.stockQuantity : 99;
        const updateData: Prisma.ProductUpdateInput = {
          name: payload.title,
          brand: brand ?? '',
          description: shortDescription ?? payload.title,
          descriptionHtml: longDescriptionHtml,
          price: priceCents ?? existingBySku.price,
          stockQuantity: desiredStock,
        };
        if (primaryCategoryId) {
          updateData.category = { connect: { id: primaryCategoryId } };
        }
        productId = existingBySku.id;
        productRecord = await tx.product.update({
          where: { id: existingBySku.id },
          data: updateData,
        });

        if (payload.images?.length) {
          await tx.productImage.deleteMany({ where: { productId: existingBySku.id } });
          await tx.productImage.createMany({
            data: payload.images.map((url, index) => ({
              productId: existingBySku.id,
              url,
              position: index,
            })),
            skipDuplicates: true,
          });
        }
      } else if (existingBySku && !overwriteExisting) {
        productId = existingBySku.id;
        productRecord = existingBySku;
      } else {
        const slug = await ensureUniqueSlug(slugBase, tx);
        const createData: Prisma.ProductCreateInput = {
          name: payload.title,
          slug,
          brand: brand ?? '',
          sku,
          description: shortDescription ?? payload.title,
          descriptionHtml: longDescriptionHtml,
          price: priceCents ?? 0,
          compareAtPrice: null,
          stockQuantity: payload.stockQuantity ?? 99,
          active: true,
        };
        if (primaryCategoryId) {
          createData.category = { connect: { id: primaryCategoryId } };
        }
        const created = await tx.product.create({
          data: createData,
        });

        if (payload.images?.length) {
          await tx.productImage.createMany({
            data: payload.images.map((url, index) => ({
              productId: created.id,
              url,
              position: index,
            })),
          });
        }

        productId = created.id;
        productRecord = created;
      }
    }

    if (commitToCatalog && productId && ensuredCategories.length > 0) {
      if (overwriteExisting) {
        await tx.productCategory.deleteMany({
          where: {
            productId,
            categoryId: {
              notIn: ensuredCategories.map((category) => category.id),
            },
          },
        });
      }
      for (const [index, category] of ensuredCategories.entries()) {
        await tx.productCategory.upsert({
          where: {
            productId_categoryId: {
              productId,
              categoryId: category.id,
            },
          },
          create: {
            productId,
            categoryId: category.id,
            position: index,
          },
          update: {
            position: index,
          },
        });
      }
    }

    const result = await tx.scrapeResult.create({
      data: {
        jobId,
        productId,
        title: payload.title,
        brand,
        price: priceCents ?? undefined,
        sku,
        shortDescription,
        longDescriptionHtml,
        images: toJson(payload.images),
        categories: toJson(normalizedCategories),
        attributes: toJson(payload.attributes),
        raw: toJson(payload.raw),
      },
    });

    return { result, product: productRecord };
  });
}
