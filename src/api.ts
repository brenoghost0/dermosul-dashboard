import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import type { Prisma, CouponType } from '@prisma/client';

import {
  listOrders,
  getOrderById,
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
  lastNDays,
  updateLandingPageStatus,
  updateOrderStatusByExternalReference,
  getOrderByExternalReference,
  getStoreSettings,
  updateStoreSettings,
  listProducts,
  getProductById,
  upsertProduct,
  deleteProduct,
  listCategories,
  listCollections,
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getLuckyWheelSettings,
  updateLuckyWheelSettings,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from './data/index.js';
import { getPaymentProvider, PaymentRequest } from './lib/payment/index.js';
import { prisma } from './db/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { buildProductUrl } from './lib/url-builder.js';
import { buildStoreContext } from './lib/ai/context.js';
import { resolveOrderContext } from './lib/ai/order-context.js';
import { getOpenAIClient } from './lib/ai/openai.js';
import { getCachedValue, setCachedValue } from './lib/cache.js';
import { formatCurrencyBRL } from './utils/format.js';
import { encrypt } from './utils/crypto.js';
import scrapeRouter from './api/scrape-router.js';

const router = Router();

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const requireAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token malformado.' });
  }

  jwt.verify(token, process.env.SESSION_SECRET || 'super-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'forbidden', message: 'Token inválido.' });
    }
    next();
  });
};

// --- CONFIGURAÇÃO DO MULTER (UPLOAD) ---
const UPLOADS_DIR = path.join(process.cwd(), "backend", "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

router.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error("Apenas imagens (jpeg, jpg, png, gif) são permitidas."));
  }
});

// --- ROTAS COM MULTIPART/FORM-DATA (DEVEM VIR ANTES DO EXPRESS.JSON) ---

router.post("/landings", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, template } = req.body;

    if (!productTitle || !productPrice) {
      return res.status(400).json({ error: 'validation_failed', message: 'Título e Preço são campos obrigatórios.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'validation_failed', message: 'A imagem do produto é obrigatória.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    
    const newLandingPage = await createLandingPage({ 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true',
      imageUrl,
      template: template || 'MODELO_1'
    });
    res.status(201).json(newLandingPage);
  } catch (error: any) {
    console.error("Erro ao criar landing page:", error);
    res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao criar a landing page.' });
  }
});

router.put("/landings/:id", requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { productTitle, productDescription, productBrand, productPrice, shippingValue, freeShipping, template, imageUrl: existingImageUrl } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : existingImageUrl;

    const updatedLandingPage = await updateLandingPage(req.params.id, { 
      productTitle, 
      productDescription, 
      productBrand, 
      productPrice, 
      shippingValue, 
      freeShipping: String(freeShipping).toLowerCase() === 'true', 
      imageUrl,
      template: template || undefined
    });

    if (!updatedLandingPage) return res.status(404).json({ error: "Landing Page não encontrada." });
    res.json(updatedLandingPage);
  } catch (error: any) {
    console.error("Erro ao atualizar landing page:", error);
    res.status(500).json({ error: 'server_error', message: error.message || 'Ocorreu um erro inesperado ao atualizar a landing page.' });
  }
});


// --- APLICA O PARSER DE JSON PARA TODAS AS ROTAS ABAIXO ---
router.use(express.json());

router.use('/scrape', requireAuth, scrapeRouter);


router.get("/admin/store/settings", requireAuth, async (req, res) => {
  try {
    const settings = await getStoreSettings();
    res.json(settings);
  } catch (error: any) {
    console.error("[admin] Falha ao carregar configurações da loja", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar as configurações da loja." });
  }
});

router.put("/admin/store/settings", requireAuth, async (req, res) => {
  try {
    const payload = req.body ?? {};
    const updateData: Prisma.StoreSettingsUpdateInput = {};

    const stringFields: Array<keyof typeof payload> = [
      "defaultTitle",
      "defaultDescription",
      "metaImageUrl",
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "logoUrl",
      "faviconUrl",
      "appleTouchIconUrl"
    ];

    for (const field of stringFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        (updateData as any)[field] = payload[field] ?? null;
      }
    }

    const jsonFields: Array<keyof typeof payload> = [
      "typography",
      "textBlocks",
      "homeLayout",
      "seoSettings",
      "domainSettings",
      "integrations",
      "checkoutSettings"
    ];

    for (const field of jsonFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined) {
        (updateData as any)[field] = payload[field] as Prisma.InputJsonValue;
      }
    }

    const updated = await updateStoreSettings(updateData);
    res.json(updated);
  } catch (error: any) {
    console.error("[admin] Falha ao atualizar configurações da loja", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível salvar as configurações da loja." });
  }
});

router.get("/admin/lucky-wheel", requireAuth, async (_req, res) => {
  try {
    const settings = await getLuckyWheelSettings();
    res.json(settings);
  } catch (error: any) {
    console.error("[admin] Falha ao carregar roleta da sorte", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar a roleta da sorte." });
  }
});

router.put("/admin/lucky-wheel", requireAuth, async (req, res) => {
  try {
    const payload = req.body ?? {};
    const updated = await updateLuckyWheelSettings(payload);
    res.json(updated);
  } catch (error: any) {
    console.error("[admin] Falha ao salvar a roleta da sorte", error);
    const code = error?.code === "invalid_configuration" ? 422 : 400;
    res.status(code).json({ error: "lucky_wheel_update_failed", message: error?.message || "Não foi possível salvar a roleta da sorte." });
  }
});

// --- HELPERS ADMIN PRODUTOS ---

const toAbsoluteAdminUrl = (req: Request, url?: string | null) => {
  if (!url) return url ?? null;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url.replace(/^\/+/, "")}`;
  return `${req.protocol}://${req.get("host")}${normalized}`;
};

const mapProductAssets = <T extends { images?: Array<{ url: string | null }>; imageUrl?: string | null }>(req: Request, product: T): T => {
  const images = (product.images ?? []).map((image, index) => ({
    ...image,
    url: toAbsoluteAdminUrl(req, image?.url ?? null),
    position: (image as any)?.position ?? index,
  }));
  const imageUrl = toAbsoluteAdminUrl(req, product.imageUrl ?? images[0]?.url ?? null);
  return {
    ...product,
    images,
    imageUrl,
  };
};

const parseBooleanInput = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "on", "yes"].includes(normalized)) return true;
    if (["0", "false", "off", "no"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value === 1;
  return fallback;
};

const parseIntegerInput = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
};

const parseCurrencyToCents = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const normalized = value
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(parsed * 100);
  }
  return null;
};

const normalizeIdList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [] as string[];
};

