import express, { Router, Request } from 'express';
import { prisma } from './db/prisma';
import type { Prisma } from "@prisma/client";
import {
  getStoreSettings as fetchStoreSettings,
  getMenuByKey,
  listBanners as fetchBanners,
  listCategories as fetchCategories,
  listCollections as fetchCollections,
  listProducts as fetchProducts,
  listCategoryProducts,
  listCollectionProducts,
  searchProducts as fetchSearchProducts,
  getProductBySlug,
  getProductById as fetchProductById,
  upsertProduct as saveProduct,
  deleteProduct as removeProduct,
  getCart as fetchCart,
  upsertCart as saveCart,
  checkoutCart,
  logStorefrontEvent,
  getPersonalizedRecommendations,
  listShippingMethods as fetchShippingMethods,
  getPageBySlug,
  getLuckyWheelPublicState,
  spinLuckyWheel,
} from './data/index.js';
import type { LuckyWheelSpinResult, LuckyWheelPublicState, LuckyWheelSpinPayload } from "./types/lucky-wheel.js";
import type { ProductSortOption } from './data/index.js';

const router = Router();

async function buildPublicOrderPayload(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) return null;
  const paymentGateway = (order.metadata as Prisma.JsonObject | null | undefined)?.paymentGateway as
    | { gatewayPaymentId?: string | null; gatewayStatus?: string | null }
    | undefined;
  const latestPayment = order.payments?.[0] ?? null;

  return {
    orderId: order.id,
    orderNumber: order.number ?? order.id.slice(-6),
    status: order.status,
    totals: {
      subtotalCents: order.subtotalAmount,
      discountCents: order.discountAmount,
      shippingCents: order.shippingAmount,
      totalCents: order.totalAmount,
    },
    payment: {
      method: latestPayment?.paymentMethod ?? "pix",
      status: latestPayment?.status ?? order.status,
      externalReference: order.externalReference ?? undefined,
      gatewayPaymentId: paymentGateway?.gatewayPaymentId ?? null,
      gatewayStatus: paymentGateway?.gatewayStatus ?? latestPayment?.status ?? null,
      pix: null,
    },
  };
}

router.use(express.json());

const getBaseUrl = (req: Request) => {
  const forwardedProto = req.get('x-forwarded-proto');
  const forwardedHost = req.get('x-forwarded-host');
  const hostHeader = forwardedHost ? forwardedHost.split(',')[0]?.trim() : null;
  const host = hostHeader || req.get('host') || 'localhost';
  const protocolHeader = forwardedProto ? forwardedProto.split(',')[0]?.trim() : null;
  const protocol = protocolHeader || req.protocol || 'http';
  return `${protocol}://${host}`;
};

const toAbsoluteUrl = (req: Request, url?: string | null) => {
  if (!url) return url ?? null;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith('/') ? url : `/${url.replace(/^\/+/, '')}`;
  return `${getBaseUrl(req)}${normalized}`;
};

const boolFromQuery = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
    if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
    return undefined;
  }
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'boolean') return value;
  return undefined;
};

const parseNumber = (value: unknown, fallback: number): number => {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNumberParam = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBooleanParam = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'no'].includes(normalized)) return false;
  return undefined;
};

type SessionLuckyWheelState = {
  lastResult?: (LuckyWheelSpinResult & { timestamp: string }) | null;
  lastShownAt?: string | null;
  dismissed?: boolean;
  blockedReason?: string | null;
  freeShippingGranted?: boolean;
  freeOrderGranted?: boolean;
};

const getSessionLuckyWheelState = (req: Request): SessionLuckyWheelState => {
  const current = (req.session as any)?.luckyWheel;
  if (!current || typeof current !== 'object') {
    return {};
  }
  return current as SessionLuckyWheelState;
};

const persistSessionLuckyWheelState = (req: Request, nextState: SessionLuckyWheelState) => {
  if (!req.session) return;
  (req.session as any).luckyWheel = nextState;
  req.session.touch?.();
  req.session.save?.(() => undefined);
};

