import 'dotenv/config';
import { chromium } from 'playwright';

async function main() {
  const userAgent = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({ userAgent, viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  const results = await page.evaluate(() => {
    const selectors = [
      'img',
      '[data-testid*="image"]',
      '[data-gallery] img',
      '.product-gallery img',
      '.gallery img',
      '[role="tabpanel"] img',
      'syndigo-powerpage img'
    ];
    const set = new Set<string>();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        const el = node as HTMLImageElement;
        const src = el.getAttribute('data-zoom') || el.getAttribute('data-src') || el.currentSrc || el.src || el.getAttribute('srcset');
        if (src) set.add(src);
      });
    }
    return Array.from(set);
  });
  console.log(results);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