const sanitizeCouponPayload = (body: any) => {
  if (!body || typeof body !== "object") {
    throw new Error("Envie os campos do cupom.");
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!code) {
    throw new Error("Informe o código do cupom.");
  }
  const type: CouponType = String(body.type || "").toUpperCase() === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const rawValue = body.value;
  const amountValue = type === "AMOUNT" ? parseCurrencyToCents(rawValue) : parseIntegerInput(rawValue);
  if (!amountValue || amountValue <= 0) {
    throw new Error("Informe o valor de desconto do cupom.");
  }
  const minSubtotal = parseCurrencyToCents(body.minSubtotalCents);
  const maxDiscount = parseCurrencyToCents(body.maxDiscountCents);
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (startsAt && Number.isNaN(Number(startsAt))) {
    throw new Error("Data inicial inválida.");
  }
  if (endsAt && Number.isNaN(Number(endsAt))) {
    throw new Error("Data final inválida.");
  }
  return {
    code,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : null,
    description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
    type,
    value: amountValue,
    freeShipping: parseBooleanInput(body.freeShipping),
    autoApply: parseBooleanInput(body.autoApply),
    stackable: parseBooleanInput(body.stackable),
    newCustomerOnly: parseBooleanInput(body.newCustomerOnly),
    usageLimit: parseIntegerInput(body.usageLimit),
    perCustomerLimit: parseIntegerInput(body.perCustomerLimit),
    minSubtotalCents: minSubtotal,
    maxDiscountCents: maxDiscount,
    startsAt: startsAt ?? null,
    endsAt: endsAt ?? null,
    targetProductIds: normalizeIdList(body.targetProductIds),
    targetCollectionIds: normalizeIdList(body.targetCollectionIds),
    targetCategoryIds: normalizeIdList(body.targetCategoryIds),
    excludedProductIds: normalizeIdList(body.excludedProductIds),
    active: parseBooleanInput(body.active, true),
  };
};

const parseBooleanParam = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return undefined;
};

const parseNumberParam = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function normalizeProductPayload(body: any, id?: string) {
  if (!body || typeof body !== "object") {
    throw new Error("Payload inválido para produto.");
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new Error("Informe o nome do produto.");

  const rawSlug = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = rawSlug || slugify(name);
  if (!slug) throw new Error("Informe o slug do produto.");

  const sku = typeof body.sku === "string" ? body.sku.trim() : "";
  if (!sku) throw new Error("Informe o SKU do produto.");

  const price = Number(body.price);
  if (!Number.isFinite(price)) throw new Error("Informe o preço em centavos do produto.");

  const compareAtPriceRaw = body.compareAtPrice;
  const compareAtPrice =
    compareAtPriceRaw === undefined || compareAtPriceRaw === null || compareAtPriceRaw === ""
      ? null
      : Number(compareAtPriceRaw);
  if (compareAtPrice !== null && !Number.isFinite(compareAtPrice)) {
    throw new Error("Informe um preço cheio válido.");
  }

  const stockQuantity = Number(body.stockQuantity ?? 0);
  if (!Number.isFinite(stockQuantity)) {
    throw new Error("Informe um estoque válido.");
  }

  const images = Array.isArray(body.images)
    ? body.images
        .map((image: any, index: number) => {
          const url = typeof image?.url === "string" ? image.url.trim() : "";
          if (!url) return null;
          return {
            url,
            alt: typeof image?.alt === "string" ? image.alt : null,
            position: Number.isFinite(Number(image?.position)) ? Number(image.position) : index,
          };
        })
        .filter(Boolean)
    : [];

  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.map((value: any) => String(value)) : [];
  const collectionIds = Array.isArray(body.collectionIds) ? body.collectionIds.map((value: any) => String(value)) : [];

  return {
    id,
    name,
    slug,
    brand: typeof body.brand === "string" ? body.brand : "",
    sku,
    description: typeof body.description === "string" ? body.description : "",
    descriptionHtml:
      typeof body.descriptionHtml === "string" && body.descriptionHtml.trim() ? body.descriptionHtml : null,
    price: Math.max(Math.round(price), 0),
    compareAtPrice: compareAtPrice === null ? null : Math.max(Math.round(compareAtPrice), 0),
    stockQuantity: Math.max(Math.round(stockQuantity), 0),
    active: body.active === undefined ? true : Boolean(body.active),
    images,
    categoryIds,
    collectionIds,
  };
}

function normalizeBannerPayload(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Payload inválido para banner.");
  }

  const kindRaw = typeof body.kind === "string" && body.kind.trim() ? body.kind.trim().toUpperCase() : "HERO";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const subtitle = typeof body.subtitle === "string" ? body.subtitle.trim() : "";
  const ctaLabel = typeof body.ctaLabel === "string" ? body.ctaLabel.trim() : "";
  const ctaLink = typeof body.ctaLink === "string" ? body.ctaLink.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const mobileImageUrl = typeof body.mobileImageUrl === "string" ? body.mobileImageUrl.trim() : "";
  const positionRaw = Number(body.position);
  const activeRaw = body.active;

  if (!imageUrl) {
    throw new Error("Informe a URL da imagem desktop.");
  }

  return {
    kind: kindRaw,
    title,
    subtitle: subtitle || null,
    ctaLabel: ctaLabel || null,
    ctaLink: ctaLink || null,
    imageUrl,
    mobileImageUrl: mobileImageUrl || null,
    position: Number.isFinite(positionRaw) ? Math.max(Math.round(positionRaw), 0) : 0,
    active: activeRaw === undefined ? true : Boolean(activeRaw),
  } as const;
}

// --- ROTAS ADMIN PRODUTOS ---

router.get("/admin/store/products", async (req, res) => {
  try {
    const data = await listProducts({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      categoryId: typeof req.query.categoryId === "string" ? req.query.categoryId : undefined,
      collectionId: typeof req.query.collectionId === "string" ? req.query.collectionId : undefined,
      active: parseBooleanParam(req.query.active),
      page: parseNumberParam(req.query.page),
      pageSize: parseNumberParam(req.query.pageSize),
      sort: typeof req.query.sort === "string" ? (req.query.sort as any) : undefined,
    });

    const items = data.items.map((item) => mapProductAssets(req, item));
    res.json({ ...data, items });
  } catch (error: any) {
    console.error("[admin] Falha ao listar produtos", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar os produtos." });
  }
});

router.get("/admin/store/products/:id", async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "not_found", message: "Produto não encontrado." });
    }
    res.json(mapProductAssets(req, product));
  } catch (error: any) {
    console.error("[admin] Falha ao carregar produto", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar o produto." });
  }
});

router.post("/admin/store/products", async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body ?? {});
    const created = await upsertProduct(payload);
    if (!created) {
      throw new Error("Falha ao criar produto.");
    }
    res.status(201).json(mapProductAssets(req, created));
  } catch (error: any) {
    console.error("[admin] Falha ao criar produto", error);
    const message = error?.message || "Não foi possível criar o produto.";
    res.status(400).json({ error: "validation_failed", message });
  }
});