const buildLuckyWheelContext = (req: Request, overrides: Partial<LuckyWheelSpinPayload> = {}): LuckyWheelSpinPayload => {
  const cartIdQuery = typeof req.query.cartId === 'string' ? req.query.cartId : undefined;
  const cartIdBody = typeof (req.body as any)?.cartId === 'string' ? (req.body as any).cartId : undefined;
  const customerId = (req.session as any)?.userId || (req.session as any)?.customerId || undefined;
  const sessionId = typeof req.sessionID === 'string' ? req.sessionID : undefined;
  return {
    cartId: overrides.cartId ?? cartIdBody ?? cartIdQuery,
    sessionId: overrides.sessionId ?? sessionId,
    customerId: overrides.customerId ?? customerId,
    ipAddress: overrides.ipAddress ?? req.ip,
  };
};

const ALLOWED_SORTS: Record<string, ProductSortOption> = {
  relevance: 'relevance',
  bestsellers: 'bestsellers',
  rating_desc: 'rating_desc',
  price_asc: 'price_asc',
  price_desc: 'price_desc',
  name_asc: 'name_asc',
  newest: 'newest',
};

const parseSort = (value: unknown): ProductSortOption | undefined => {
  if (!value || typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return ALLOWED_SORTS[normalized] ?? undefined;
};

const absolutizeImages = <T extends { url?: string | null }>(req: Request, images?: T[] | null): T[] => {
  if (!Array.isArray(images)) return [];
  return images.map((image) => ({
    ...image,
    url: toAbsoluteUrl(req, image?.url ?? null),
  }));
};

type ProductLike = {
  images?: Array<{ url?: string | null }>;
  imageUrl?: string | null;
};

const absolutizeProduct = <T extends ProductLike>(req: Request, product: T): T => {
  const images = absolutizeImages(req, product.images);
  const imageUrl = product.imageUrl ? toAbsoluteUrl(req, product.imageUrl) : images[0]?.url ?? null;
  return {
    ...product,
    images,
    imageUrl,
  };
};

const absolutizeProductList = <T extends ProductLike>(req: Request, products: T[]): T[] =>
  products.map((product) => absolutizeProduct(req, product));

const absolutizePaginatedProducts = <T extends ProductLike>(req: Request, payload: { items: T[] } & Record<string, unknown>) => ({
  ...payload,
  items: absolutizeProductList(req, payload.items ?? []),
});

const absolutizeCart = (req: Request, cart: Awaited<ReturnType<typeof fetchCart>>) => {
  if (!cart) return null;
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      product: absolutizeProduct(req, item.product),
    })),
  };
};

const deriveSessionPerks = (req: Request) => {
  const state = getSessionLuckyWheelState(req);
  return {
    freeShipping: Boolean(state.freeShippingGranted),
    freeOrder: Boolean(state.freeOrderGranted),
  };
};

const applyLuckyWheelPerksToCart = (req: Request, cart: Awaited<ReturnType<typeof fetchCart>>) => {
  if (!cart) return cart;
  const perks = deriveSessionPerks(req);
  if (!perks.freeShipping && !perks.freeOrder) {
    return cart;
  }
  const subtotal = cart.subtotalCents;
  const discountCents = perks.freeOrder ? subtotal : cart.discountCents;
  const shippingCents = perks.freeShipping ? 0 : cart.shippingCents;
  const totalCents = Math.max(subtotal - discountCents + shippingCents, 0);
  return {
    ...cart,
    discountCents,
    shippingCents,
    totalCents,
    luckyWheelPerks: {
      freeShippingApplied: perks.freeShipping,
      freeOrderApplied: perks.freeOrder,
    },
  };
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);

