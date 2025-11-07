import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { formatCurrencyBRL } from "../../utils/format.js";

const HASH_CODE_REGEX = /#([a-z0-9\-]+)/gi;
const PEDIDO_CODE_REGEX = /pedido(?:\s+n(?:ú|u)mero|\s+nº|\s+num|\s+numero|\s+n)?\s*#?([a-z0-9\-]+)/gi;
const ORDER_KEYWORD_REGEX = /\bpedido(s)?\b/i;

const STATUS_MAP: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  aguardando_pagamento: "Aguardando pagamento",
  cancelado: "Cancelado",
  enviado: "Enviado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export type OrderSummary = {
  code: string;
  statusLabel: string;
  updatedAt: string;
  total: string;
  paymentInfo: string;
  destination?: string | null;
  items: Array<{ name: string; qty: number }>;
};

export type OrderResolution =
  | { orders: OrderSummary[]; needsIdentifier: false; requestedCodes: string[] }
  | { orders: []; needsIdentifier: true; requestedCodes: string[] }
  | { orders: []; needsIdentifier: false; requestedCodes: string[] };

function collectPossibleCodes(message: string): string[] {
  const codes = new Set<string>();
  const normalized = message.trim();

  for (const match of normalized.matchAll(HASH_CODE_REGEX)) {
    if (match[1]) codes.add(match[1]);
  }
  for (const match of normalized.matchAll(PEDIDO_CODE_REGEX)) {
    if (match[1]) codes.add(match[1]);
  }

  return Array.from(codes).map((code) => code.trim());
}

export async function resolveOrderContext(message: string): Promise<OrderResolution> {
  const codes = collectPossibleCodes(message);
  const mentionsOrder = ORDER_KEYWORD_REGEX.test(message);

  if (codes.length === 0) {
    return mentionsOrder
      ? { orders: [], needsIdentifier: true, requestedCodes: [] }
      : { orders: [], needsIdentifier: false, requestedCodes: [] };
  }

  const orConditions = codes.flatMap((code) => {
    const variants = [code, code.toUpperCase(), code.toLowerCase()];
    return variants.flatMap((value) => [
      { id: value },
      { number: value },
      { externalReference: value },
    ]);
  });

  const ORDER_CONTEXT_INCLUDE = {
    items: {
      select: {
        qty: true,
        title: true,
        product: { select: { name: true } },
      },
    },
    payments: {
      select: {
        paymentMethod: true,
        status: true,
        paidAmount: true,
      },
      take: 1,
    },
    addresses: {
      select: {
        kind: true,
        city: true,
        state: true,
        district: true,
      },
    },
  } as const;

  let orders = (await prisma.order.findMany({
    where: { OR: orConditions },
    include: ORDER_CONTEXT_INCLUDE,
  })) as Array<Prisma.OrderGetPayload<{ include: typeof ORDER_CONTEXT_INCLUDE }>>;

  console.debug("[ai] pedido - codigos detectados:", codes);
  console.debug("[ai] pedido - encontrados:", orders.map((order) => order.number || order.id));

  if (!orders.length) {
    const fuzzyCodes = codes.filter((code) => code.length >= 4);
    if (fuzzyCodes.length) {
      const fuzzyConditions = fuzzyCodes.flatMap((code) => {
        const variants = [code, code.toUpperCase(), code.toLowerCase()];
        return variants.flatMap((value) => [
          { id: { startsWith: value, mode: "insensitive" as const } },
          { number: { startsWith: value, mode: "insensitive" as const } },
          { externalReference: { startsWith: value, mode: "insensitive" as const } },
        ]);
      });

      orders = (await prisma.order.findMany({
        where: { OR: fuzzyConditions },
        include: ORDER_CONTEXT_INCLUDE,
        take: 5,
      })) as Array<Prisma.OrderGetPayload<{ include: typeof ORDER_CONTEXT_INCLUDE }>>;

      console.debug("[ai] pedido - busca fuzzy encontrou:", orders.map((order) => order.number || order.id));
    }
  }

  if (!orders.length) {
    return { orders: [], needsIdentifier: false, requestedCodes: codes };
  }

  const summaries = orders.map((order) => {
    const orderCode = order.number || order.externalReference || order.id;
    const statusLabel = STATUS_MAP[order.status] ?? order.status;
    const updatedAt = dateFormatter.format(order.createdAt);
    const total = formatCurrencyBRL(order.totalAmount);

    const items = order.items.map((item) => {
        const name = item.product?.name || item.title || "Produto";
        return { name, qty: item.qty };
      });

    const payment = order.payments[0];
    const paymentInfo = payment
      ? `Pagamento: ${payment.paymentMethod} (${payment.status}${
          payment.paidAmount ? `, pago ${formatCurrencyBRL(payment.paidAmount)}` : ""
        })`
      : "Pagamento: informações não disponíveis";

    const shippingAddress = order.addresses.find((address) => address.kind === "SHIPPING");
    const destination = shippingAddress
      ? `Destino: ${[shippingAddress.district, shippingAddress.city, shippingAddress.state].filter(Boolean).join(", ")}`
      : null;

    return {
      code: orderCode,
      statusLabel,
      updatedAt,
      total,
      paymentInfo,
      destination,
      items: items.length ? items : [{ name: "Itens não encontrados", qty: 0 }],
    };
  });

  return { orders: summaries, needsIdentifier: false, requestedCodes: codes };
}
