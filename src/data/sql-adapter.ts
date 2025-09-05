// backend/data/sql-adapter.ts
import { Prisma, PaymentMethod } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { toISO, lastNDays, generateUniqueId, generateSlug, generateShortId } from '../utils/index.js'; // Importar utilitários

// --- Funções Utilitárias para Mapeamento e Conversão ---

// Converte valores monetários para centavos (Int)
const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (value: number): number => value / 100;

// Mapeia o método de pagamento do formato JSON para o enum do Prisma
const mapPaymentMethodToPrisma = (method: string): PaymentMethod => {
  switch (method.toLowerCase()) {
    case 'cartao':
    case 'cartão de crédito':
      return 'cartao';
    case 'pix':
      return 'pix';
    case 'boleto':
      return 'boleto';
    default:
      return 'desconhecido';
  }
};

// Validador de CPF (lógica idêntica à do frontend para consistência)
const validateCpf = (cpf: string): boolean => {
  const cleanedCpf = cpf.replace(/\D/g, '');
  if (cleanedCpf.length !== 11 || /^(\d)\1+$/.test(cleanedCpf)) {
    return false;
  }
  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanedCpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanedCpf.substring(9, 10))) {
    return false;
  }
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanedCpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cleanedCpf.substring(10, 11))) {
    return false;
  }
  return true;
};

// Mapeia um pedido do DB (Prisma) para o formato do frontend
function mapOrderFromPrisma(o: any): any {
  const first = o?.customer?.firstName || "";
  const last = o?.customer?.lastName || "";

  const itemsTotal = Array.isArray(o?.items) 
    ? o.items.reduce((sum: number, item: any) => {
        const itemPrice = Number(item.unitPrice || 0);
        const itemQty = Number(item.qty || 0);
        return sum + (itemQty * itemPrice);
      }, 0)
    : 0;

  return {
    id: o.id.substring(0, 8),
    fullId: o.id,
    createdAt: toISO(o.createdAt),
    client: `${first}${first && last ? " " : ""}${last}`.trim() || "Cliente",
    category: o.category,
    status: o.status,
    total: fromCents(o.totalAmount),
    paymentMethod: o.payments[0]?.paymentMethod || "desconhecido",
    payment: o.payments && o.payments.length > 0 ? {
      method: o.payments[0].paymentMethod || "desconhecido",
      status: o.payments[0].status || "pendente",
      installments: 1,
      paidAmount: fromCents(o.payments[0].paidAmount || 0),
    } : { method: "desconhecido", status: "pendente", installments: 1, paidAmount: 0 },
    clientInfo: o.customer ? { name: `${first} ${last}`.trim(), email: o.customer.email, phone: o.customer.phone } : { name: "Cliente", email: "", phone: "" },
    customer: o.customer ? {
      id: o.customer.id,
      firstName: o.customer.firstName || "",
      lastName: o.customer.lastName || "",
      cpf: o.customer.cpf || "",
      birthdate: o.customer.birthDate || "",
      email: o.customer.email || "",
      phone: o.customer.phone || "",
      gender: o.customer.gender || "",
    } : {
      id: "", firstName: "", lastName: "", cpf: "", birthdate: "", email: "", phone: "", gender: ""
    },
    shipping: o.customer?.addresses[0] ? {
      postalCode: o.customer.addresses[0].cep || "",
      address1: o.customer.addresses[0].street || "",
      address2: o.customer.addresses[0].number || "",
      address2_complement: o.customer.addresses[0].complement || "",
      district: o.customer.addresses[0].district || "",
      city: o.customer.addresses[0].city || "",
      state: o.customer.addresses[0].state || "",
    } : {
      postalCode: "", address1: "", address2: "", address2_complement: "", district: "", city: "", state: ""
    },
    items: Array.isArray(o?.items) ? o.items.map((item: any) => ({
      sku: item.sku || "",
      name: item.name || "Produto",
      qty: item.qty || 0,
      price: fromCents(item.unitPrice || 0),
      subtotal: fromCents(Number(item.qty || 0) * Number(item.unitPrice || 0)),
    })) : [],
    totals: {
      itemsTotal: fromCents(itemsTotal),
      shipping: 0,
      discount: 0,
      grandTotal: fromCents(o.totalAmount),
      subTotal: fromCents(itemsTotal),
      total: fromCents(o.totalAmount),
    },
    timeline: []
  };
}

