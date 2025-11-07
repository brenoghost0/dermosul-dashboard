import 'dotenv/config';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    extraHTTPHeaders: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '\"Google Chrome\";v=\"129\", \"Chromium\";v=\"129\", \"Not=A?Brand\";v=\"24\"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '\"macOS\"',
      'upgrade-insecure-requests': '1',
    },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
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
  await page.waitForTimeout(8000);

  const gallery = await page.evaluate(() => {
    const urlSet = new Set<string>();
    const attrs = ['data-zoom', 'data-image', 'data-thumbnail', 'data-src', 'data-srcset', 'data-original', 'data-lazy', 'src', 'srcset', 'poster'];
    const push = (value: string | null) => {
      if (!value) return;
      for (const part of value.split(/[\s,]+/)) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (!trimmed.startsWith('http')) continue;
        if (!lower.includes('imagens/product')) continue;
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.m3u8')) continue;
        urlSet.add(trimmed);
      }
    };

    document
      .querySelectorAll('img, source, video, [data-zoom], [data-image], [data-thumbnail], [data-src], [data-srcset], [data-original], [data-lazy]')
      .forEach((node) => {
        const element = node as HTMLElement;
        for (const attr of attrs) {
          push(element.getAttribute(attr));
        }
      });

    return Array.from(urlSet);
  });

  console.log(gallery);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