router.put("/admin/store/products/:id", async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body ?? {}, req.params.id);
    const updated = await upsertProduct(payload);
    if (!updated) {
      return res.status(404).json({ error: "not_found", message: "Produto não encontrado." });
    }
    res.json(mapProductAssets(req, updated));
  } catch (error: any) {
    console.error("[admin] Falha ao atualizar produto", error);
    const status = error?.message?.includes("não encontrado") ? 404 : 400;
    const message = error?.message || "Não foi possível atualizar o produto.";
    res.status(status).json({ error: status === 404 ? "not_found" : "validation_failed", message });
  }
});

router.delete("/admin/store/products/:id", async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[admin] Falha ao remover produto", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível remover o produto." });
  }
});

router.get("/admin/store/banners", async (req, res) => {
  try {
    const kind = typeof req.query.kind === "string" && req.query.kind.trim() ? req.query.kind.trim().toUpperCase() : undefined;
    const active = parseBooleanParam(req.query.active);
    const banners = await listBanners({ kind, activeOnly: active });
    res.json(banners);
  } catch (error: any) {
    console.error("[admin] Falha ao listar banners", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar os banners." });
  }
});

router.post("/admin/store/banners", async (req, res) => {
  try {
    const payload = normalizeBannerPayload(req.body ?? {});
    const created = await createBanner(payload);
    res.status(201).json(created);
  } catch (error: any) {
    console.error("[admin] Falha ao criar banner", error);
    res.status(400).json({ error: "validation_failed", message: error?.message || "Não foi possível criar o banner." });
  }
});

router.put("/admin/store/banners/:id", async (req, res) => {
  try {
    const payload = normalizeBannerPayload(req.body ?? {});
    const updated = await updateBanner(req.params.id, payload);
    res.json(updated);
  } catch (error: any) {
    console.error("[admin] Falha ao atualizar banner", error);
    const message = error?.message || "Não foi possível atualizar o banner.";
    const status = message.toLowerCase().includes("não encontrado") ? 404 : 400;
    res.status(status).json({ error: status === 404 ? "not_found" : "validation_failed", message });
  }
});

router.delete("/admin/store/banners/:id", async (req, res) => {
  try {
    await deleteBanner(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[admin] Falha ao remover banner", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível remover o banner." });
  }
});

router.post("/admin/store/products/adjust-prices", async (req, res) => {
  try {
    const percentageRaw = req.body?.percentage;
    const parsed = Number(percentageRaw);
    if (!Number.isFinite(parsed) || parsed === 0) {
      return res
        .status(400)
        .json({ error: "validation_failed", message: "Informe um percentual numérico diferente de zero." });
    }
    const multiplier = 1 + parsed / 100;
    if (multiplier <= 0) {
      return res
        .status(400)
        .json({ error: "validation_failed", message: "O ajuste informado deixaria os preços negativos." });
    }

    const products = await prisma.product.findMany({
      select: { id: true, price: true, compareAtPrice: true },
    });

    let updatedCount = 0;
    for (const product of products) {
      const nextPrice = Math.max(Math.round(product.price * multiplier), 0);
      const nextCompare =
        product.compareAtPrice !== null
          ? Math.max(Math.round(product.compareAtPrice * multiplier), nextPrice)
          : null;
      if (nextPrice === product.price && nextCompare === product.compareAtPrice) continue;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          price: nextPrice,
          compareAtPrice: nextCompare,
        },
      });
      updatedCount++;
    }

    res.json({ success: true, updated: updatedCount });
  } catch (error: any) {
    console.error("[admin] Falha ao ajustar preços em massa", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível ajustar os preços." });
  }
});

router.get("/admin/store/categories", async (_req, res) => {
  try {
    const categories = await listCategories();
    res.json(categories);
  } catch (error: any) {
    console.error("[admin] Falha ao listar categorias", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar as categorias." });
  }
});

router.get("/admin/store/collections", async (_req, res) => {
  try {
    const collections = await listCollections();
    res.json(collections);
  } catch (error: any) {
    console.error("[admin] Falha ao listar coleções", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar as coleções." });
  }
});

router.get("/admin/store/coupons", requireAuth, async (_req, res) => {
  try {
    const coupons = await listCoupons();
    res.json(coupons);
  } catch (error: any) {
    console.error("[admin] Falha ao listar cupons", error);
    res.status(500).json({ error: "server_error", message: error?.message || "Não foi possível carregar os cupons." });
  }
});

router.post("/admin/store/coupons", requireAuth, async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    const created = await createCoupon(payload);
    res.status(201).json(created);
  } catch (error: any) {
    console.error("[admin] Falha ao criar cupom", error);
    res
      .status(400)
      .json({ error: "coupon_save_failed", message: error?.message || "Não foi possível salvar este cupom." });
  }
});

router.put("/admin/store/coupons/:id", requireAuth, async (req, res) => {
  try {
    const payload = sanitizeCouponPayload(req.body);
    const updated = await updateCoupon(req.params.id, payload);
    res.json(updated);
  } catch (error: any) {
    console.error("[admin] Falha ao atualizar cupom", error);
    res
      .status(400)
      .json({ error: "coupon_update_failed", message: error?.message || "Não foi possível atualizar este cupom." });
  }
});

router.delete("/admin/store/coupons/:id", requireAuth, async (req, res) => {
  try {
    await deleteCoupon(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[admin] Falha ao remover cupom", error);
    res
      .status(400)
      .json({ error: "coupon_delete_failed", message: error?.message || "Não foi possível remover este cupom." });
  }
});

// --- CHAT ASSISTENTE VIRTUAL ---

type ChatMessage = { role: "user" | "assistant"; content: string };
type SuggestedProduct = {
  name: string;
  price?: string | null;
  url: string;
  image?: string | null;
  slug?: string | null;
  id?: string | null;
};

type ProductMemoryEntry = {
  id?: string | null;
  slug?: string | null;
  name: string;
  description?: string | null;
  price?: string | null;
  rank?: number;
};

type ProductMemory = {
  lastBatch: ProductMemoryEntry[];
  recent: ProductMemoryEntry[];
  awaitingLinkConfirmation?: boolean;
};

const STORE_CONTEXT_CACHE_KEY = "store_ai_context_v1";
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const LINK_SIGNAL_WORDS = ["link", "manda", "envia", "me passa", "pode mandar", "pode enviar"];

const GREETING_CANDIDATES = [
  "oi",
  "olá",
  "ola",
  "oii",
  "oie",
  "bom dia",
  "boa tarde",
  "boa noite",
  "hey",
  "e ai",
  "e aí",
];

const ORDINAL_KEYWORDS: Record<string, number> = {
  primeiro: 0,
  "1": 0,
  "1º": 0,
  segundo: 1,
  "2": 1,
  "2º": 1,
  terceiro: 2,
  terceira: 2,
  "3": 2,
  "3º": 2,
  ultimo: -1,
  última: -1,
  ultima: -1,
};

const SKIN_KEYWORDS: Record<string, string[]> = {
  oleosa: ["oleosa", "oleo", "oleosidade", "brilho"],
  seca: ["seca", "ressecada", "ressecamento"],
  mista: ["mista", "zona t", "zona-t"],
  sensivel: ["sensivel", "sensível", "irritada", "vermelhidão", "vermelhidao"],
  acneica: ["acne", "espinha", "acneica", "poros"],
};

const CONCERN_KEYWORDS: Record<string, string[]> = {
  manchas: ["mancha", "melasma", "uniformizar", "hiperpigmentacao", "hiperpigmentação"],
  antiidade: ["ruga", "linhas", "anti-idade", "antissinais", "expressao"],
  hidratacao: ["hidratar", "hidratação", "hidratacao", "barreira", "ressecada"],
  firmeza: ["flacidez", "firmeza", "elasticidade"],
  brilho: ["luminosidade", "glow", "iluminar"],
};

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .trim();
}

