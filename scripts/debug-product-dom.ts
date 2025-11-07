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
  await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);

  const data = await page.evaluate(() => {
    const extractUrl = (el: HTMLElement) => {
      const attrs = ['data-zoom', 'data-image', 'data-thumbnail', 'data-src', 'data-srcset', 'data-original', 'data-lazy', 'src', 'srcset'];
      for (const attr of attrs) {
        const value = el.getAttribute(attr);
        if (value && /imagens\/product/.test(value)) {
          return value;
        }
      }
      if ((el as HTMLImageElement).currentSrc && /imagens\/product/.test((el as HTMLImageElement).currentSrc)) {
        return (el as HTMLImageElement).currentSrc;
      }
      return null;
    };

    const collected: Array<{ tag: string; url: string | null; attrs: Record<string, string | null> }> = [];
    document.querySelectorAll('*').forEach((node) => {
      const el = node as HTMLElement;
      const url = extractUrl(el);
      if (url) {
        const attrs: Record<string, string | null> = {
          'data-zoom': el.getAttribute('data-zoom'),
          'data-image': el.getAttribute('data-image'),
          'data-thumbnail': el.getAttribute('data-thumbnail'),
          'data-src': el.getAttribute('data-src'),
          'data-srcset': el.getAttribute('data-srcset'),
          'data-original': el.getAttribute('data-original'),
          'data-lazy': el.getAttribute('data-lazy'),
          'src': el.getAttribute('src'),
          'srcset': el.getAttribute('srcset'),
        };
        collected.push({ tag: el.tagName.toLowerCase(), url, attrs });
      }
    });
    return collected;
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
