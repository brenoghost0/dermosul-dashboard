import { describe, expect, it } from 'vitest';
import { calculateShippingForMethod, computeCouponDiscount } from '../../src/data/store-adapter';
import { formatCurrencyBRL } from '../../src/utils/format';

type CartItem = { priceCents: number; quantity: number; sku: string };

function simulateCheckout(items: CartItem[], coupon: { type: 'PERCENT' | 'AMOUNT'; value: number } | null) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const discount = coupon ? computeCouponDiscount(coupon.type, coupon.value, subtotal) : 0;
  const shipping = calculateShippingForMethod({ flatPriceCents: 1990, freeOverCents: 40000 }, subtotal - discount);
  const total = Math.max(subtotal - discount + shipping, 0);
  return {
    subtotal,
    discount,
    shipping,
    total,
    formattedTotal: formatCurrencyBRL(total),
    status: 'aguardando_pagamento',
  };
}

describe('Fluxo de checkout Dermosul (simulado)', () => {
  it('calcula totais com cupom percentual e frete grátis aplicável', () => {
    const cart = [
      { priceCents: 18990, quantity: 1, sku: 'DER-SERUM-001' },
      { priceCents: 15990, quantity: 2, sku: 'DER-HID-003' },
    ];
    const order = simulateCheckout(cart, { type: 'PERCENT', value: 10 });
    expect(order.subtotal).toBe(50970);
    expect(order.discount).toBe(5097);
    expect(order.shipping).toBe(0); // frete grátis acima de R$ 400
    expect(order.total).toBe(45873);
    expect(order.formattedTotal.replace(/\u00a0/g, ' ')).toBe('R$ 458,73');
    expect(order.status).toBe('aguardando_pagamento');
  });

  it('aplica cupom de valor fixo e soma frete', () => {
    const cart = [
      { priceCents: 8990, quantity: 1, sku: 'DER-LIMP-002' },
      { priceCents: 10990, quantity: 1, sku: 'DER-LIMP-006' },
    ];
    const order = simulateCheckout(cart, { type: 'AMOUNT', value: 2000 });
    expect(order.subtotal).toBe(19980);
    expect(order.discount).toBe(2000);
    expect(order.shipping).toBe(1990);
    expect(order.total).toBe(19980 - 2000 + 1990);
    expect(order.status).toBe('aguardando_pagamento');
  });
});