const normalizeProductPayload = (body: any, id?: string) => {
  if (!body || typeof body !== 'object') {
    throw new Error('Payload inválido para produto.');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new Error('Informe o nome do produto.');

  const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const slug = rawSlug || slugify(name);
  if (!slug) throw new Error('Informe o slug do produto.');

  const sku = typeof body.sku === 'string' ? body.sku.trim() : '';
  if (!sku) throw new Error('Informe o SKU do produto.');

  const price = Number(body.price);
  if (!Number.isFinite(price)) throw new Error('Informe o preço em centavos do produto.');

  const compareAtRaw = body.compareAtPrice;
  const compareAt =
    compareAtRaw === undefined || compareAtRaw === null || compareAtRaw === ''
      ? null
      : Number(compareAtRaw);
  if (compareAt !== null && !Number.isFinite(compareAt)) throw new Error('Informe um preço cheio válido.');

  const stockQuantity = Number(body.stockQuantity ?? 0);
  if (!Number.isFinite(stockQuantity)) throw new Error('Informe um estoque válido.');

  const images = Array.isArray(body.images)
    ? body.images
        .map((image: any, index: number) => {
          const url = typeof image?.url === 'string' ? image.url.trim() : '';
          if (!url) return null;
          return {
            url,
            alt: typeof image?.alt === 'string' ? image.alt : null,
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
    brand: typeof body.brand === 'string' ? body.brand : '',
    sku,
    description: typeof body.description === 'string' ? body.description : '',
    descriptionHtml:
      typeof body.descriptionHtml === 'string' && body.descriptionHtml.trim() ? body.descriptionHtml : null,
    price: Math.max(Math.round(price), 0),
    compareAtPrice: compareAt === null ? null : Math.max(Math.round(compareAt), 0),
    stockQuantity: Math.max(Math.round(stockQuantity), 0),
    active: body.active === undefined ? true : Boolean(body.active),
    images,
    categoryIds,
    collectionIds,
  };
};

const absolutizeSettings = (req: Request, settings: Awaited<ReturnType<typeof fetchStoreSettings>>) => {
  if (!settings) return settings;
  const assets = ['logoUrl', 'faviconUrl', 'appleTouchIconUrl', 'metaImageUrl'] as const;
  const normalized: typeof settings = { ...settings };
  for (const field of assets) {
    const value = normalized[field];
    if (typeof value === 'string' && value) {
      normalized[field] = toAbsoluteUrl(req, value);
    }
  }
  return normalized;
};

router.get('/settings', async (req, res) => {
  try {
    const settings = await fetchStoreSettings();
    if (!settings) {
      return res.status(404).json({ error: 'not_found', message: 'Configurações da loja não encontradas.' });
    }
    res.json(absolutizeSettings(req, settings));
  } catch (error) {
    console.error('Erro ao buscar configurações da loja:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar as configurações da loja.' });
  }
});

router.get('/menus/:key', async (req, res) => {
  try {
    const rawKey = String(req.params.key || '').toUpperCase();
    if (!['HEADER', 'FOOTER'].includes(rawKey)) {
      return res.status(400).json({ error: 'validation_failed', message: 'Menu inválido. Use header ou footer.' });
    }
    const menu = await getMenuByKey(rawKey);
    res.json(menu);
  } catch (error) {
    console.error('Erro ao buscar menu da loja:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar o menu solicitado.' });
  }
});

router.get('/banners', async (req, res) => {
  try {
    const { kind } = req.query;
    const activeOnly = boolFromQuery(req.query.activeOnly);
    const banners = await fetchBanners({
      kind: typeof kind === 'string' && kind ? kind.toUpperCase() : undefined,
      activeOnly: activeOnly ?? false,
    });
    res.json(
      banners.map((banner) => ({
        ...banner,
        imageUrl: toAbsoluteUrl(req, banner.imageUrl),
        mobileImageUrl: toAbsoluteUrl(req, banner.mobileImageUrl ?? null),
      }))
    );
  } catch (error) {
    console.error('Erro ao buscar banners:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os banners.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const pageSize = Math.max(Math.min(parseNumber(req.query.pageSize, 20), 100), 1);
    const sort = parseSort(req.query.sort);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined;

    const results = await fetchProducts({
      page,
      pageSize,
      sort,
      q,
      active: true,
    });

    res.json(absolutizePaginatedProducts(req, results));
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os produtos.' });
  }
});

router.get('/admin/products', async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const pageSize = Math.max(Math.min(parseNumber(req.query.pageSize, 50), 200), 1);
    const sort = parseSort(req.query.sort);
    const q = typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined;
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
    const collectionId = typeof req.query.collectionId === 'string' ? req.query.collectionId : undefined;
    const active = parseBooleanParam(req.query.active);

    const results = await fetchProducts({
      page,
      pageSize,
      sort,
      q,
      categoryId,
      collectionId,
      active,
    });

    res.json(absolutizePaginatedProducts(req, results));
  } catch (error) {
    console.error('[admin] Erro ao listar produtos:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os produtos.' });
  }
});

