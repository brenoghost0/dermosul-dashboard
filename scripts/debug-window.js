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
    const keys = await page.evaluate(() => Object.keys(window).filter((key) => /state|data|hydrate|apollo|redux|store/i.test(key)));
    console.log(keys);
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
