import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedOperator() {
  const passwordHash = await bcrypt.hash('123', 10);
  await prisma.operator.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: {
      username: 'admin',
      passwordHash,
      name: 'Administrador',
      email: 'admin@dermosul.com.br',
      canManageAll: true,
    },
  });
}

async function seedStoreSettings() {
  await prisma.storeSettings.upsert({
    where: { id: 'store' },
    update: {
      defaultTitle: 'Dermosul • Dermocosméticos multimarcas com preços imbatíveis',
      defaultDescription:
        'Marketplace Dermosul com Skinceuticals, Vichy, Eucerin, La Roche-Posay e outras marcas líderes com descontos exclusivos.',
      primaryColor: '#6C4AB6',
      secondaryColor: '#452A8B',
      accentColor: '#C8B0F4',
      logoUrl: '/media/dermosul/logo.svg',
      metaImageUrl: '/media/dermosul/og-image.png',
      typography: {
        heading: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
        body: { fontFamily: "'Inter', sans-serif", fontWeight: 400 },
      } as Prisma.JsonObject,
    },
    create: {
      id: 'store',
      defaultTitle: 'Dermosul • Dermocosméticos multimarcas com preços imbatíveis',
      defaultDescription:
        'Marketplace Dermosul com Skinceuticals, Vichy, Eucerin, La Roche-Posay e outras marcas líderes com descontos exclusivos.',
      primaryColor: '#6C4AB6',
      secondaryColor: '#452A8B',
      accentColor: '#C8B0F4',
      logoUrl: '/media/dermosul/logo.svg',
      metaImageUrl: '/media/dermosul/og-image.png',
      typography: {
        heading: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600 },
        body: { fontFamily: "'Inter', sans-serif", fontWeight: 400 },
      } as Prisma.JsonObject,
      textBlocks: {
        announcement: {
          enabled: true,
          message: 'As marcas mais desejadas com preços exclusivos Dermosul Insider',
          ctaLabel: 'Ver ofertas',
          ctaHref: '/colecoes/mais-vendidos',
        },
        newsletter: {
          title: 'Clube de ofertas Dermosul',
          subtitle: 'Receba alertas de preço e cupons das principais marcas de dermocosméticos.',
          placeholder: 'Digite seu e-mail',
          ctaLabel: 'Quero ofertas',
        },
      } as Prisma.JsonObject,
      checkoutSettings: {
        shipping: { freeShippingOverCents: 40000, deliveryEstimateText: 'Entrega em até 5 dias úteis nas capitais.' },
        payment: { availableMethods: ['pix'], defaultStatus: 'aguardando_pagamento' },
      } as Prisma.JsonObject,
    },
  });
}

async function seedCategories() {
  const categories = [
    { name: 'Tratamento', slug: 'tratamento', description: 'Cuidados que transformam sua pele todos os dias.' },
    { name: 'Hidratação', slug: 'hidratacao', description: 'Texturas inteligentes para manter barreira e equilíbrio da pele.' },
    { name: 'Limpeza', slug: 'limpeza', description: 'Limpeza sensorial, eficaz e com ativos dermatológicos.' },
  ];

  for (const [index, data] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: data.slug },
      update: { name: data.name, description: data.description, position: index },
      create: { ...data, position: index },
    });
  }
}

async function seedCollections() {
  const collections = [
    { name: 'Mais vendidos', slug: 'mais-vendidos', description: 'Cuidados Dermosul preferidos pelas pacientes.' },
    { name: 'Novidades', slug: 'novidades', description: 'Lançamentos e edições limitadas Dermosul.' },
  ];

  for (const [index, data] of collections.entries()) {
    await prisma.collection.upsert({
      where: { slug: data.slug },
      update: { name: data.name, description: data.description, position: index },
      create: { ...data, position: index },
    });
  }
}