// --- Funções do Adaptador de Dados SQL ---

export async function listOrders(params: any): Promise<any> {
  const {
    status,
    category,
    dateFrom,
    dateTo,
    sort,
    q,
    page = "1",
    pageSize = "20"
  } = params;

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (category) {
    where.category = {
      contains: category,
    };
  }
  if (dateFrom) {
    where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
  }
  if (dateTo) {
    where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
  }
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { customer: { firstName: { contains: q } } },
      { customer: { lastName: { contains: q } } },
    ];
  }

  let orderBy: any = { createdAt: 'desc' };
  if (sort) {
    // Aceita formatos antigos (dateAsc/dateDesc/valueAsc/valueDesc/clientAsc/clientDesc)
    switch (sort) {
      case 'dateAsc': orderBy = { createdAt: 'asc' }; break;
      case 'dateDesc': orderBy = { createdAt: 'desc' }; break;
      case 'valueAsc': orderBy = { totalAmount: 'asc' }; break;
      case 'valueDesc': orderBy = { totalAmount: 'desc' }; break;
      case 'clientAsc': orderBy = [{ customer: { firstName: 'asc' } }, { customer: { lastName: 'asc' } }]; break;
      case 'clientDesc': orderBy = [{ customer: { firstName: 'desc' } }, { customer: { lastName: 'desc' } }]; break;
      default: {
        // Também aceita "createdAt:desc" ou "createdAt,desc"
        const s = String(sort);
        let field = '';
        let dir = '';
        if (s.includes(':')) {
          [field, dir] = s.split(':');
        } else if (s.includes(',')) {
          [field, dir] = s.split(',');
        }
        field = (field || '').trim();
        dir = (dir || '').trim().toLowerCase();
        if ((field === 'createdAt' || field === 'total' || field === 'totalAmount') && (dir === 'asc' || dir === 'desc')) {
          if (field === 'total') field = 'totalAmount';
          orderBy = { [field]: dir } as any;
        }
      }
    }
  }

  const p = Math.max(parseInt(page, 10) || 1, 1);
  const ps = Math.max(parseInt(pageSize, 10) || 20, 1);
  const skip = (p - 1) * ps;

  let orders: any[] = [];
  let total = 0;
  try {
    [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take: ps,
        include: {
          customer: { include: { addresses: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.order.count({ where }),
    ]);
  } catch (e) {
    // Fallback: se orderBy composto não for aceito por alguma versão do Prisma
    try {
      [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: ps,
          include: {
            customer: { include: { addresses: true } },
            items: true,
            payments: true,
          },
        }),
        prisma.order.count({ where }),
      ]);
    } catch (err) {
      throw err;
    }
  }

  return {
    items: orders.map(mapOrderFromPrisma),
    total,
    page: p,
    pageSize: ps,
    totalPages: Math.max(Math.ceil(total / ps), 1)
  };
}

export async function getOrderById(id: string): Promise<any | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: true
        }
      },
      items: true,
      payments: true,
    },
  });
  return order ? mapOrderFromPrisma(order) : null;
}

