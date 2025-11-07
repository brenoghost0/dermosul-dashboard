"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const playwright_1 = require("playwright");
async function main() {
    const browser = await playwright_1.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://www.belezanaweb.com.br/eucerin-antipigment-dual-serum-facial-uniformizador-e-antissinais-30ml/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const raw = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent ?? null);
    if (!raw) {
        console.log('No __NEXT_DATA__');
    }
    else {
        console.log(raw.slice(0, 2000));
    }
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
