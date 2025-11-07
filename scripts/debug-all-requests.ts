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

  page.on('requestfinished', async (request) => {
    const url = request.url();
    if (!/\.css$|\.js$|analytics|doubleclick|facebook|googletag/i.test(url)) {
      console.log('Request:', url);
    }
  });

  await page.goto('https://www.belezanaweb.com.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  const cookieSelectors = [
    'button#onetrust-accept-btn-handler',
    'button[data-testid="cookie-consent-accept"]',
    'button:has-text("Aceitar")',
    'button:has-text("Aceitar todos os cookies")',
  ];
  for (const selector of cookieSelectors) {
    const button = await page.$(selector);
    if (button) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(1000);
      break;
    }
  }

  await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(10000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(5000);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