router.get('/admin/products/:id', async (req, res) => {
  try {
    const product = await fetchProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Produto não encontrado.' });
    }
    res.json(absolutizeProduct(req, product));
  } catch (error) {
    console.error('[admin] Erro ao carregar produto:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar o produto.' });
  }
});

router.post('/admin/products', async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body ?? {});
    const created = await saveProduct(payload);
    if (!created) throw new Error('Falha ao criar produto.');
    res.status(201).json(absolutizeProduct(req, created));
  } catch (error: any) {
    console.error('[admin] Erro ao criar produto:', error);
    res.status(400).json({ error: 'validation_failed', message: error?.message || 'Não foi possível criar o produto.' });
  }
});

router.put('/admin/products/:id', async (req, res) => {
  try {
    const payload = normalizeProductPayload(req.body ?? {}, req.params.id);
    const updated = await saveProduct(payload);
    if (!updated) {
      return res.status(404).json({ error: 'not_found', message: 'Produto não encontrado.' });
    }
    res.json(absolutizeProduct(req, updated));
  } catch (error: any) {
    console.error('[admin] Erro ao atualizar produto:', error);
    const message = error?.message || 'Não foi possível atualizar o produto.';
    const status = message.includes('não encontrado') ? 404 : 400;
    res.status(status).json({ error: status === 404 ? 'not_found' : 'validation_failed', message });
  }
});

router.delete('/admin/products/:id', async (req, res) => {
  try {
    await removeProduct(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[admin] Erro ao remover produto:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível remover o produto.' });
  }
});

router.post('/admin/products/adjust-prices', async (req, res) => {
  try {
    const percentageRaw = req.body?.percentage;
    const parsed = Number(percentageRaw);
    if (!Number.isFinite(parsed) || parsed === 0) {
      return res.status(400).json({ error: 'validation_failed', message: 'Informe um percentual numérico diferente de zero.' });
    }
    const multiplier = 1 + parsed / 100;
    if (multiplier <= 0) {
      return res.status(400).json({ error: 'validation_failed', message: 'O ajuste informado deixaria os preços negativos.' });
    }

    const products = await prisma.product.findMany({ select: { id: true, price: true, compareAtPrice: true } });
    if (!products.length) {
      return res.json({ success: true, updated: 0 });
    }

    await prisma.$transaction(
      products.map((product) => {
        const nextPrice = Math.max(Math.round(product.price * multiplier), 0);
        const nextCompare =
          product.compareAtPrice !== null
            ? Math.max(Math.round(product.compareAtPrice * multiplier), nextPrice)
            : null;
        return prisma.product.update({
          where: { id: product.id },
          data: { price: nextPrice, compareAtPrice: nextCompare },
        });
      })
    );

    res.json({ success: true, updated: products.length });
  } catch (error) {
    console.error('[admin] Erro ao ajustar preços:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível ajustar os preços.' });
  }
});

router.get('/products/:slug', async (req, res) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Produto não encontrado.' });
    }
    res.json(absolutizeProduct(req, product));
  } catch (error) {
    console.error(`Erro ao buscar produto pelo slug ${req.params.slug}:`, error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar o produto.' });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const categories = await fetchCategories();
    res.json(categories);
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar as categorias.' });
  }
});

router.get('/admin/categories', async (_req, res) => {
  try {
    const categories = await fetchCategories();
    res.json(categories);
  } catch (error) {
    console.error('[admin] Erro ao listar categorias:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar as categorias.' });
  }
});

router.get('/categories/:slug/products', async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const pageSize = Math.max(Math.min(parseNumber(req.query.pageSize, 20), 100), 1);
    const sort = parseSort(req.query.sort);
    const data = await listCategoryProducts(req.params.slug, {
      page,
      pageSize,
      sort,
    });
    res.json(absolutizePaginatedProducts(req, data));
  } catch (error) {
    console.error(`Erro ao buscar produtos da categoria ${req.params.slug}:`, error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os produtos da categoria.' });
  }
});