export async function createOrder(orderData: any): Promise<any> {
  if (!orderData.customer?.email || !orderData.customer?.cpf) {
    throw new Error("Email e CPF do cliente são obrigatórios.");
  }

  let customer = await prisma.customer.findUnique({
    where: { email: orderData.customer.email },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        firstName: orderData.customer.firstName || "",
        lastName: orderData.customer.lastName || "",
        email: orderData.customer.email,
        phone: orderData.customer.phone || "",
        cpf: orderData.customer.cpf,
        birthDate: orderData.customer.birthDate || toISO(new Date()),
        gender: orderData.customer.gender,
      },
    });
  }

  if (orderData.shipping?.postalCode && customer) {
    let address = await prisma.address.findFirst({
      where: {
        customerId: customer.id,
        cep: orderData.shipping.postalCode,
        street: orderData.shipping.address1,
        number: orderData.shipping.address2,
      }
    });
    if (!address) {
      await prisma.address.create({
        data: {
          customerId: customer.id,
          cep: orderData.shipping.postalCode,
          street: orderData.shipping.address1,
          number: orderData.shipping.address2,
          complement: orderData.shipping.address2_complement || "",
          district: orderData.shipping.district || "",
          city: orderData.shipping.city || "",
          state: orderData.shipping.state || "",
        }
      });
    }
  }

  const newOrder = await prisma.order.create({
    data: {
      id: generateShortId(),
      customer: { connect: { id: customer!.id } },
      status: orderData.status.toLowerCase() as any,
      category: orderData.category || "Outros",
      totalAmount: toCents(orderData.total_value),
      createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
      items: {
        create: Array.isArray(orderData.items) ? orderData.items.map((item: any) => ({
          sku: item.sku || "",
          name: item.name || "Produto",
          qty: item.qty || 0,
          unitPrice: toCents(item.price || 0),
        })) : [],
      },
      payments: {
        create: Array.isArray(orderData.payments) ? orderData.payments.map((payment: any) => ({
          paymentMethod: mapPaymentMethodToPrisma(payment.method) as any,
          paidAmount: toCents(payment.value || 0),
          status: payment.status || "pendente",
        })) : [],
      },
    },
    include: {
      customer: {
        include: {
          addresses: true
        }
      },
      items: true,
      payments: true,
    },
  });

  return mapOrderFromPrisma(newOrder);
}

export async function updateOrder(id: string, updatedFields: any): Promise<any | null> {
  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { customer: { include: { addresses: true } }, items: true, payments: true },
  });

  if (!existingOrder) {
    return null;
  }

  if (updatedFields.customer || updatedFields.shipping) {
    let customer = await prisma.customer.findUnique({ where: { id: existingOrder.customerId } });
    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          firstName: updatedFields.customer?.firstName || customer.firstName,
          lastName: updatedFields.customer?.lastName || customer.lastName,
          email: updatedFields.customer?.email || customer.email,
          phone: updatedFields.customer?.phone || customer.phone,
          cpf: updatedFields.customer?.cpf || customer.cpf,
          birthDate: updatedFields.customer?.birthDate || customer.birthDate,
          gender: updatedFields.customer?.gender || customer.gender,
        },
      });

      if (updatedFields.shipping?.postalCode) {
        let address = await prisma.address.findFirst({
          where: {
            customerId: customer.id,
            cep: updatedFields.shipping.postalCode,
            street: updatedFields.shipping.address1,
            number: updatedFields.shipping.address2,
          }
        });
        if (address) {
          await prisma.address.update({
            where: { id: address.id },
            data: {
              complement: updatedFields.shipping.address2_complement || address.complement,
              district: updatedFields.shipping.district || address.district,
              city: updatedFields.shipping.city || address.city,
              state: updatedFields.shipping.state || address.state,
            }
          });
        } else {
          await prisma.address.create({
            data: {
              customerId: customer.id,
              cep: updatedFields.shipping.postalCode,
              street: updatedFields.shipping.address1,
              number: updatedFields.shipping.address2,
              complement: updatedFields.shipping.address2_complement || "",
              district: updatedFields.shipping.district || "",
              city: updatedFields.shipping.city || "",
              state: updatedFields.shipping.state || "",
            }
          });
        }
      }
    }
  }

  await prisma.order.update({
    where: { id },
    data: {
      status: updatedFields.status ? updatedFields.status.toLowerCase() as any : existingOrder.status,
      category: updatedFields.category || existingOrder.category,
      totalAmount: updatedFields.total ? toCents(updatedFields.total) : Number(existingOrder.totalAmount),
      createdAt: updatedFields.createdAt ? new Date(updatedFields.createdAt) : existingOrder.createdAt,
    },
  });

  if (updatedFields.status === 'cancelado') {
    await prisma.payment.updateMany({
      where: { orderId: id },
      data: { status: 'cancelado' },
    });
  } else if (updatedFields.status === 'pago') {
    await prisma.payment.updateMany({
      where: { orderId: id },
      data: { status: 'confirmado' },
    });
  }

  if (updatedFields.paymentMethod && existingOrder.payments.length > 0) {
    await prisma.payment.update({
      where: { id: existingOrder.payments[0].id },
      data: {
        paymentMethod: mapPaymentMethodToPrisma(updatedFields.paymentMethod) as any,
      },
    });
  }

  // Refetch the order to get the updated payment status
  const finalOrder = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        include: {
          addresses: true
        }
      },
      items: true,
      payments: true,
    },
  });

  return mapOrderFromPrisma(finalOrder);
}

