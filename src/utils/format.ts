export function formatCurrencyBRL(valueCents: number): string {
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  return formatter.format((valueCents || 0) / 100);
}