router.get('/collections', async (_req, res) => {
  try {
    const collections = await fetchCollections();
    res.json(collections.map(({ products, ...rest }) => rest));
  } catch (error) {
    console.error('Erro ao buscar coleções:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar as coleções.' });
  }
});

router.get('/admin/collections', async (_req, res) => {
  try {
    const collections = await fetchCollections();
    res.json(collections);
  } catch (error) {
    console.error('[admin] Erro ao listar coleções:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar as coleções.' });
  }
});

router.get('/collections/:slug', async (req, res) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { slug: req.params.slug },
      include: {
        products: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!collection) {
      return res.status(404).json({ error: 'not_found', message: 'Coleção não encontrada.' });
    }

    const products = collection.products.map((entry) => absolutizeProduct(req, entry.product));

    res.json({ ...collection, products });
  } catch (error) {
    console.error(`Erro ao buscar coleção ${req.params.slug}:`, error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar a coleção.' });
  }
});

router.get('/collections/:slug/products', async (req, res) => {
  try {
    const page = Math.max(parseNumber(req.query.page, 1), 1);
    const pageSize = Math.max(Math.min(parseNumber(req.query.pageSize, 20), 100), 1);
    const sort = parseSort(req.query.sort);
    const data = await listCollectionProducts(req.params.slug, {
      page,
      pageSize,
      sort,
    });
    res.json(absolutizePaginatedProducts(req, data));
  } catch (error) {
    console.error(`Erro ao buscar produtos da coleção ${req.params.slug}:`, error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os produtos da coleção.' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const term = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!term) {
      return res.json([]);
    }
    const limit = Math.max(Math.min(parseNumber(req.query.limit, 12), 50), 1);
    const results = await fetchSearchProducts(term, limit);
    res.json(absolutizeProductList(req, results));
  } catch (error) {
    console.error('Erro ao pesquisar produtos:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível realizar a busca.' });
  }
});

router.get('/lucky-wheel', async (req, res) => {
  try {
    const context = buildLuckyWheelContext(req);
    const state = await getLuckyWheelPublicState(context);
    const sessionState = getSessionLuckyWheelState(req);
    res.json({
      ...state,
      lastResult: sessionState.lastResult ?? null,
      sessionPerks: {
        freeShippingGranted: sessionState.freeShippingGranted ?? false,
        freeOrderGranted: sessionState.freeOrderGranted ?? false,
      },
    });
  } catch (error: any) {
    console.error('Erro ao carregar roleta da sorte:', error);
    res.status(500).json({ error: 'server_error', message: error?.message || 'Não foi possível carregar a roleta.' });
  }
});

router.post('/lucky-wheel/spin', async (req, res) => {
  try {
    const sessionToken = typeof (req.body as any)?.sessionToken === 'string' ? (req.body as any).sessionToken : undefined;
    const context = buildLuckyWheelContext(req, { cartId: (req.body as any)?.cartId });
    const result = await spinLuckyWheel(context);

    if (result.autoApplyCoupon && result.couponCode) {
      try {
        await saveCart({ cartId: context.cartId, sessionToken, couponCode: result.couponCode });
      } catch (autoApplyError) {
        console.warn('[lucky-wheel] falha ao aplicar cupom automaticamente', autoApplyError);
      }
    }

    const currentState = getSessionLuckyWheelState(req);
    const timestampedResult = { ...result, timestamp: new Date().toISOString() } as LuckyWheelSpinResult & { timestamp: string };
    const nextState: SessionLuckyWheelState = {
      ...currentState,
      lastResult: timestampedResult,
      blockedReason: null,
      freeShippingGranted: result.freeShipping || currentState.freeShippingGranted,
      freeOrderGranted: result.freeOrder || currentState.freeOrderGranted,
    };
    persistSessionLuckyWheelState(req, nextState);

    res.json({ result: timestampedResult });
  } catch (error: any) {
    const code = error?.code || 'spin_failed';
    const statusMap: Record<string, number> = {
      already_played: 409,
      auth_required: 403,
      limit_daily: 429,
      limit_monthly: 429,
      no_prizes: 409,
      disabled: 423,
    };
    const status = statusMap[code] || 400;
    console.warn('Falha ao girar roleta:', error);
    const currentState = getSessionLuckyWheelState(req);
    persistSessionLuckyWheelState(req, { ...currentState, blockedReason: code });
    res.status(status).json({ error: code, message: error?.message || 'Não foi possível girar a roleta da sorte.' });
  }
});

