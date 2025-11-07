import 'dotenv/config';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  const priceInfo = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('*'))
      .map((el) => el.textContent?.trim() || '')
      .filter((text) => text.includes('R$'));
    return {
      sample: texts.slice(0, 10),
      count: texts.length,
    };
  });
  console.log(priceInfo);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