export async function deleteOrder(id: string): Promise<boolean> {
  try {
    // A exclusão em cascata configurada no Prisma cuidará de remover itens e pagamentos relacionados
    await prisma.order.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error(`Erro ao deletar pedido ${id}:`, error);
    // Lançar o erro permite que a camada da API o capture e retorne uma resposta 500
    throw new Error("Falha ao deletar o pedido no banco de dados.");
  }
}

export async function statsLast14Days(): Promise<any> {
  const days = lastNDays(14);
  const startDate = new Date(days[0]);

  // Conta todos os pedidos (qualquer status) para calcular taxa de conversão
  const allOrdersCount = await prisma.order.count({
    where: {
      createdAt: { gte: startDate },
    },
  });

  // Considera apenas pedidos pagos (e enviados) para métricas principais
  const paidOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: startDate },
      status: { in: ['pago', 'enviado'] },
    },
    include: { payments: true },
  });

  const totalOrders = paidOrders.length;
  const totalRevenue = paidOrders.reduce((sum, o) => sum + fromCents(o.totalAmount), 0);
  const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
  const convAvg = allOrdersCount ? (totalOrders / allOrdersCount) * 100 : 0;
  const breakdown = await paymentsBreakdown();

  return {
    totalRevenue,
    totalOrders,
    avgTicket,
    convAvg,
    paymentsBreakdown: breakdown,
  };
}

export async function paymentsBreakdown(): Promise<{ method: string; amount: number }[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const paymentAggregates = await prisma.payment.groupBy({
    by: ['paymentMethod'],
    _sum: {
      paidAmount: true,
    },
    where: {
      status: 'confirmado', // Considera apenas pagamentos confirmados
      order: {
        createdAt: {
          gte: fourteenDaysAgo,
        },
        // Considera pedidos pagos ou já enviados
        status: {
          in: ['pago', 'enviado'],
        },
      },
    },
  });

  if (!paymentAggregates || paymentAggregates.length === 0) {
    return [];
  }

  const breakdown = paymentAggregates.map((group) => ({
    method: group.paymentMethod || 'desconhecido',
    amount: fromCents(group._sum.paidAmount || 0),
  }));

  return breakdown;
}

export async function listLandingPages(): Promise<any[]> {
  try {
    const landingPages = await prisma.landingPage.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        slug: true,
        template: true,
        title: true,
        description: true,
        brand: true,
        price: true,
        freeShipping: true,
        imageUrl: true,
        shippingPrice: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return landingPages.map((lp: any) => ({
      id: lp.id,
      slug: lp.slug || '',
      template: lp.template || 'MODELO_1',
      productTitle: lp.title || 'Produto sem Título',
      productDescription: lp.description || '',
      productBrand: lp.brand || 'Marca Desconhecida',
      productPrice: fromCents(lp.price || 0),
      freeShipping: lp.freeShipping || false,
      imageUrl: lp.imageUrl || '',
      shippingValue: fromCents(lp.shippingPrice || 0),
      status: lp.status,
      createdAt: lp.createdAt ? lp.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: lp.updatedAt ? lp.updatedAt.toISOString() : undefined,
      url: lp.slug ? `/l/${lp.slug}` : '',
    }));
  } catch (error) {
    console.error("Erro detalhado ao listar landing pages no sql-adapter:", error);
    throw error;
  }
}

