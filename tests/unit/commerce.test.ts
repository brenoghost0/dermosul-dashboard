import { describe, expect, it } from 'vitest';
import { formatCurrencyBRL } from '../../src/utils/format';
import { calculateShippingForMethod, computeCouponDiscount } from '../../src/data/store-adapter';

describe('formatCurrencyBRL', () => {
  it('formata valores em reais com separadores brasileiros', () => {
    expect(formatCurrencyBRL(1990).replace(/\u00a0/g, ' ')).toBe('R$ 19,90');
    expect(formatCurrencyBRL(0).replace(/\u00a0/g, ' ')).toBe('R$ 0,00');
  });
});

describe('calculateShippingForMethod', () => {
  it('retorna zero quando há frete grátis por valor', () => {
    const shipping = calculateShippingForMethod({ flatPriceCents: 1590, freeOverCents: 20000 }, 25000);
    expect(shipping).toBe(0);
  });

  it('retorna tarifa fixa quando subtotal insuficiente', () => {
    const shipping = calculateShippingForMethod({ flatPriceCents: 1590, freeOverCents: 20000 }, 15000);
    expect(shipping).toBe(1590);
  });
});

describe('computeCouponDiscount', () => {
  it('calcula desconto percentual limitado ao subtotal', () => {
    expect(computeCouponDiscount('PERCENT', 10, 20000)).toBe(2000);
    expect(computeCouponDiscount('PERCENT', 100, 15000)).toBe(15000);
  });

  it('calcula desconto por valor fixo respeitando limites', () => {
    expect(computeCouponDiscount('AMOUNT', 5000, 3000)).toBe(3000);
    expect(computeCouponDiscount('AMOUNT', 2000, 10000)).toBe(2000);
  });
});
