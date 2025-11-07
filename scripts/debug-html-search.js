"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const playwright_1 = require("playwright");
async function main() {
    const userAgent = process.env.SCRAPER_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
    const browser = await playwright_1.chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({ userAgent, viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // @ts-ignore
        window.chrome = window.chrome || { runtime: {} };
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
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
    const html = await page.content();
    const snippetIndex = html.indexOf('cloudinary');
    console.log('cloudinary index', snippetIndex);
    console.log(html.slice(Math.max(0, snippetIndex - 200), snippetIndex + 200));
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