function extractBaseOverride(req: Request): string | undefined {
  const origin = req.get("origin");
  if (origin) return origin;
  const referer = req.get("referer");
  if (!referer) return undefined;
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return undefined;
  }
}

function isSimpleGreeting(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (normalized.length > 40) return false;
  const stripped = normalized.replace(/[!?.]+$/, "");
  if (GREETING_CANDIDATES.includes(stripped)) return true;
  if (stripped.startsWith("bom dia") || stripped.startsWith("boa tarde") || stripped.startsWith("boa noite")) {
    return stripped.split(/\s+/).length <= 4;
  }
  if (stripped.startsWith("oi") && stripped.split(/\s+/).length <= 3) {
    return true;
  }
  return false;
}

function detectsLinkRequest(message: string): boolean {
  const normalized = normalizeText(message);
  if (!normalized.includes("link")) return false;
  return LINK_SIGNAL_WORDS.some((word) => normalized.includes(word));
}

function resolveOrdinalFromText(message: string): number | null {
  const normalized = normalizeText(message);
  for (const [key, value] of Object.entries(ORDINAL_KEYWORDS)) {
    if (normalized.includes(key)) return value;
  }
  return null;
}

async function loadStoreContext() {
  try {
    const cached = await getCachedValue<Awaited<ReturnType<typeof buildStoreContext>>>(STORE_CONTEXT_CACHE_KEY);
    if (cached) return cached;
  } catch (error) {
    console.warn("[chat] falha ao ler cache de contexto", error);
  }

  const context = await buildStoreContext();
  try {
    await setCachedValue(STORE_CONTEXT_CACHE_KEY, context, 60 * 5);
  } catch (error) {
    console.warn("[chat] falha ao salvar cache de contexto", error);
  }
  return context;
}

async function logChatMessage(
  sessionId: string,
  role: "USER" | "ASSISTANT",
  content: string,
  origin?: string | null,
  metadata?: Prisma.InputJsonValue
) {
  try {
    await prisma.chatMessageLog.create({
      data: {
        sessionId,
        role,
        content,
        origin: origin ?? null,
        metadata: metadata ? metadata : undefined,
      },
    });
  } catch (error) {
    console.warn("[chat] falha ao salvar log", error);
  }
}

async function recommendProducts(message: string, baseOverride?: string | null): Promise<SuggestedProduct[]> {
  const normalized = normalizeText(message);
  const where: Prisma.ProductWhereInput = { active: true };
  const or: Prisma.ProductWhereInput[] = [];

  Object.values(SKIN_KEYWORDS).forEach((variants) => {
    if (variants.some((token) => normalized.includes(token))) {
      variants.forEach((token) => {
        or.push({ description: { contains: token, mode: "insensitive" } });
        or.push({ name: { contains: token, mode: "insensitive" } });
      });
    }
  });

  Object.values(CONCERN_KEYWORDS).forEach((variants) => {
    if (variants.some((token) => normalized.includes(token))) {
      variants.forEach((token) => {
        or.push({ description: { contains: token, mode: "insensitive" } });
        or.push({ name: { contains: token, mode: "insensitive" } });
      });
    }
  });

  const genericTokens = ["serum", "sérum", "limpador", "cleanser", "creme", "mascara", "máscara", "tonico", "tônico", "protetor", "hidratante"];
  genericTokens.forEach((token) => {
    if (normalized.includes(token)) {
      or.push({ name: { contains: token, mode: "insensitive" } });
      or.push({ description: { contains: token, mode: "insensitive" } });
    }
  });

  if (or.length) where.OR = or;

  let products = await prisma.product.findMany({
    where,
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    orderBy: [{ updatedAt: 'desc' }],
    take: 3,
  });

  if (!products.length) {
    products = await prisma.product.findMany({
      where: { active: true },
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      orderBy: [{ createdAt: 'desc' }],
      take: 3,
    });
  }

  return products.map((product) => ({
    name: product.name,
    price: formatCurrencyBRL(product.price),
    url: buildProductUrl({ slug: product.slug }, { baseOverride }),
    image: product.images[0]?.url ?? null,
    slug: product.slug,
    id: product.id,
  }));
}

function updateProductMemory(session: Request["session"], key: string, suggestions: SuggestedProduct[]) {
  if (!session.chatProductMemory) {
    session.chatProductMemory = {};
  }
  const store = session.chatProductMemory as Record<string, ProductMemory>;
  const memory: ProductMemory = store[key] ?? { lastBatch: [], recent: [] };

  memory.lastBatch = suggestions.map((product, index) => ({
    id: product.id ?? null,
    slug: product.slug ?? null,
    name: product.name,
    price: product.price ?? null,
    rank: index + 1,
  }));

  const newRecent: ProductMemoryEntry[] = [...memory.recent];
  suggestions.forEach((product) => {
    const existing = newRecent.find((item) => item.name === product.name);
    if (!existing) {
      newRecent.push({
        name: product.name,
        price: product.price ?? null,
        id: product.id ?? null,
        slug: product.slug ?? null,
      });
    }
  });

  memory.recent = newRecent.slice(-10);
  memory.awaitingLinkConfirmation = true;
  store[key] = memory;
}