export async function createLandingPage(data: any): Promise<any> {
  if (!data.productTitle || data.productTitle.trim() === "") {
    throw new Error("Título do produto é obrigatório.");
  }
  if (!data.productBrand || data.productBrand.trim() === "") {
    throw new Error("Marca é obrigatória.");
  }
  if (data.productPrice === undefined || isNaN(Number(data.productPrice))) {
    throw new Error("Preço do produto é obrigatório e deve ser um número.");
  }
  if (!Boolean(data.freeShipping) && (data.shippingValue === undefined || isNaN(Number(data.shippingValue)))) {
    throw new Error("Valor do frete é obrigatório quando frete grátis não está marcado.");
  }

  const slug = data.slug || await generateSlug(data.productTitle);

  const newLandingPage = await prisma.landingPage.create({
    data: {
      slug,
      template: data.template || 'MODELO_1',
      title: data.productTitle,
      brand: data.productBrand,
      description: data.productDescription || "",
      price: toCents(Number(data.productPrice || 0)),
      freeShipping: Boolean(data.freeShipping),
      imageUrl: data.imageUrl || '',
      shippingPrice: toCents(Boolean(data.freeShipping) ? 0 : Number(data.shippingValue || 0)),
      createdAt: new Date(),
    },
  });

  return {
    id: newLandingPage.id,
    slug: newLandingPage.slug,
    template: newLandingPage.template,
    productTitle: newLandingPage.title,
    productDescription: newLandingPage.description || '',
    productBrand: newLandingPage.brand,
    productPrice: fromCents(newLandingPage.price || 0),
    freeShipping: newLandingPage.freeShipping,
    imageUrl: newLandingPage.imageUrl || '',
    shippingValue: fromCents(newLandingPage.shippingPrice || 0),
    createdAt: newLandingPage.createdAt.toISOString(),
    updatedAt: newLandingPage.updatedAt ? newLandingPage.updatedAt.toISOString() : undefined,
    url: `/l/${newLandingPage.slug}`,
  };
}

export async function updateLandingPage(id: string, data: any): Promise<any | null> {
  const existingLandingPage = await prisma.landingPage.findUnique({
    where: { id },
  });

  if (!existingLandingPage) {
    return null;
  }

  if (!data.productTitle || data.productTitle.trim() === "") {
    throw new Error("Título do produto é obrigatório.");
  }
  if (!data.productBrand || data.productBrand.trim() === "") {
    throw new Error("Marca é obrigatória.");
  }
  if (data.productPrice === undefined || isNaN(Number(data.productPrice)) || Number(data.productPrice) <= 0) {
    throw new Error("Preço do produto é obrigatório e deve ser um número positivo.");
  }
  if (!Boolean(data.freeShipping) && (data.shippingValue === undefined || isNaN(Number(data.shippingValue)) || Number(data.shippingValue) < 0)) {
    throw new Error("Valor do frete é obrigatório e deve ser um número não negativo quando o frete grátis não está marcado.");
  }

  let updatedSlug = existingLandingPage.slug;
  if (data.productTitle !== existingLandingPage.title) {
    updatedSlug = await generateSlug(data.productTitle);
  }

  const updatedLandingPage = await prisma.landingPage.update({
    where: { id },
    data: {
      slug: updatedSlug,
      template: data.template || existingLandingPage.template,
      title: data.productTitle,
      brand: data.productBrand,
      description: data.productDescription || "",
      price: toCents(Number(data.productPrice || 0)),
      freeShipping: Boolean(data.freeShipping),
      imageUrl: data.imageUrl || existingLandingPage.imageUrl,
      shippingPrice: toCents(Boolean(data.freeShipping) ? 0 : Number(data.shippingValue || 0)),
      updatedAt: new Date(),
    },
  });

  return {
    id: updatedLandingPage.id,
    slug: updatedLandingPage.slug,
    template: updatedLandingPage.template,
    productTitle: updatedLandingPage.title,
    productDescription: updatedLandingPage.description || '',
    productBrand: updatedLandingPage.brand,
    productPrice: fromCents(updatedLandingPage.price || 0),
    freeShipping: updatedLandingPage.freeShipping,
    imageUrl: updatedLandingPage.imageUrl || '',
    shippingValue: fromCents(updatedLandingPage.shippingPrice || 0),
    createdAt: updatedLandingPage.createdAt.toISOString(),
    updatedAt: updatedLandingPage.updatedAt ? updatedLandingPage.updatedAt.toISOString() : undefined,
    url: `/l/${updatedLandingPage.slug}`,
  };
}

export async function deleteLandingPage(id: string): Promise<boolean> {
  try {
    await prisma.landingPage.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    console.error("Erro ao deletar landing page:", error);
    return false;
  }
}

