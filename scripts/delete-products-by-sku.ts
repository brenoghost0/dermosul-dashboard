import 'dotenv/config';
import { prisma } from '../src/db/prisma';

const SKUS = [
  'DER-HID-011',
  'DER-TRT-005',
  'SCRAPE-9063757377',
  'DOX3XLOODD',
  'B3MMIQSA2X',
  'KSK2SH0LLG',
  '3LFCCPJEHU',
] as const;

async function main() {
  for (const sku of SKUS) {
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product) {
      console.warn(`[delete-products-by-sku] Produto com SKU ${sku} não encontrado.`);
      continue;
    }
    await prisma.orderItem.deleteMany({ where: { productId: product.id } });
    await prisma.cartItem.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    console.log(`[delete-products-by-sku] Produto removido: ${product.name} (${sku})`);
  }
}

main()
  .catch((error) => {
    console.error('[delete-products-by-sku] Falha ao remover produtos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