const productSeeds = [
  {
    name: 'Sérum Dermosul Controle+',
    slug: 'serum-dermosul-controle',
    brand: 'Skinceuticals',
    sku: 'DER-SERUM-001',
    description:
      'Sérum oil-free com niacinamida, zinco PCA e complexo prebiótico que regula a oleosidade sem ressecar.',
    price: 18990,
    compareAt: 21990,
    stock: 45,
    categories: ['tratamento'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=640&q=80',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Gel de Limpeza Micelar Calm+',
    slug: 'gel-limpeza-calm',
    brand: 'La Roche-Posay',
    sku: 'DER-LIMP-002',
    description:
      'Gel micelar com pantenol e extrato de camomila que higieniza mantendo o pH fisiológico da pele.',
    price: 8990,
    compareAt: 10990,
    stock: 80,
    categories: ['limpeza'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1556228578-9d8f90be3d25?auto=format&fit=crop&w=640&q=80',
      'https://images.unsplash.com/photo-1580715941751-05c9c7f2a4eb?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Creme Nutritivo Barrier Restore',
    slug: 'creme-barrier-restore',
    brand: 'Eucerin',
    sku: 'DER-HID-003',
    description:
      'Creme reparador com ceramidas biomiméticas e esqualano vegetal para reconstrução da barreira cutânea.',
    price: 15990,
    compareAt: 18990,
    stock: 60,
    categories: ['hidratacao', 'tratamento'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1612810806695-30ba1ae4b996?auto=format&fit=crop&w=640&q=80',
      'https://images.unsplash.com/photo-1618213837799-9130ab740512?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Bruma Antioxidante Vita-C Mist',
    slug: 'bruma-vita-c',
    brand: 'Dermosul',
    sku: 'DER-HID-004',
    description:
      'Bruma com vitamina C estabilizada, ácido hialurônico e chá verde para luminosidade imediata.',
    price: 12990,
    compareAt: null,
    stock: 70,
    categories: ['hidratacao'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Máscara Regeneradora Noite Repair+',
    slug: 'mascara-noite-repair',
    brand: 'Dermosul',
    sku: 'DER-TRT-005',
    description:
      'Máscara noturna com retinol encapsulado e peptídeos restauradores para textura uniforme.',
    price: 22990,
    compareAt: 25990,
    stock: 35,
    categories: ['tratamento'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Tônico Esfoliante Soft Peel',
    slug: 'tonico-soft-peel',
    brand: 'Dermosul',
    sku: 'DER-LIMP-006',
    description:
      'Tônico com PHA, ácido mandélico e lactobionato para renovação gradual sem sensibilizar.',
    price: 10990,
    compareAt: null,
    stock: 55,
    categories: ['limpeza', 'tratamento'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1522336572468-97b06e8ef143?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Sérum de Olhos Lumina Lift',
    slug: 'serum-olhos-lumina',
    brand: 'Dermosul',
    sku: 'DER-TRT-007',
    description:
      'Sérum iluminador para contorno dos olhos com cafeína, pérolas ópticas e peptídeos firmadores.',
    price: 14990,
    compareAt: 16990,
    stock: 50,
    categories: ['tratamento'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1522040806052-d27353e9c5ef?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Espuma Detox Purify',
    slug: 'espuma-detox-purify',
    brand: 'Dermosul',
    sku: 'DER-LIMP-008',
    description:
      'Espuma com prebióticos e extrato de algas que promove limpeza estratégica sem agredir a pele.',
    price: 7990,
    compareAt: null,
    stock: 95,
    categories: ['limpeza'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1585386959984-a4155226c27e?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Hidratante Corporal Firm Lift',
    slug: 'hidratante-firm-lift',
    brand: 'Dermosul',
    sku: 'DER-HID-009',
    description:
      'Hidratante corporal com niacinamida, cafeína e ácido hialurônico para firmeza e elasticidade.',
    price: 13990,
    compareAt: 16990,
    stock: 65,
    categories: ['hidratacao'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1601041830683-3f43e07f8a5c?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Balm Suavizante Pós-Procedimento',
    slug: 'balm-pos-procedimento',
    brand: 'Dermosul',
    sku: 'DER-TRT-010',
    description:
      'Balm com madecassoside, beta-glucan e vitaminas lipossomiais para acalmar a pele após procedimentos.',
    price: 11990,
    compareAt: null,
    stock: 48,
    categories: ['tratamento', 'hidratacao'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1525230804831-4327ad36e0c0?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Óleo Sensorial Nourish Blend',
    slug: 'oleo-nourish-blend',
    brand: 'Dermosul',
    sku: 'DER-HID-011',
    description:
      'Blend de óleos botânicos com vitamina E e bisabolol para nutrição profunda e toque seco.',
    price: 16990,
    compareAt: 19990,
    stock: 40,
    categories: ['hidratacao'],
    collections: ['mais-vendidos'],
    images: [
      'https://images.unsplash.com/photo-1470167290877-7d5d3446de4c?auto=format&fit=crop&w=640&q=80',
    ],
  },
  {
    name: 'Espuma Enzimática Enzyme Glow',
    slug: 'espuma-enzyme-glow',
    brand: 'Dermosul',
    sku: 'DER-LIMP-012',
    description:
      'Espuma de limpeza com enzimas de abacaxi e papaína para renovação delicada e brilho imediato.',
    price: 9990,
    compareAt: null,
    stock: 77,
    categories: ['limpeza'],
    collections: ['novidades'],
    images: [
      'https://images.unsplash.com/photo-1449157291145-7efd050a4d0e?auto=format&fit=crop&w=640&q=80',
    ],
  },
];

async function seedProducts() {
  const categories = await prisma.category.findMany();
  const collections = await prisma.collection.findMany();
  const categoryIndex = Object.fromEntries(categories.map((category) => [category.slug, category.id]));
  const collectionIndex = Object.fromEntries(collections.map((collection) => [collection.slug, collection.id]));

  for (const product of productSeeds) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        brand: product.brand,
        sku: product.sku,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAt,
        stockQuantity: product.stock,
        images: {
          deleteMany: {},
          create: product.images.map((url, position) => ({ url, position })),
        },
        productLinks: {
          deleteMany: {},
          create: product.categories
            .map((slug, position) => categoryIndex[slug] && { categoryId: categoryIndex[slug], position })
            .filter(Boolean) as Array<{ categoryId: string; position: number }>,
        },
        collectionLinks: {
          deleteMany: {},
          create: product.collections
            .map((slug, position) => collectionIndex[slug] && { collectionId: collectionIndex[slug], position })
            .filter(Boolean) as Array<{ collectionId: string; position: number }>,
        },
      },
      create: {
        name: product.name,
        slug: product.slug,
        brand: product.brand,
        sku: product.sku,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAt,
        stockQuantity: product.stock,
        images: {
          create: product.images.map((url, position) => ({ url, position })),
        },
        productLinks: {
          create: product.categories
            .map((slug, position) => categoryIndex[slug] && { categoryId: categoryIndex[slug], position })
            .filter(Boolean) as Array<{ categoryId: string; position: number }>,
        },
        collectionLinks: {
          create: product.collections
            .map((slug, position) => collectionIndex[slug] && { collectionId: collectionIndex[slug], position })
            .filter(Boolean) as Array<{ collectionId: string; position: number }>,
        },
      },
    });
  }
}

async function seedBanners() {
  const heroBanners = Array.from({ length: 10 }, (_, index) => ({
    kind: 'HERO' as const,
    title: null,
    subtitle: null,
    ctaLabel: null,
    ctaHref: null,
    imageUrl: `/banner/bd${index + 1}.jpeg`,
    mobileImageUrl: `/banner/bc${index + 1}.jpeg`,
    position: index,
  }));

  const additionalBanners = [
    {
      kind: 'CAROUSEL' as const,
      title: 'Resultado em 28 dias',
      subtitle: 'Clinical Routine Controle+ com testes dermatológicos comprovados.',
      ctaLabel: 'Conhecer rotina',
      ctaHref: '/p/serum-dermosul-controle',
      imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1280&q=80',
      position: 0,
    },
    {
      kind: 'STRIP' as const,
      title: 'Frete Dermosul para todo Brasil em compras acima de R$ 400',
      subtitle: null,
      ctaLabel: 'Consulte condições',
      ctaHref: '/pg/politica-de-troca',
      imageUrl: 'https://images.unsplash.com/photo-1512498017271-dadfbf09c5ca?auto=format&fit=crop&w=1600&q=80',
      position: 0,
    },
  ];

  const banners = [...heroBanners, ...additionalBanners];

  for (const banner of banners) {
    const id = `banner-${banner.kind.toLowerCase()}-${banner.position}`;
    await prisma.banner.upsert({
      where: { id },
      update: banner,
      create: { id, ...banner },
    });
  }
}

async function seedMenus() {
  const header = await prisma.menu.upsert({
    where: { key: 'HEADER' },
    update: {},
    create: { key: 'HEADER' },
  });
  const footer = await prisma.menu.upsert({
    where: { key: 'FOOTER' },
    update: {},
    create: { key: 'FOOTER' },
  });

  await prisma.menuItem.deleteMany({ where: { menuId: { in: [header.id, footer.id] } } });

  await prisma.menuItem.createMany({
    data: [
      { menuId: header.id, label: 'Tratamento', href: '/c/tratamento', position: 0 },
      { menuId: header.id, label: 'Hidratação', href: '/c/hidratacao', position: 1 },
      { menuId: header.id, label: 'Limpeza', href: '/c/limpeza', position: 2 },
      { menuId: header.id, label: 'Mais vendidos', href: '/colecoes/mais-vendidos', position: 3 },
      { menuId: header.id, label: 'Newsletter', href: '/pg/sobre', position: 4 },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      { menuId: footer.id, label: 'Sobre a Dermosul', href: '/pg/sobre', position: 0 },
      { menuId: footer.id, label: 'Política de Troca', href: '/pg/politica-de-troca', position: 1 },
      { menuId: footer.id, label: 'Contato', href: 'mailto:atendimento@dermosul.com.br', position: 2 },
    ],
  });
}

async function seedPages() {
  await prisma.page.upsert({
    where: { slug: 'sobre' },
    update: {
      title: 'Sobre a Dermosul',
      contentHtml:
        '<p>A Dermosul combina dermatologia clínica, cosmetologia avançada e tecnologia proprietária para criar protocolos sob medida.</p><p>Nossa equipe multidisciplinar acompanha cada jornada de cuidado, assegurando performance e experiência sensorial.</p>',
      published: true,
      metaTitle: 'Sobre a Dermosul',
      metaDescription: 'Conheça a Dermosul e nossa metodologia clínica para dermocosméticos.',
    },
    create: {
      slug: 'sobre',
      title: 'Sobre a Dermosul',
      contentHtml:
        '<p>A Dermosul combina dermatologia clínica, cosmetologia avançada e tecnologia proprietária para criar protocolos sob medida.</p><p>Nossa equipe multidisciplinar acompanha cada jornada de cuidado, assegurando performance e experiência sensorial.</p>',
      published: true,
      metaTitle: 'Sobre a Dermosul',
      metaDescription: 'Conheça a Dermosul e nossa metodologia clínica para dermocosméticos.',
    },
  });

  await prisma.page.upsert({
    where: { slug: 'politica-de-troca' },
    update: {
      title: 'Política de Troca Dermosul',
      contentHtml:
        '<p>As trocas podem ser solicitadas em até 7 dias corridos após o recebimento.</p><p>Entre em contato com atendimento@dermosul.com.br informando o número do pedido e motivo.</p>',
      published: true,
      metaTitle: 'Política de Troca Dermosul',
      metaDescription: 'Saiba como solicitar trocas e devoluções de produtos Dermosul.',
    },
    create: {
      slug: 'politica-de-troca',
      title: 'Política de Troca Dermosul',
      contentHtml:
        '<p>As trocas podem ser solicitadas em até 7 dias corridos após o recebimento.</p><p>Entre em contato com atendimento@dermosul.com.br informando o número do pedido e motivo.</p>',
      published: true,
      metaTitle: 'Política de Troca Dermosul',
      metaDescription: 'Saiba como solicitar trocas e devoluções de produtos Dermosul.',
    },
  });
}

async function seedShippingMethods() {
  if (await prisma.shippingMethod.count()) {
    return;
  }
  await prisma.shippingMethod.createMany({
    data: [
      {
        name: 'Envio Expresso Dermosul',
        carrier: 'Dermosul Logistics',
        flatPriceCents: 1990,
        freeOverCents: 40000,
        deliveryEtaText: 'Capitais em até 3 dias úteis.',
        active: true,
      },
      {
        name: 'Envio Padrão',
        carrier: 'Correios',
        flatPriceCents: 1290,
        freeOverCents: null,
        deliveryEtaText: 'Brasil em até 7 dias úteis.',
        active: true,
      },
    ],
  });
}

async function seedCoupons() {
  await prisma.coupon.upsert({
    where: { code: 'DERMOSUL10' },
    update: { value: 10, type: 'PERCENT', active: true },
    create: {
      code: 'DERMOSUL10',
      type: 'PERCENT',
      value: 10,
      active: true,
    },
  });
}

async function main() {
  await seedOperator();
  await seedStoreSettings();
  await seedCategories();
  await seedCollections();
  await seedProducts();
  await seedBanners();
  await seedMenus();
  await seedPages();
  await seedShippingMethods();
  await seedCoupons();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
