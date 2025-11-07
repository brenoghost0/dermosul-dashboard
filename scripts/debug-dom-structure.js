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
    });
    const page = await context.newPage();
    await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);
    const structure = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe')).map((frame) => ({
            src: frame.getAttribute('src'),
            id: frame.id,
            classes: frame.className,
            dataTestId: frame.getAttribute('data-testid'),
        }));
        const shadowHosts = Array.from(document.querySelectorAll('*')).filter((el) => el.shadowRoot).map((el) => el.tagName.toLowerCase());
        return { iframes, shadowHosts };
    });
    console.log(JSON.stringify(structure, null, 2));
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