function resolveProductFromMemory(message: string, session: Request["session"], key: string, baseOverride?: string | null): SuggestedProduct | null {
  const memStore = session.chatProductMemory;
  if (!memStore) return null;
  const memory = memStore[key];
  if (!memory) return null;

  const normalized = normalizeText(message);
  if (!normalized.includes("link")) return null;

  let chosen: ProductMemoryEntry | undefined;
  const ordinal = resolveOrdinalFromText(message);
  if (typeof ordinal === "number" && memory.lastBatch.length) {
    if (ordinal === -1) {
      chosen = memory.lastBatch[memory.lastBatch.length - 1];
    } else {
      chosen = memory.lastBatch[ordinal];
    }
  }

  if (!chosen) {
    chosen = [...memory.lastBatch, ...memory.recent].find((item) => {
      const nameNorm = normalizeText(item.name);
      return nameNorm && normalized.includes(nameNorm.slice(0, Math.min(nameNorm.length, 12)));
    });
  }

  if (!chosen && memory.awaitingLinkConfirmation && memory.lastBatch.length) {
    chosen = memory.lastBatch[0];
  }

  if (!chosen && memory.recent.length) {
    chosen = memory.recent[memory.recent.length - 1];
  }

  if (!chosen) return null;

  memory.awaitingLinkConfirmation = false;
  memStore[key] = memory;

  return {
    name: chosen.name,
    price: chosen.price ?? null,
    url: buildProductUrl({ slug: chosen.slug ?? undefined, id: chosen.id ?? undefined }, { baseOverride }),
  };
}