export async function getLandingBySlug(slug: string) {
  const lp = await prisma.landingPage.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      template: true,
      title: true,
      brand: true,
      description: true,
      price: true,
      freeShipping: true,
      shippingPrice: true,
      imageUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  if (!lp) return null;
  return {
    id: lp.id,
    slug: lp.slug,
    template: lp.template,
    productTitle: lp.title,
    productBrand: lp.brand,
    productDescription: lp.description,
    productPrice: fromCents(lp.price),
    freeShipping: lp.freeShipping,
    shippingValue: fromCents(lp.shippingPrice),
    imageUrl: lp.imageUrl,
    status: lp.status,
    createdAt: lp.createdAt.toISOString(),
    updatedAt: lp.updatedAt?.toISOString(),
  };
}

export async function updateLandingPageStatus(id: string, status: 'ATIVA' | 'PAUSADA'): Promise<any | null> {
  const lp = await prisma.landingPage.update({
    where: { id },
    data: { status },
    select: {
      id: true,
      slug: true,
      template: true,
      title: true,
      brand: true,
      description: true,
      price: true,
      freeShipping: true,
      imageUrl: true,
      shippingPrice: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  // Normalize response to avoid BigInt serialization and keep API consistent
  return {
    id: lp.id,
    slug: lp.slug,
    template: lp.template,
    productTitle: lp.title,
    productBrand: lp.brand,
    productDescription: lp.description || '',
    productPrice: fromCents(lp.price || 0),
    freeShipping: lp.freeShipping,
    imageUrl: lp.imageUrl || '',
    shippingValue: fromCents(lp.shippingPrice || 0),
    status: lp.status,
    createdAt: lp.createdAt.toISOString(),
    updatedAt: lp.updatedAt ? lp.updatedAt.toISOString() : undefined,
    url: `/l/${lp.slug}`,
  };
}

export async function getOrderByExternalReference(externalReference: string): Promise<any | null> {
  const order = await prisma.order.findUnique({
    where: { externalReference },
    include: {
      customer: {
        include: {
          addresses: true
        }
      },
      items: true,
      payments: true,
    },
  });
  return order ? mapOrderFromPrisma(order) : null;
}

function safeStringify(value: any) {
  try {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  } catch {
    return String(value);
  }
}

export async function createPublicOrder(orderData: any): Promise<any> {
  console.log("1. Recebido payload bruto:", safeStringify(orderData));

  const errors: { [key: string]: string } = {};

  // --- 2. Validação e Normalização ---
  const {
    email,
    firstName, lastName,
    cep, address, addressNumber, district, city, state,
    cpf, phone, birthDate, gender,
    productId, productTitle, productPrice, qty,
    externalReference, // Captura a referência externa
  } = orderData;

  // Validações de campos obrigatórios
  if (!firstName) errors.firstName = "Nome é obrigatório.";
  if (!lastName) errors.lastName = "Sobrenome é obrigatório.";
  if (!email || !/\S+@\S+\.\S+/.test(email)) errors.email = "Email inválido.";
  if (!cep) errors.cep = "CEP é obrigatório.";
  if (!address) errors.address = "Rua é obrigatória.";
  if (!addressNumber) errors.addressNumber = "Número é obrigatório.";
  if (!district) errors.district = "Bairro é obrigatório.";
  if (!city) errors.city = "Cidade é obrigatória.";
  if (!state) errors.state = "Estado é obrigatório.";
  if (!gender) errors.gender = "Gênero é obrigatório.";

  // Validações de formato
  const cleanedCpf = (cpf || '').replace(/\D/g, '');
  if (!validateCpf(cleanedCpf)) {
    errors.cpf = "CPF inválido.";
  }

  const cleanedPhone = (phone || '').replace(/\D/g, '');
  if (cleanedPhone.length < 10) errors.phone = "Telefone inválido (mínimo 10 dígitos).";

  if (!birthDate) {
    errors.birthDate = "Data de nascimento é obrigatória.";
  } else {
    const dateParts = birthDate.split('-');
    if (dateParts.length !== 3) {
      errors.birthDate = "Formato de data inválido. Use YYYY-MM-DD.";
    } else {
      const [year, month, day] = dateParts.map(Number);
      const testDate = new Date(year, month - 1, day);
      if (testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
        errors.birthDate = "Data de nascimento inválida (ex: 31/02 não existe).";
      }
    }
  }

  if (gender && !['FEMININO', 'MASCULINO'].includes(gender.toUpperCase())) {
    errors.gender = "Gênero inválido. Use 'FEMININO' ou 'MASCULINO'.";
  }

  // Validações de produto
  if (!productId) errors.productId = "ID do produto é obrigatório.";
  if (!productTitle) errors.productTitle = "Título do produto é obrigatório.";
  const numQty = parseInt(qty, 10);
  if (isNaN(numQty) || numQty <= 0) errors.qty = "Quantidade deve ser um número positivo.";
  const numPrice = parseFloat(productPrice);
  if (isNaN(numPrice) || numPrice <= 0) errors.productPrice = "Preço do produto deve ser um número positivo.";

  // Se houver erros, lança uma exceção com o objeto de erros
  if (Object.keys(errors).length > 0) {
    const error = new Error("Dados inválidos.");
    (error as any).details = errors; // Adiciona detalhes ao erro
    throw error;
  }

  const totalAmountInCents = toCents(numPrice) * numQty;

  const normalizedPayload = {
    customer: {
      firstName,
      lastName,
      email,
      phone: cleanedPhone,
      cpf: cleanedCpf,
      birthDate,
      gender: gender.toUpperCase() || null,
    },
    address: {
      cep,
      street: address,
      number: addressNumber,
      complement: orderData.complement || '',
      district: orderData.district || '',
      city,
      state,
    },
    item: {
      sku: productId,
      name: productTitle,
      qty: numQty,
      unitPrice: toCents(numPrice),
    },
    totalAmount: totalAmountInCents,
    paymentMethod: orderData.paymentMethod || 'cartao',
  };

  console.log("3. Payload normalizado:", safeStringify(normalizedPayload));

  // --- 4. Transação Atômica ---
  try {
    const newOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Upsert Cliente com base em CPF ou Email para evitar conflitos de unicidade
      let customer = await tx.customer.findFirst({
        where: {
          OR: [
            { email: normalizedPayload.customer.email },
            { cpf: normalizedPayload.customer.cpf },
          ],
        },
      });

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: normalizedPayload.customer,
        });
        console.log(`4.1. Cliente ${customer.id} atualizado.`);
      } else {
        customer = await tx.customer.create({ data: normalizedPayload.customer });
        console.log(`4.1. Cliente ${customer.id} criado.`);
      }

      // Criar Endereço (sempre um novo para este fluxo)
      const address = await tx.address.create({
        data: {
          customerId: customer.id,
          ...normalizedPayload.address,
        },
      });
      console.log(`4.2. Endereço ${address.id} criado.`);

      // Criar Pedido
      const order = await tx.order.create({
        data: {
          id: generateShortId(),
          externalReference: externalReference, // Salva a referência externa
          customer: { connect: { id: customer.id } },
          status: orderData.status || 'pendente', // Usa o status do payload
          category: "Online",
          totalAmount: normalizedPayload.totalAmount,
          items: { create: [normalizedPayload.item] },
          payments: {
            create: {
              paymentMethod: mapPaymentMethodToPrisma(normalizedPayload.paymentMethod),
              paidAmount: normalizedPayload.totalAmount,
              status: orderData.status === 'pago' ? 'confirmado' : 'pendente',
            },
          },
        },
        include: {
          customer: { include: { addresses: true } },
          items: true,
          payments: true,
        },
      });
      console.log(`4.3. Pedido ${order.id} criado.`);
      return order;
    });

    console.log("5. Transação concluída com sucesso.");
    return mapOrderFromPrisma(newOrder);

  } catch (error) {
    console.error("Erro durante a transação do Prisma:", error);
    if (error instanceof Error) {
      // Lança um erro mais específico para ser capturado pela API
      throw new Error(`Falha na operação do banco de dados: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido durante a criação do pedido.");
  }
}

export async function updateOrderStatusByExternalReference(externalReference: string, status: 'pago' | 'cancelado' | 'pendente'): Promise<any | null> {
  console.log(`Updating order with externalReference ${externalReference} to status ${status}`);
  
  const order = await prisma.order.findUnique({
    where: { externalReference: externalReference }
  });

  if (order) {
    console.log(`Order ${order.id} found. Updating status to ${status}.`);
    return await updateOrder(order.id, { status });
  }

  console.warn(`Order with externalReference ${externalReference} not found.`);
  return null;
}
