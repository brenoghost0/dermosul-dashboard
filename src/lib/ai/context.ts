// Serializes store data (produtos, políticas, configurações) para o assistente.
import { prisma } from "../../db/prisma.js";
import { formatCurrencyBRL } from "../../utils/format.js";

type SerializedProduct = {
  id: string;
  slug: string;
  brand?: string | null;
  name: string;
  price: string;
  compareAt?: string | null;
  url: string;
  categories: string[];
  description: string;
  image?: string | null;
};

export type StoreAIContext = {
  products: SerializedProduct[];
  policies: Record<string, string>;
  settings: {
    title?: string | null;
    description?: string | null;
    shipping?: unknown;
    contact?: {
      email?: string | null;
      phone?: string | null;
      serviceHours?: string | null;
      address?: string | null;
    };
  };
};

export async function buildStoreContext(): Promise<StoreAIContext> {
  const [settings, pages, products] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: "store" } }),
    prisma.page.findMany({
      where: { slug: { in: ["politica-trocas", "politica-envio", "politica-privacidade", "sobre"] } },
      select: { slug: true, contentHtml: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 24,
      select: {
        id: true,
        name: true,
        brand: true,
        slug: true,
        description: true,
        price: true,
        compareAtPrice: true,
        productLinks: {
          take: 3,
          select: { category: { select: { name: true } } },
        },
        images: { take: 1, select: { url: true } },
      },
    }),
  ]);

  const mappedProducts: SerializedProduct[] = products.map((product) => ({
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    price: formatCurrencyBRL(product.price),
    compareAt: product.compareAtPrice ? formatCurrencyBRL(product.compareAtPrice) : null,
    url: `/p/${product.slug}`,
    categories: product.productLinks
      .map((link) => link.category?.name)
      .filter((name): name is string => Boolean(name)),
    description: product.description,
    image: product.images[0]?.url ?? null,
  }));

  const policies = pages.reduce<Record<string, string>>((acc, page) => {
    acc[page.slug] = page.contentHtml ?? "";
    return acc;
  }, {});

  return {
    products: mappedProducts,
    policies,
    settings: {
      title: settings?.defaultTitle ?? null,
      description: settings?.defaultDescription ?? null,
      shipping: settings?.checkoutSettings ?? null,
      contact: {
        email: (settings?.textBlocks as any)?.footer?.contactEmail ?? null,
        phone: (settings?.textBlocks as any)?.footer?.contactPhone ?? null,
        serviceHours: (settings?.textBlocks as any)?.footer?.serviceHours ?? null,
        address: (settings?.textBlocks as any)?.footer?.address ?? null,
      },
    },
  };
}