function summarizeOrders(orders: Awaited<ReturnType<typeof resolveOrderContext>>): string {
  if (!orders.orders.length) return "";
  return orders.orders
    .map((order) => {
      const items = order.items.map((item) => `• ${item.qty}× ${item.name}`).join("\n");
      const destination = order.destination ? `${order.destination}\n` : "";
      return [
        `Pedido #${order.code}`,
        `Status: ${order.statusLabel}`,
        `Atualizado: ${order.updatedAt}`,
        `Total: ${order.total}`,
        order.paymentInfo,
        destination,
        items,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function resolveInfoRequest(message: string, storeContext: Awaited<ReturnType<typeof buildStoreContext>>): string | null {
  const normalized = normalizeText(message);
  const contact = storeContext.settings?.contact ?? {};
  if (normalized.includes("horario") || normalized.includes("horário")) {
    if (contact.serviceHours) {
      return `Estamos disponíveis ${contact.serviceHours}. Me conta como posso te ajudar agora 💜`;
    }
  }
  if (normalized.includes("telefone") || normalized.includes("whats")) {
    if (contact.phone) {
      return `Se preferir, temos WhatsApp ${contact.phone}. Posso resolver algo por aqui para você?`;
    }
  }
  if (normalized.includes("email") || normalized.includes("e-mail")) {
    if (contact.email) {
      return `Você pode nos escrever em ${contact.email}. Enquanto isso, posso adiantar algo pra você por aqui?`;
    }
  }
  if (normalized.includes("endereco") || normalized.includes("endereço")) {
    if (contact.address) {
      return `Nosso endereço é ${contact.address}. Conta comigo também aqui no chat para o que precisar 💜`;
    }
  }
  return null;
}

async function generateLLMReply(
  conversation: ChatMessage[],
  storeContext: Awaited<ReturnType<typeof buildStoreContext>>
): Promise<string | null> {
  try {
    const client = await getOpenAIClient();
    const history = conversation.slice(-12).map(({ role, content }) => ({ role, content }));

    const contact = storeContext.settings?.contact ?? {};
    const storeSummary = [
      `Nome: ${storeContext.settings?.title || "Dermosul"}`,
      contact.email ? `E-mail: ${contact.email}` : null,
      contact.phone ? `Telefone: ${contact.phone}` : null,
      contact.serviceHours ? `Horário: ${contact.serviceHours}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const productsSummary = storeContext.products
      .map((product) => `• ${product.name} (${product.price}) — ${product.categories.slice(0, 2).join(", ")}`)
      .join("\n");

    const systemPrompt = `Você é uma dermatologista virtual altamente qualificada e empática da Dermosul, conversando como uma médica real em consultório. Foque em entender profundamente o cliente antes de sugerir qualquer produto. Siga estas diretrizes:
1. Fale em português brasileiro, com linguagem humana, calma e acessível; adapte o tom ao nível de conhecimento do cliente.
2. Investigue antes de recomendar: idade, tipo de pele, condições (acne, manchas, melasma, rosácea, rugas, sensibilidade etc.), objetivos (hidratar, clarear, prevenir envelhecimento, tratar espinhas etc.), rotina atual e preferências/restrições (sem fragrância, vegano, dermatológico).
3. Nunca inicie oferecendo produtos; só recomende quando o cliente pedir ou após confirmar que deseja sugestões.
4. Ao indicar algo, explique por que serve, quais benefícios entrega e como usar, sempre de modo educacional e nada comercial.
5. Foque em orientação dermatológica, esclareça dúvidas e mantenha postura médica consultiva.
6. Use até dois emojis quando fizer sentido (💜✨🌿) e nunca mencione que é uma IA.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Dados da loja:\n${storeSummary}\n\nProdutos em destaque:\n${productsSummary}` },
      ...history,
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      messages,
    });

    const choiceMessage = completion.choices?.[0]?.message as { content?: unknown } | undefined;
    const messageContent = choiceMessage?.content;
    if (!messageContent) return null;
    if (typeof messageContent === "string") {
      return messageContent.trim() || null;
    }
    if (Array.isArray(messageContent)) {
      const text = (messageContent as Array<{ text?: string }>)
        .map((chunk) => chunk.text ?? "")
        .join("")
        .trim();
      return text || null;
    }
    return null;
  } catch (error) {
    console.warn("[chat] falha ao chamar OpenAI", error);
    return null;
  }
}

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "validation_failed", message: "Informe a mensagem do cliente." });
    }

    const sanitizedMessage = message.trim();
    const baseOverride = extractBaseOverride(req);
    const originHeader = req.get("origin") || req.get("referer") || null;
    const effectiveSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : req.sessionID;

    if (!effectiveSessionId) {
      return res.status(500).json({ error: "server_error", message: "Não foi possível criar a sessão do chat." });
    }

    if (!req.session.chatSessions) {
      req.session.chatSessions = {};
    }
    const chatSessions = req.session.chatSessions;
    const conversation: ChatMessage[] = chatSessions[effectiveSessionId] ? [...chatSessions[effectiveSessionId]] : [];

    conversation.push({ role: "user", content: sanitizedMessage });
    chatSessions[effectiveSessionId] = conversation.slice(-40);

    await logChatMessage(effectiveSessionId, "USER", sanitizedMessage, originHeader);

    const storeContext = await loadStoreContext();

    if (isSimpleGreeting(sanitizedMessage)) {
      const greeting =
        "Olá! 💜 Que bom ter você por aqui. Como posso cuidar de você hoje? Posso consultar pedidos, recomendar produtos ou tirar dúvidas.";
      conversation.push({ role: "assistant", content: greeting });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(effectiveSessionId, "ASSISTANT", greeting, originHeader);
      return res.json({ reply: greeting });
    }

    const memoryLink = resolveProductFromMemory(sanitizedMessage, req.session, effectiveSessionId, baseOverride);
    if (detectsLinkRequest(sanitizedMessage) && memoryLink) {
      const reply = `Aqui está 💜 clique aqui: ${memoryLink.url}`;
      conversation.push({ role: "assistant", content: reply });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(
        effectiveSessionId,
        "ASSISTANT",
        reply,
        originHeader,
        { product: memoryLink } as Prisma.InputJsonValue
      );
      return res.json({ reply });
    }

    const infoReply = resolveInfoRequest(sanitizedMessage, storeContext);
    if (infoReply) {
      conversation.push({ role: "assistant", content: infoReply });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(effectiveSessionId, "ASSISTANT", infoReply, originHeader);
      return res.json({ reply: infoReply });
    }

    const orderResolution = await resolveOrderContext(sanitizedMessage);
    if (orderResolution.needsIdentifier) {
      const reply =
        "Claro 💜 me envia o número do pedido (pode ser com #) para eu conferir o status certinho pra você.";
      conversation.push({ role: "assistant", content: reply });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(effectiveSessionId, "ASSISTANT", reply, originHeader);
      return res.json({ reply });
    }
    if (orderResolution.orders.length) {
      const summary = summarizeOrders(orderResolution);
      const reply = `${orderResolution.orders.length > 1 ? "Encontrei estes pedidos" : "Encontrei seu pedido"}:\n\n${summary}\n\nPosso acompanhar mais alguma etapa para você?`;
      conversation.push({ role: "assistant", content: reply });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(
        effectiveSessionId,
        "ASSISTANT",
        reply,
        originHeader,
        { orders: orderResolution.orders } as Prisma.InputJsonValue
      );
      return res.json({ reply });
    }
    if (orderResolution.requestedCodes.length) {
      const reply =
        "Não encontrei esse pedido 😕 Pode conferir se o código está correto ou se foi feito com outro e-mail? Se tiver outro número, me manda que eu consulto rapidinho.";
      conversation.push({ role: "assistant", content: reply });
      chatSessions[effectiveSessionId] = conversation.slice(-40);
      await logChatMessage(
        effectiveSessionId,
        "ASSISTANT",
        reply,
        originHeader,
        { requestedCodes: orderResolution.requestedCodes } as Prisma.InputJsonValue
      );
      return res.json({ reply });
    }

    const suggestions: SuggestedProduct[] = [];

    const llmReply = await generateLLMReply(conversation, storeContext);
    let reply = llmReply;

    if (!reply) {
      reply =
        "Estou aqui pra cuidar de tudo com você 💜 Posso acompanhar pedidos, sugerir produtos e explicar qualquer política. Me conta como posso ajudar.";
    }

    conversation.push({ role: "assistant", content: reply });
    chatSessions[effectiveSessionId] = conversation.slice(-40);

    await logChatMessage(
      effectiveSessionId,
      "ASSISTANT",
      reply,
      originHeader,
      undefined
    );

    return res.json({
      reply,
      suggestedProducts: undefined,
    });
  } catch (error) {
    console.error("[chat] erro inesperado", error);
    return res.status(500).json({
      error: "server_error",
      message: "Não consegui responder agora, mas já estou ajustando aqui. Pode tentar novamente em instantes?",
    });
  }
});


// --- ROTAS PÚBLICAS (CONSUMIDAS PELA LANDING PAGE) ---

router.get('/landings/:slug', async (req: Request, res: Response) => {
  try {
    const lp = await getLandingBySlug(req.params.slug);
    if (!lp) return res.status(404).json({ error: 'not_found' });
    res.json(lp);
  } catch (e: any) {
    console.error('GET /api/landings/:slug', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- EXPORTAÇÃO DE PEDIDOS EM CSV ---

router.get('/orders/export', requireAuth, async (req: Request, res: Response) => {
  try {
    // Força um pageSize grande para exportar todos os resultados do filtro atual
    const params = { ...req.query, page: 1, pageSize: 100000 } as any;
    const data = await listOrders(params);

    // Define colunas e gera CSV simples
    const headers = [
      'createdAt',
      'id',
      'fullId',
      'client',
      'category',
      'status',
      'total',
      'paymentMethod',
      'lpStatus'
    ];

    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Aspas duplas escapadas conforme CSV
      const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n');
      const escaped = s.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    };

    const rows = [headers.join(',')].concat(
      (data.items || []).map((o: any) => [
        o.createdAt,
        o.id,
        o.fullId,
        o.client,
        o.category,
        o.status,
        o.total,
        o.paymentMethod || 'desconhecido',
        o.lpStatus || ''
      ].map(esc).join(','))
    );

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pedidos.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Erro ao exportar CSV:', error);
    res.status(500).json({ error: 'server_error', message: 'Falha ao exportar CSV.' });
  }
});

router.post('/orders/public', async (req: Request, res: Response) => {
  try {
    const order = await createPublicOrder(req.body);
    res.status(201).json(order);
  } catch (e: any) {
    if (e.details) {
      return res.status(400).json({ error: 'validation_failed', details: e.details });
    }
    const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
    res.status(500).json({ error: 'creation_failed', message: errorMessage });
  }
});

router.get('/orders/by-reference/:ref', async (req: Request, res: Response) => {
  try {
    const order = await getOrderByExternalReference(req.params.ref);
    if (!order) {
      return res.status(404).json({ error: 'not_found', message: 'Pedido não encontrado.' });
    }
    res.json(order);
  } catch (e: any) {
    console.error('GET /api/orders/by-reference/:ref', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// --- ROTAS DE PAGAMENTO (GATEWAY) ---

router.post('/payments/credit-card', async (req: Request, res: Response) => {
  try {
    const paymentRequest: PaymentRequest = req.body;
    const paymentProvider = getPaymentProvider();
    const result = await paymentProvider.processPayment(paymentRequest);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing credit card payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payments/pix', async (req: Request, res: Response) => {
  try {
    const paymentRequest: PaymentRequest = req.body;
    const paymentProvider = getPaymentProvider();
    const result = await paymentProvider.createPixPayment(paymentRequest);
    res.json(result);
  } catch (error: any) {
    console.error('Error creating PIX payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ENDPOINTS DE TESTE (somente quando habilitado por env) ---
if (process.env.ENABLE_PAYMENT_TEST_ENDPOINTS === 'true') {
  router.post('/payments/test/mark-paid', async (req: Request, res: Response) => {
    try {
      const { externalReference } = (req.body || {}) as { externalReference?: string };
      if (externalReference) {
        const updated = await updateOrderStatusByExternalReference(externalReference, 'pago');
        return res.json({ success: true, updatedId: updated?.id || null, externalReference });
      }
      const latest = await prisma.order.findFirst({
        where: { status: 'aguardando_pagamento' as any },
        orderBy: { createdAt: 'desc' },
      });
      if (!latest) return res.status(404).json({ success: false, message: 'Nenhum pedido aguardando pagamento encontrado.' });
      await prisma.order.update({ where: { id: latest.id }, data: { status: 'pago' as any } });
      return res.json({ success: true, updatedId: latest.id, externalReference: latest.externalReference });
    } catch (e: any) {
      console.error('[TEST] mark-paid error:', e?.message || e);
      return res.status(500).json({ success: false, message: 'Falha ao simular pagamento.' });
    }
  });
}

// Confere status de pagamento por externalReference no gateway e atualiza o pedido caso pago
router.get('/payments/status/by-reference/:ref', async (req: Request, res: Response) => {
  try {
    const externalReference = req.params.ref;
    const paymentProvider = getPaymentProvider();
    const paymentId = String((req.query?.paymentId ?? '') || '');

    let result: any = null;
    // Preferir por paymentId se informado
    // @ts-ignore
    if (paymentId && typeof paymentProvider.getPaymentStatusById === 'function') {
      // @ts-ignore
      result = await paymentProvider.getPaymentStatusById(paymentId);
    } else {
      // @ts-ignore - método específico do AsaasProvider
      if (typeof paymentProvider.getPaymentStatusByExternalReference !== 'function') {
        return res.status(400).json({ success: false, message: 'Provider does not support status lookup.' });
      }
      // @ts-ignore
      result = await paymentProvider.getPaymentStatusByExternalReference(externalReference);
    }
    if (result.success && result.paid) {
      await updateOrderStatusByExternalReference(externalReference, 'pago');
    }
    return res.json({ success: true, paid: !!result.paid, status: result.status });
  } catch (error: any) {
    console.error('Error checking payment status by reference:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- ROTA DE WEBHOOK ---

router.post('/gateway/asaas/webhook', async (req: Request, res: Response) => {
  const event = req.body;

  // TODO: Adicionar validação de segurança do webhook (ex: verificar IP ou assinatura)
  // const asaasSignature = req.headers['asaas-signature'];

  try {
    if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
      const payment = event.payment;
      const externalReference = payment.externalReference;

      if (externalReference) {
        console.log(`[Webhook Asaas] Payment confirmed for externalReference: ${externalReference}`);
        await updateOrderStatusByExternalReference(externalReference, 'pago');
      }
    }
    res.status(200).send('Webhook received');
  } catch (error: any) {
    console.error('[Webhook Asaas] Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// --- ROTAS DE AUTENTICAÇÃO ---

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Usuário e senha são obrigatórios." });
    }

    // 1) Tenta autenticar como Admin (User)
    const user = await prisma.user.findUnique({ where: { username } });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const token = jwt.sign({ role: 'admin', userId: user.id, username: user.username }, process.env.SESSION_SECRET || 'super-secret-key', { expiresIn: '1d' });
      return res.json({ success: true, token });
    }

    // 2) Tenta autenticar como Operador
    const op = await prisma.operator.findUnique({ where: { username } });
    if (op && await bcrypt.compare(password, op.passwordHash)) {
      const token = jwt.sign({
        role: 'operator',
        operatorId: op.id,
        username: op.username,
        perms: {
          canGenerateLandings: op.canGenerateLandings,
          canViewOrders: op.canViewOrders,
          canManageAll: op.canManageAll,
        }
      }, process.env.SESSION_SECRET || 'super-secret-key', { expiresIn: '1d' });
      return res.json({ success: true, token });
    }

    return res.status(401).json({ success: false, message: "Usuário ou senha inválidos." });
  } catch (e: any) {
    console.error("[LOGIN] Erro inesperado:", e?.message || e);
    return res.status(500).json({ success: false, message: "Falha ao autenticar. Verifique o banco de dados e tente novamente." });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  res.json({ success: true });
});

// --- CONFIGURAÇÕES ---
router.get('/settings/profile', requireAuth, async (_req: Request, res: Response) => {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      // Auto-cria usuário admin padrão quando ausente
      const passwordHash = await bcrypt.hash('123', 10);
      user = await prisma.user.create({ data: { username: 'admin', passwordHash, name: 'Administrador', email: 'admin@example.com' } });
    }
    res.json({ id: user.id, name: user.name || '', email: user.email || '', username: user.username });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

// --- SMTP/Email Settings (read-only from env) + Test send ---
router.get('/settings/email', requireAuth, async (_req: Request, res: Response) => {
  try {
    const cfg = {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 0),
      user: process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-4) : '',
      from: process.env.SMTP_FROM || '',
      replyTo: process.env.SMTP_REPLY_TO || '',
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    };
    res.json(cfg);
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.post('/settings/email/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, kind } = req.body || {};
    if (!to || typeof to !== 'string') return res.status(400).json({ message: 'Informe um e-mail de destino.' });
    const { sendMail } = await import('./lib/email/mailer.js');
    const { renderPaymentApprovedEmail, renderPendingEmail, renderShippedEmail } = await import('./lib/email/mailer.js');
    const payload = { name: 'Cliente de Teste', orderId: 'TESTE123', item: 'Produto Teste', total: 123.45, installments: 1 };
    if (kind === 'pago') {
      const html = renderPaymentApprovedEmail(payload);
      await sendMail(to, 'Dermosul • Pagamento aprovado (teste)', html);
    } else if (kind === 'pendente') {
      const html = renderPendingEmail({ name: payload.name, orderId: payload.orderId, item: payload.item || 'Produto Teste', total: payload.total, installments: payload.installments });
      await sendMail(to, 'Dermosul • Preparando seu pedido (teste)', html);
    } else if (kind === 'enviado') {
      const html = renderShippedEmail({ name: payload.name, orderId: payload.orderId, tracking: 'TRK123456' });
      await sendMail(to, 'Dermosul • Pedido enviado (teste)', html);
    } else {
      return res.status(400).json({ message: 'Tipo inválido. Use pago|pendente|enviado.' });
    }
    res.json({ ok: true });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Falha ao enviar e-mail de teste.' }); }
});

// --- Integração com OpenAI ---
router.get('/admin/ai-integration', requireAuth, async (_req: Request, res: Response) => {
  try {
    const record = await prisma.aIIntegrationSetting.findUnique({ where: { id: 'openai' } });
    res.json({ configured: !!record });
  } catch (error: any) {
    console.error('[AI Integration] Falha ao consultar status:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível verificar a integração de IA.' });
  }
});

router.post('/admin/ai-integration', requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'validation_failed', message: 'Informe uma chave OpenAI válida.' });
    }

    const trimmed = apiKey.trim();
    const encryptedApiKey = encrypt(trimmed);

    await prisma.aIIntegrationSetting.upsert({
      where: { id: 'openai' },
      update: { encryptedApiKey, provider: 'openai' },
      create: { id: 'openai', provider: 'openai', encryptedApiKey },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('[AI Integration] Falha ao salvar chave:', error);
    res.status(500).json({
      error: 'server_error',
      message: error?.message || 'Não foi possível salvar a chave. Tente novamente.',
    });
  }
});

router.put('/settings/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, username, password } = req.body || {};
    let user = await prisma.user.findFirst();
    // Se não existir, cria um usuário base e depois aplica atualização
    if (!user) {
      const baseHash = await bcrypt.hash(password && String(password).length >= 4 ? String(password) : '123', 10);
      user = await prisma.user.create({ data: { username: username || 'admin', passwordHash: baseHash, name: name || 'Administrador', email: email || 'admin@example.com' } });
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, username: user.username } });
    }
    const data: any = { name: name ?? user.name, email: email ?? user.email, username: username ?? user.username };
    if (password && String(password).length >= 4) {
      data.passwordHash = await bcrypt.hash(String(password), 10);
    }
    const updated = await prisma.user.update({ where: { id: user.id }, data });
    res.json({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, username: updated.username } });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.get('/settings/operators', requireAuth, async (_req: Request, res: Response) => {
  try {
    const ops = await prisma.operator.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(ops.map(o => ({
      id: o.id, name: o.name, email: o.email, username: o.username,
      canGenerateLandings: o.canGenerateLandings, canViewOrders: o.canViewOrders, canManageAll: o.canManageAll,
    })));
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

router.post('/settings/operators', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, email, username, password, canGenerateLandings, canViewOrders, canManageAll } = req.body || {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';
    const rawPassword = typeof password === 'string' ? password : String(password ?? '');

    if (!trimmedName || !trimmedEmail || !trimmedUsername || !rawPassword) {
      return res.status(400).json({ message: 'Preencha nome, email, usuário e senha' });
    }

    const existing = await prisma.operator.findUnique({ where: { username: trimmedUsername } });
    if (existing) {
      return res.status(409).json({ message: 'Já existe um operador com esse usuário.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const created = await prisma.operator.create({
      data: {
        name: trimmedName,
        email: trimmedEmail,
        username: trimmedUsername,
        passwordHash,
        canGenerateLandings: !!canGenerateLandings,
        canViewOrders: !!canViewOrders,
        canManageAll: !!canManageAll,
      },
    });
    res.json({ id: created.id });
  } catch (e:any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ message: 'Já existe um operador com esse usuário.' });
    }
    res.status(500).json({ message: e?.message || 'Erro' });
  }
});

router.delete('/settings/operators/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.operator.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e:any) { res.status(500).json({ message: e.message || 'Erro' }); }
});

// --- ROTAS PRIVADAS (DASHBOARD) ---

router.get("/overview", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await statsLast14Days());
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/revenueByDay", requireAuth, async (req: Request, res: Response) => {
  try {
    const days = lastNDays(14);
    const orders = await listOrders({});
    const by = days.map((date: string) => ({ date, revenue: 0 }));
    const idx = new Map(days.map((d: string, i: number) => [d, i]));
    for (const o of orders.items) {
      if (!idx.has(o.createdAt)) continue;
      by[idx.get(o.createdAt)!].revenue += o.total_value;
    }
    res.json(by);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/ordersByCategory", requireAuth, async (req: Request, res: Response) => {
  try {
    const daysSet = new Set(lastNDays(14));
    const orders = await listOrders({});
    const mapCat = new Map();
    for (const o of orders.items) {
      if (!daysSet.has(o.createdAt)) continue;
      const key = o.category || "Outros";
      mapCat.set(key, (mapCat.get(key) || 0) + 1);
    }
    res.json(Array.from(mapCat.entries()).map(([category, value]) => ({ category, value })));
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/payments/breakdown", requireAuth, async (req: Request, res: Response) => {
    try {
        res.json(await paymentsBreakdown());
    } catch (error) {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
});

router.get("/conversionByDay", requireAuth, async (req: Request, res: Response) => {
  try {
    const days = lastNDays(14);
    const orders = await listOrders({});
    const idx = new Map(days.map((d: string, i: number) => [d, i]));
    const daily = days.map((d: string) => ({ date: d, paid: 0, total: 0 }));
    for (const o of orders.items) {
      const i = idx.get(o.createdAt);
      if (i === undefined) continue;
      daily[i].total += 1;
      if (o.status === "pago") daily[i].paid += 1;
    }
    res.json(daily.map(d => ({ date: d.date, rate: d.total ? d.paid / d.total : 0 })));
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.get("/orders", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listOrders(req.query));
  } catch (error: any) {
    console.error("[ERROR] Falha em GET /api/orders:", error); // Log detalhado
    res.status(500).json({ error: "Erro interno do servidor.", message: error.message });
  }
});

router.get("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.patch("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const updatedOrder = await updateOrder(req.params.id, req.body);
    if (!updatedOrder) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json(updatedOrder);
  } catch (error: any) {
    res.status(400).json({ errors: error.message });
  }
});

router.delete("/orders/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteOrder(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Pedido não encontrado." });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// --- Notas do pedido (armazenadas em arquivo backend/notes.json) ---

const NOTES_FILE = path.join(process.cwd(), 'backend', 'notes.json');

function loadNotesFile(): Record<string, string> {
  try {
    if (!fs.existsSync(NOTES_FILE)) {
      fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
      fs.writeFileSync(NOTES_FILE, JSON.stringify({}), 'utf-8');
    }
    const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function saveNotesFile(data: Record<string, string>) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

router.get('/orders/:id/notes', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const notesMap = loadNotesFile();
  res.json({ notes: notesMap[id] || '' });
});

router.patch('/orders/:id/notes', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const { notes } = req.body || {};
  if (typeof notes !== 'string') {
    return res.status(400).json({ error: 'validation_failed', message: 'Campo notes deve ser string.' });
  }
  const notesMap = loadNotesFile();
  notesMap[id] = notes;
  try {
    saveNotesFile(notesMap);
    res.json({ success: true, notes });
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', message: e?.message || 'Falha ao salvar notas.' });
  }
});

router.get("/landings", requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await listLandingPages());
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.delete("/landings/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await deleteLandingPage(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Landing Page não encontrada." });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

router.patch("/landings/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body || {};
    if (status !== 'ATIVA' && status !== 'PAUSADA') {
      return res.status(400).json({ error: 'validation_failed', message: "Status inválido. Use 'ATIVA' ou 'PAUSADA'." });
    }
    const updated = await updateLandingPageStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'not_found', message: "Landing Page não encontrada." });
    res.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/landings/:id/status error:', error);
    res.status(500).json({ error: 'server_error', message: error?.message || 'Falha ao atualizar status.' });
  }
});

export default router;
