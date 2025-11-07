"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const playwright_1 = require("playwright");
async function main() {
    const userAgent = process.env.SCRAPER_USER_AGENT ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
    const browser = await playwright_1.chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({
        userAgent,
        viewport: { width: 1440, height: 900 },
        locale: 'pt-BR',
        extraHTTPHeaders: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Google Chrome";v="129", "Chromium";v="129", "Not=A?Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'upgrade-insecure-requests': '1',
        },
    });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // @ts-ignore
        window.chrome = window.chrome || { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
    });
    const page = await context.newPage();
    await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(4000);
    const infoBeforeClick = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).map((btn) => ({
            text: btn.textContent?.trim(),
            testId: btn.getAttribute('data-testid'),
            controls: btn.getAttribute('aria-controls'),
            expanded: btn.getAttribute('aria-expanded'),
        }));
        const panels = Array.from(document.querySelectorAll('[role="tabpanel"], [data-testid*="panel"], [id*="detal"], [class*="detal"]')).map((el) => ({
            tag: el.tagName,
            id: el.id,
            testId: el.getAttribute('data-testid'),
            classes: el.className,
            hidden: el.getAttribute('hidden') ?? null,
            textSnippet: el.textContent?.slice(0, 200),
        }));
        return { buttons, panels };
    });
    await page.evaluate(() => {
        document.querySelectorAll('button').forEach((btn) => {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('detalhe')) {
                btn.click();
            }
        });
    });
    await page.waitForTimeout(2000);
    const infoAfterClick = await page.evaluate(() => {
        const panels = Array.from(document.querySelectorAll('[role="tabpanel"], [data-testid*="panel"], [id*="detal"], [class*="detal"]')).map((el) => ({
            tag: el.tagName,
            id: el.id,
            testId: el.getAttribute('data-testid'),
            classes: el.className,
            hidden: el.getAttribute('hidden') ?? null,
            textSnippet: el.textContent?.slice(0, 200),
        }));
        return panels;
    });
    console.log(JSON.stringify({ infoBeforeClick, infoAfterClick }, null, 2));
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