router.get('/cart', async (req, res) => {
  try {
    const cart = await fetchCart({
      cartId: typeof req.query.cartId === 'string' ? req.query.cartId : undefined,
      sessionToken: typeof req.query.sessionToken === 'string' ? req.query.sessionToken : undefined,
    });
    const adjusted = applyLuckyWheelPerksToCart(req, cart);
    res.json(absolutizeCart(req, adjusted));
  } catch (error) {
    console.error('Erro ao buscar carrinho:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar o carrinho.' });
  }
});

router.post('/cart', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'validation_failed', message: 'Payload inválido para o carrinho.' });
    }
    const cart = await saveCart(req.body);
    const adjusted = applyLuckyWheelPerksToCart(req, cart);
    res.json(absolutizeCart(req, adjusted));
  } catch (error: any) {
    console.error('Erro ao atualizar carrinho:', error);
    res.status(400).json({ error: 'cart_update_failed', message: error?.message || 'Falha ao atualizar o carrinho.' });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'validation_failed', message: 'Payload de checkout inválido.' });
    }
    const perks = deriveSessionPerks(req);
    const payload = { ...(req.body as Record<string, unknown>), perks };
    const result = await checkoutCart(payload as any);
    res.json(result);
  } catch (error: any) {
    console.error('Erro ao finalizar checkout:', error);
    res.status(400).json({ error: 'checkout_failed', message: error?.message || 'Falha ao processar checkout.' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { sessionId, eventType, productId, collectionId, cartId, customerId, metadata } = req.body || {};
    if (!sessionId || !eventType) {
      return res.status(400).json({ error: 'validation_failed', message: 'sessionId e eventType são obrigatórios.' });
    }
    await logStorefrontEvent({ sessionId, eventType, productId, collectionId, cartId, customerId, metadata });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao registrar evento da vitrine:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível registrar o evento.' });
  }
});

router.get('/recommendations', async (req, res) => {
  try {
    const limitPerSection = parseNumber(req.query.limit, 8);
    const data = await getPersonalizedRecommendations({
      sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
      cartId: typeof req.query.cartId === 'string' ? req.query.cartId : undefined,
      customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
      limitPerSection,
    });

    res.json({
      trending: absolutizeProductList(req, data.trending),
      newArrivals: absolutizeProductList(req, data.newArrivals),
      cartComplements: absolutizeProductList(req, data.cartComplements),
      customerFavorites: absolutizeProductList(req, data.customerFavorites),
    });
  } catch (error) {
    console.error('Erro ao buscar recomendações personalizadas:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar recomendações.' });
  }
});

router.get("/orders/:orderId/status", async (req, res) => {
  try {
    const payload = await buildPublicOrderPayload(req.params.orderId);
    if (!payload) {
      return res.status(404).json({ error: "order_not_found", message: "Pedido não encontrado." });
    }
    res.json(payload);
  } catch (error) {
    console.error("[storefront] Falha ao consultar status do pedido", error);
    res.status(500).json({ error: "server_error", message: "Não foi possível consultar o pedido." });
  }
});

router.get('/shipping-methods', async (_req, res) => {
  try {
    const methods = await fetchShippingMethods();
    res.json(methods.filter((method) => method.active !== false));
  } catch (error) {
    console.error('Erro ao buscar métodos de envio:', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os métodos de envio.' });
  }
});

router.get('/pages/:slug', async (req, res) => {
  try {
    const page = await getPageBySlug(req.params.slug);
    if (!page || page.published === false) {
      return res.status(404).json({ error: 'not_found', message: 'Página não encontrada.' });
    }
    res.json(page);
  } catch (error) {
    console.error(`Erro ao buscar página ${req.params.slug}:`, error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar a página solicitada.' });
  }
});

export default router;
