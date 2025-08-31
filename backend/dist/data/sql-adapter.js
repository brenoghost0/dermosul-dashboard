"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrders = listOrders;
exports.getOrderById = getOrderById;
exports.createOrder = createOrder;
exports.updateOrder = updateOrder;
exports.statsLast14Days = statsLast14Days;
exports.paymentsBreakdown = paymentsBreakdown;
exports.listLandingPages = listLandingPages;
exports.createLandingPage = createLandingPage;
exports.updateLandingPage = updateLandingPage;
exports.deleteLandingPage = deleteLandingPage;
exports.getLandingPageBySlug = getLandingPageBySlug;
// backend/data/sql-adapter.ts
const prisma_1 = require("../db/prisma");
const utils_1 = require("../utils"); // Importar utilitários
// --- Funções Utilitárias para Mapeamento e Conversão ---
// Converte valores monetários para centavos (inteiros)
const toCents = (value) => Math.round(value * 100);
const fromCents = (value) => value / 100;
// Mapeia o método de pagamento do formato JSON para o enum do Prisma
const mapPaymentMethodToPrisma = (method) => {
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
// Mapeia um pedido do DB (Prisma) para o formato do frontend
function mapOrderFromPrisma(o) {
    const first = o?.customer?.firstName || "";
    const last = o?.customer?.lastName || "";
    return {
        id: o.id,
        createdAt: (0, utils_1.toISO)(o.createdAt),
        client: `${first}${first && last ? " " : ""}${last}`.trim() || "Cliente",
        category: o.category,
        status: o.status,
        total: fromCents(o.totalAmount),
        paymentMethod: o.payments[0]?.paymentMethod || "desconhecido",
        payment: o.payments && o.payments.length > 0 ? {
            method: o.payments[0].paymentMethod || "desconhecido",
            status: o.payments[0].status || "pendente",
            installments: 1, // Prisma não tem installments, assumir 1
            paidAmount: fromCents(o.payments[0].paidAmount || 0),
        } : { method: "desconhecido", status: "pendente", installments: 1, paidAmount: 0 },
        clientInfo: o.customer ? { name: `${first} ${last}`.trim(), email: o.customer.email, phone: o.customer.phone } : { name: "Cliente", email: "", phone: "" },
        customer: o.customer ? {
            id: o.customer.id,
            firstName: o.customer.firstName || "",
            lastName: o.customer.lastName || "",
            cpf: o.customer.cpf || "",
            birthDate: o.customer.birthDate || "",
            email: o.customer.email || "",
            phone: o.customer.phone || "",
            zip: o.customer.addresses[0]?.cep || "",
            address: o.customer.addresses[0]?.street || "",
            number: o.customer.addresses[0]?.number || "",
            complement: o.customer.addresses[0]?.complement || "",
            district: o.customer.addresses[0]?.district || "",
            city: o.customer.addresses[0]?.city || "",
            state: o.customer.addresses[0]?.state || "",
        } : {
            id: "", firstName: "", lastName: "", cpf: "", birthDate: "", email: "", phone: "",
            zip: "", address: "", number: "", complement: "", district: "", city: "", state: ""
        },
        shipping: o.customer?.addresses[0] ? {
            method: "Padrão",
            postalCode: o.customer.addresses[0].cep || "",
            address1: o.customer.addresses[0].street || "",
            address2: o.customer.addresses[0].number || "",
            address2_complement: o.customer.addresses[0].complement || "",
            district: o.customer.addresses[0].district || "",
            city: o.customer.addresses[0].city || "",
            state: o.customer.addresses[0].state || "",
            value: 0,
        } : {
            method: "Padrão", postalCode: "", address1: "", address2: "", address2_complement: "",
            district: "", city: "", state: "", value: 0
        },
        items: Array.isArray(o?.items) ? o.items.map((item) => ({
            sku: item.sku || "",
            name: item.name || "Produto",
            qty: item.qty || 0,
            price: fromCents(item.unitPrice || 0),
            subtotal: fromCents((item.qty || 0) * (item.unitPrice || 0)),
        })) : [],
        totals: {
            itemsTotal: fromCents(o.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)),
            shipping: 0,
            discount: 0,
            grandTotal: fromCents(o.totalAmount),
            subTotal: fromCents(o.items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0)),
            total: fromCents(o.totalAmount),
        },
        timeline: [],
        _raw: o
    };
}
// --- Funções do Adaptador de Dados SQL ---
async function listOrders(params) {
    const { status, category, dateFrom, dateTo, sort, page = "1", pageSize = "20" } = params;
    const where = {};
    if (status) {
        where.status = status.toUpperCase();
    }
    if (category) {
        where.category = category;
    }
    if (dateFrom) {
        where.createdAt = { ...where.createdAt, gte: new Date(dateFrom) };
    }
    if (dateTo) {
        where.createdAt = { ...where.createdAt, lte: new Date(dateTo) };
    }
    const orderBy = {};
    if (sort) {
        const [field, order] = String(sort).split(",");
        orderBy[field === 'createdAt' ? 'createdAt' : field] = order;
    }
    else {
        orderBy.createdAt = 'desc';
    }
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.max(parseInt(pageSize, 10) || 20, 1);
    const skip = (p - 1) * ps;
    const [orders, total] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.order.findMany({
            where,
            orderBy,
            skip,
            take: ps,
            include: {
                customer: {
                    include: {
                        addresses: true
                    }
                },
                items: true,
                payments: true,
            },
        }),
        prisma_1.prisma.order.count({ where }),
    ]);
    return {
        items: orders.map(mapOrderFromPrisma),
        total,
        page: p,
        pageSize: ps,
        totalPages: Math.max(Math.ceil(total / ps), 1)
    };
}
async function getOrderById(id) {
    const order = await prisma_1.prisma.order.findUnique({
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
async function createOrder(orderData) {
    if (!orderData.customer?.email || !orderData.customer?.cpf) {
        throw new Error("Email e CPF do cliente são obrigatórios.");
    }
    let customer = await prisma_1.prisma.customer.findUnique({
        where: { email: orderData.customer.email },
    });
    if (!customer) {
        customer = await prisma_1.prisma.customer.create({
            data: {
                firstName: orderData.customer.firstName || "",
                lastName: orderData.customer.lastName || "",
                email: orderData.customer.email,
                phone: orderData.customer.phone || "",
                cpf: orderData.customer.cpf,
                birthDate: orderData.customer.birthDate || (0, utils_1.toISO)(new Date()),
            },
        });
    }
    if (orderData.shipping?.postalCode && customer) {
        let address = await prisma_1.prisma.address.findFirst({
            where: {
                customerId: customer.id,
                cep: orderData.shipping.postalCode,
                street: orderData.shipping.address1,
                number: orderData.shipping.address2,
            }
        });
        if (!address) {
            await prisma_1.prisma.address.create({
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
    const newOrder = await prisma_1.prisma.order.create({
        data: {
            customer: { connect: { id: customer.id } },
            status: orderData.status.toLowerCase(),
            category: orderData.category || "Outros",
            totalAmount: toCents(orderData.total_value),
            createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
            items: {
                create: Array.isArray(orderData.items) ? orderData.items.map((item) => ({
                    sku: item.sku || "",
                    name: item.name || "Produto",
                    qty: item.qty || 0,
                    unitPrice: toCents(item.price || 0),
                })) : [],
            },
            payments: {
                create: Array.isArray(orderData.payments) ? orderData.payments.map((payment) => ({
                    paymentMethod: mapPaymentMethodToPrisma(payment.method),
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
async function updateOrder(id, updatedFields) {
    const existingOrder = await prisma_1.prisma.order.findUnique({
        where: { id },
        include: { customer: { include: { addresses: true } }, items: true, payments: true },
    });
    if (!existingOrder) {
        return null;
    }
    if (updatedFields.customer || updatedFields.shipping) {
        let customer = await prisma_1.prisma.customer.findUnique({ where: { id: existingOrder.customerId } });
        if (customer) {
            customer = await prisma_1.prisma.customer.update({
                where: { id: customer.id },
                data: {
                    firstName: updatedFields.customer?.firstName || customer.firstName,
                    lastName: updatedFields.customer?.lastName || customer.lastName,
                    email: updatedFields.customer?.email || customer.email,
                    phone: updatedFields.customer?.phone || customer.phone,
                    cpf: updatedFields.customer?.cpf || customer.cpf,
                    birthDate: updatedFields.customer?.birthDate || customer.birthDate,
                },
            });
            if (updatedFields.shipping?.postalCode) {
                let address = await prisma_1.prisma.address.findFirst({
                    where: {
                        customerId: customer.id,
                        cep: updatedFields.shipping.postalCode,
                        street: updatedFields.shipping.address1,
                        number: updatedFields.shipping.address2,
                    }
                });
                if (address) {
                    await prisma_1.prisma.address.update({
                        where: { id: address.id },
                        data: {
                            complement: updatedFields.shipping.address2_complement || address.complement,
                            district: updatedFields.shipping.district || address.district,
                            city: updatedFields.shipping.city || address.city,
                            state: updatedFields.shipping.state || address.state,
                        }
                    });
                }
                else {
                    await prisma_1.prisma.address.create({
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
    const updatedOrder = await prisma_1.prisma.order.update({
        where: { id },
        data: {
            status: updatedFields.status ? updatedFields.status.toLowerCase() : existingOrder.status,
            category: updatedFields.category || existingOrder.category,
            totalAmount: updatedFields.total ? toCents(updatedFields.total) : existingOrder.totalAmount,
            createdAt: updatedFields.createdAt ? new Date(updatedFields.createdAt) : existingOrder.createdAt,
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
    if (updatedFields.paymentMethod && existingOrder.payments.length > 0) {
        await prisma_1.prisma.payment.update({
            where: { id: existingOrder.payments[0].id },
            data: {
                paymentMethod: mapPaymentMethodToPrisma(updatedFields.paymentMethod),
            },
        });
    }
    return mapOrderFromPrisma(updatedOrder);
}
async function statsLast14Days() {
    const days = (0, utils_1.lastNDays)(14);
    const startDate = new Date(days[0]);
    const orders = await prisma_1.prisma.order.findMany({
        where: {
            createdAt: {
                gte: startDate,
            },
        },
        include: {
            payments: true,
        },
    });
    let totalRevenue = 0;
    let totalOrders = orders.length;
    let paidOrders = 0;
    for (const o of orders) {
        totalRevenue += fromCents(o.totalAmount);
        if (o.status === "pago")
            paidOrders += 1;
    }
    const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;
    const convAvg = totalOrders ? (paidOrders / totalOrders) * 100 : 0;
    const breakdown = await paymentsBreakdown();
    return {
        totalRevenue,
        totalOrders,
        avgTicket,
        convAvg,
        paymentsBreakdown: breakdown,
    };
}
async function paymentsBreakdown() {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const paymentAggregates = await prisma_1.prisma.payment.groupBy({
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
async function listLandingPages() {
    try {
        const landingPages = await prisma_1.prisma.landingPage.findMany({
            orderBy: {
                createdAt: 'desc',
            },
        });
        return landingPages.map((lp) => ({
            id: lp.id,
            slug: lp.slug || '',
            productTitle: lp.title || 'Produto sem Título',
            productDescription: lp.description || '',
            productBrand: lp.brand || 'Marca Desconhecida',
            productPrice: fromCents(lp.price || 0),
            freeShipping: lp.freeShipping || false,
            imageUrl: lp.imageUrl || '',
            shippingValue: fromCents(lp.shippingPrice || 0),
            createdAt: lp.createdAt ? lp.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: lp.updatedAt ? lp.updatedAt.toISOString() : undefined,
            url: lp.slug ? `/l/${lp.slug}` : '',
        }));
    }
    catch (error) {
        console.error("Erro detalhado ao listar landing pages no sql-adapter:", error);
        throw error;
    }
}
async function createLandingPage(data) {
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
    const slug = data.slug || (0, utils_1.generateSlug)(data.productTitle);
    const newLandingPage = await prisma_1.prisma.landingPage.create({
        data: {
            slug,
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
async function updateLandingPage(id, data) {
    const existingLandingPage = await prisma_1.prisma.landingPage.findUnique({
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
        updatedSlug = (0, utils_1.generateSlug)(data.productTitle);
    }
    const updatedLandingPage = await prisma_1.prisma.landingPage.update({
        where: { id },
        data: {
            slug: updatedSlug,
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
async function deleteLandingPage(id) {
    try {
        await prisma_1.prisma.landingPage.delete({
            where: { id },
        });
        return true;
    }
    catch (error) {
        console.error("Erro ao deletar landing page:", error);
        return false;
    }
}
async function getLandingPageBySlug(slug) {
    const landingPage = await prisma_1.prisma.landingPage.findUnique({
        where: { slug },
    });
    return landingPage ? {
        ...landingPage,
        price: fromCents(landingPage.price),
        shippingValue: fromCents(landingPage.shippingPrice),
    } : null;
}
