"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/manual-scrape.ts
require("dotenv/config");
const playwright_1 = require("playwright");
function normalizeWhitespace(value) {
    if (!value)
        return null;
    return value.replace(/\s+/g, ' ').trim();
}
function parsePrice(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const normalized = value
            .replace(/[^\d.,-]/g, '')
            .replace(/\.(?=\d{3})/g, '')
            .replace(',', '.');
        const parsed = Number(normalized);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function absoluteUrl(base, href) {
    if (!href)
        return null;
    try {
        return new URL(href, base).toString();
    }
    catch {
        return null;
    }
}
function traverseJsonLd(node, visitor) {
    if (node === undefined || node === null)
        return;
    visitor(node);
    if (Array.isArray(node)) {
        for (const item of node)
            traverseJsonLd(item, visitor);
        return;
    }
    if (typeof node === 'object') {
        for (const value of Object.values(node)) {
            traverseJsonLd(value, visitor);
        }
    }
}
function extractListingProducts(jsonLdBlocks, catalogUrl) {
    const base = new URL(catalogUrl);
    const results = [];
    const seen = new Set();
    const pushPreview = (preview) => {
        if (!preview || !preview.url)
            return;
        if (seen.has(preview.url))
            return;
        seen.add(preview.url);
        results.push(preview);
    };
    const handleProductNode = (node) => {
        const url = absoluteUrl(base, node.url || node['@id']);
        if (!url)
            return null;
        return {
            title: normalizeWhitespace(node.name || '') || null,
            url,
            price: parsePrice(node.offers?.price ?? node.price),
            brand: typeof node.brand === 'string' ? node.brand : node.brand?.name ?? null,
            sku: node.sku ?? node.mpn ?? null,
        };
    };
    for (const raw of jsonLdBlocks) {
        if (!raw)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            continue;
        }
        traverseJsonLd(parsed, (node) => {
            if (!node || typeof node !== 'object')
                return;
            const type = node['@type'] ?? node.type;
            if (!type)
                return;
            const typeList = Array.isArray(type) ? type : [type];
            if (typeList.includes('ItemList') && Array.isArray(node.itemListElement)) {
                for (const entry of node.itemListElement) {
                    const item = entry?.item ?? entry;
                    if (!item)
                        continue;
                    traverseJsonLd(item, (inner) => {
                        if (!inner || typeof inner !== 'object')
                            return;
                        const innerType = inner['@type'] ?? inner.type;
                        const innerList = Array.isArray(innerType) ? innerType : [innerType];
                        if (innerList.includes('Product')) {
                            pushPreview(handleProductNode(inner));
                        }
                    });
                }
            }
        });
    }
    if (results.length > 0)
        return results;
    // fallback: qualquer Product isolado
    for (const raw of jsonLdBlocks) {
        if (!raw)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            continue;
        }
        traverseJsonLd(parsed, (node) => {
            if (!node || typeof node !== 'object')
                return;
            const type = node['@type'] ?? node.type;
            if (!type)
                return;
            const typeList = Array.isArray(type) ? type : [type];
            if (typeList.includes('Product')) {
                pushPreview(handleProductNode(node));
            }
        });
    }
    return results;
}
function mapNextProductCandidate(item, base) {
    if (!item || typeof item !== 'object')
        return null;
    const maybeUrl = item.url ||
        item.link ||
        item.href ||
        item.productUrl ||
        item.slug ||
        item.seoUrl ||
        item.cmsUrl ||
        item.permalink ||
        item?.product?.url;
    const url = absoluteUrl(base, typeof maybeUrl === 'string' ? maybeUrl : maybeUrl?.href ?? maybeUrl?.url ?? null);
    if (!url)
        return null;
    const title = normalizeWhitespace(item.name ||
        item.title ||
        item.productName ||
        item.productTitle ||
        item.product?.name ||
        item.seoName ||
        item.displayName ||
        null) || null;
    const brand = normalizeWhitespace((typeof item.brand === 'string' ? item.brand : item.brand?.name) ||
        item.brandName ||
        item.product?.brand?.name ||
        item.manufacturer ||
        null) || null;
    const price = parsePrice(item.price?.value ??
        item.price?.amount ??
        item.price ??
        item.currentPrice ??
        item.salePrice ??
        item.offerPrice ??
        item.priceWithDiscount ??
        item.listPrice ??
        item?.offers?.price);
    const sku = item.sku ||
        item.reference ||
        item.productId ||
        item.id ||
        item.code ||
        item.itemId ||
        item.product?.id ||
        null;
    return {
        title,
        brand,
        price,
        url,
        sku,
    };
}
function extractProductsFromNextData(nextDataRaw, catalogUrl) {
    if (!nextDataRaw)
        return [];
    let parsed;
    try {
        parsed = JSON.parse(nextDataRaw);
    }
    catch {
        return [];
    }
    const base = new URL(catalogUrl);
    const seen = new Set();
    const results = [];
    const visit = (node) => {
        if (!node || typeof node !== 'object')
            return;
        if (Array.isArray(node)) {
            if (node.length && typeof node[0] === 'object') {
                const candidates = node
                    .map((elem) => mapNextProductCandidate(elem, base))
                    .filter((maybe) => Boolean(maybe && maybe.url));
                for (const product of candidates) {
                    if (product.url && !seen.has(product.url)) {
                        seen.add(product.url);
                        results.push(product);
                    }
                }
            }
            for (const item of node)
                visit(item);
            return;
        }
        for (const value of Object.values(node))
            visit(value);
    };
    visit(parsed);
    return results;
}
async function extractProductsFromDom(page, catalogUrl) {
    const raw = await page.evaluate(() => {
        const results = [];
        const selectors = [
            '[data-testid^="product-card"], [data-test-id^="product-card"], article[data-event], li[data-product], div[data-product]',
            'a[href*="/p/"]',
        ];
        const collect = (root) => {
            const anchor = root instanceof HTMLAnchorElement ? root : root.querySelector('a[href]');
            if (!anchor)
                return;
            const titleSource = root.querySelector('[data-testid="product-name"], [data-product-title], .product-name')?.textContent ||
                anchor.getAttribute('title') ||
                anchor.querySelector('[data-testid="product-name"]')?.textContent ||
                null;
            const brandSource = root.querySelector('[data-testid="product-brand"], .product-brand, .brand-name')?.textContent ||
                root.getAttribute('data-brand') ||
                anchor.dataset.brand ||
                anchor.getAttribute('data-brand') ||
                null;
            const priceSource = root.getAttribute('data-price') ||
                root.querySelector('[data-testid="product-price"],[itemprop="price"],.price,.product-price')?.textContent ||
                anchor.dataset.price ||
                anchor.getAttribute('data-price') ||
                anchor.querySelector('[data-testid="product-price"],[itemprop="price"],.price,.product-price')?.textContent ||
                null;
            const sku = anchor.dataset.sku || anchor.getAttribute('data-sku') || root.getAttribute('data-sku') || null;
            results.push({
                title: titleSource?.trim() || (anchor.textContent?.trim() || null),
                href: anchor.href || anchor.getAttribute('href') || null,
                priceText: priceSource?.trim() || null,
                brand: brandSource?.trim() || null,
                sku,
            });
        };
        for (const selector of selectors) {
            document.querySelectorAll(selector).forEach((el) => collect(el));
        }
        return results;
    });
    const base = new URL(catalogUrl);
    const seen = new Set();
    const previews = [];
    for (const item of raw) {
        const url = absoluteUrl(base, item.href);
        if (!url || seen.has(url))
            continue;
        seen.add(url);
        previews.push({
            title: normalizeWhitespace(item.title),
            brand: normalizeWhitespace(item.brand),
            price: parsePrice(item.priceText),
            url,
            sku: item.sku ?? null,
        });
    }
    return previews;
}
function extractProductDetailFromJsonLd(jsonLdBlocks, detailUrl) {
    const base = new URL(detailUrl);
    let bestMatch = null;
    for (const raw of jsonLdBlocks) {
        if (!raw)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            continue;
        }
        traverseJsonLd(parsed, (node) => {
            if (!node || typeof node !== 'object')
                return;
            const type = node['@type'] ?? node.type;
            if (!type)
                return;
            const typeList = Array.isArray(type) ? type : [type];
            if (typeList.includes('Product')) {
                bestMatch = node;
            }
        });
    }
    if (!bestMatch)
        return {};
    let images;
    const rawImages = bestMatch.image;
    if (Array.isArray(rawImages)) {
        images = rawImages
            .map((img) => absoluteUrl(base, typeof img === 'string' ? img : img?.url ?? null))
            .filter((url) => Boolean(url));
    }
    else if (typeof rawImages === 'string') {
        const url = absoluteUrl(base, rawImages);
        images = url ? [url] : undefined;
    }
    return {
        title: normalizeWhitespace(bestMatch.name ?? null),
        brand: typeof bestMatch.brand === 'string'
            ? bestMatch.brand
            : bestMatch.brand?.name ?? null,
        price: parsePrice(bestMatch.offers?.price ?? bestMatch.price),
        sku: bestMatch.sku ?? bestMatch.mpn ?? null,
        shortDescription: normalizeWhitespace(bestMatch.description ?? null),
        longDescriptionHtml: bestMatch.description ?? null,
        images,
    };
}
function mergeImages(base, ...imageLists) {
    const set = new Set();
    for (const list of imageLists) {
        if (!list)
            continue;
        for (const item of list) {
            const absolute = absoluteUrl(base, item) ?? item;
            if (absolute)
                set.add(absolute);
        }
    }
    return set.size > 0 ? Array.from(set) : undefined;
}
function upscaleImage(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('cloudinary'))
            return url;
        const path = parsed.pathname;
        const accountMatch = path.match(/(\/[^/]+\/image\/upload)/);
        const versionMatch = path.match(/\/v\d+\/imagens\/.+/);
        if (accountMatch && versionMatch) {
            const accountSegment = accountMatch[1];
            const remainder = versionMatch[0];
            return `${parsed.origin}${accountSegment}/w_1200,f_auto,fl_progressive,q_auto:best${remainder}`;
        }
        return url;
    }
    catch {
        return url;
    }
}
async function main() {
    const userAgent = process.env.SCRAPER_USER_AGENT ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
    const sharedContextOptions = {
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
    };
    const sanitizeGalleryUrl = (raw, skuFragment) => {
        if (!raw)
            return null;
        let cleaned = raw
            .replace(/&(?:amp;)?quot;/gi, '')
            .replace(/&#x2F;/gi, '/')
            .replace(/&#47;/gi, '/')
            .replace(/&#34;/gi, '')
            .replace(/\\u0026/gi, '&')
            .trim();
        cleaned = cleaned.replace(/[,\\"]+$/g, '');
        if (!cleaned.startsWith('http'))
            return null;
        const lower = cleaned.toLowerCase();
        if (!lower.includes('imagens/product'))
            return null;
        if (lower.includes('youtube') || lower.includes('youtu.be'))
            return null;
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.m3u8'))
            return null;
        if (skuFragment) {
            const normalizedSku = skuFragment.toLowerCase();
            const productMatch = cleaned.toLowerCase().match(/\/product\/([^/]+)/);
            if (productMatch && !productMatch[1].includes(normalizedSku)) {
                return null;
            }
        }
        return cleaned;
    };
    const collectGalleryUrlsFromPage = async (page, skuFragment) => {
        const html = await page.evaluate(() => document.documentElement.innerHTML);
        const urlSet = new Set();
        const regex = /https:\/\/[^\s"'&]+imagens\/product\/[^\s"'&]+/gi;
        const matches = html.match(regex) ?? [];
        for (const match of matches) {
            const sanitized = sanitizeGalleryUrl(match, skuFragment);
            if (sanitized) {
                urlSet.add(sanitized);
            }
        }
        return Array.from(urlSet);
    };
    console.log('Abrindo Chromium headless...');
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
    });
    const catalogUrl = 'https://www.belezanaweb.com.br/dermocosmeticos';
    try {
        const context = await browser.newContext(sharedContextOptions);
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            // @ts-ignore
            window.chrome = window.chrome || { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        });
        const page = await context.newPage();
        console.log('Visitando home...');
        await page.goto('https://www.belezanaweb.com.br/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
        await page.waitForTimeout(2000);
        console.log('Tentando aceitar cookies...');
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
        console.log('Indo para a página de dermocosméticos...');
        await page.goto(catalogUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
        await page.waitForTimeout(3000);
        // Carrega todos os produtos disponíveis clicando em "Carregar mais produtos"
        const loadMoreSelectors = [
            'button:has-text("Carregar mais produtos")',
            'button:has-text("Carregar mais")',
            'button[data-testid="load-more-button"]',
            '[data-testid="load-more-products"] button',
        ];
        for (let i = 0; i < 40; i += 1) {
            let clicked = false;
            for (const selector of loadMoreSelectors) {
                const button = await page.$(selector);
                if (!button)
                    continue;
                const disabled = await button.getAttribute('disabled');
                const isVisible = await button
                    .evaluate((el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
                })
                    .catch(() => false);
                if (disabled !== null || !isVisible)
                    continue;
                await button.scrollIntoViewIfNeeded().catch(() => undefined);
                await button.click().catch(() => undefined);
                await page.waitForTimeout(2500);
                await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
                clicked = true;
                break;
            }
            if (!clicked)
                break;
        }
        const jsonLdBlocks = await page.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => n.textContent || ''));
        let products = extractListingProducts(jsonLdBlocks, catalogUrl);
        console.log('Produtos via JSON-LD:', products.length);
        if (products.length === 0) {
            const nextDataRaw = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || null);
            const nextProducts = extractProductsFromNextData(nextDataRaw, catalogUrl);
            console.log('Produtos via __NEXT_DATA__:', nextProducts.length);
            if (nextProducts.length > 0) {
                products = nextProducts;
            }
            else {
                console.warn('Nenhum produto via JSON-LD ou __NEXT_DATA__, tentando DOM...');
                const domProducts = await extractProductsFromDom(page, catalogUrl);
                console.log('Produtos via DOM:', domProducts.length);
                products = domProducts;
            }
        }
        if (products.length === 0) {
            throw new Error('Nenhum produto encontrado na listagem.');
        }
        const manualLimitRaw = process.env.MANUAL_SCRAPE_LIMIT ?? process.argv[2];
        const manualLimit = Number(manualLimitRaw);
        const limit = Number.isFinite(manualLimit) && manualLimit > 0 ? Math.min(products.length, Math.floor(manualLimit)) : products.length;
        const targets = products.slice(0, limit);
        console.log(`Preparado para detalhar ${targets.length} produtos.`);
        let processedDetails = 0;
        for (const productPreview of targets) {
            processedDetails += 1;
            console.log(`\n>>> Detalhando produto ${processedDetails}/${targets.length}: ${productPreview.title}`);
            const detailPage = await context.newPage();
            console.log('Abrindo página de detalhes:', productPreview.url);
            await detailPage.goto(productPreview.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await detailPage.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
            await detailPage.waitForTimeout(3000);
            await detailPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await detailPage.waitForTimeout(2000);
            await detailPage.waitForSelector('img[data-src*="imagens/product"], img[src*="imagens/product"]', { timeout: 15000 }).catch(() => undefined);
            // Expande descrições/tabs para garantir HTML completo
            await detailPage.evaluate(() => {
                const clickIfVisible = (element) => {
                    if (element instanceof HTMLElement && element.offsetParent !== null) {
                        element.click();
                    }
                };
                document.querySelectorAll('.see-more-description-link').forEach((el) => clickIfVisible(el));
                const accordionButtons = Array.from(document.querySelectorAll('[data-testid="accordion-button"], button[aria-controls]'));
                for (const button of accordionButtons) {
                    const controls = (button.getAttribute('aria-controls') || '').toLowerCase();
                    const text = (button.textContent || '').toLowerCase();
                    const isDetailControl = controls.includes('product-description') ||
                        controls.includes('description-region') ||
                        controls.includes('detal') ||
                        text.includes('detalhe');
                    if (isDetailControl && button.getAttribute('aria-expanded') !== 'true') {
                        clickIfVisible(button);
                    }
                }
            });
            const detailJsonLdBlocks = await detailPage.$$eval('script[type="application/ld+json"]', (nodes) => nodes.map((n) => n.textContent || ''));
            const detailFromJsonLd = extractProductDetailFromJsonLd(detailJsonLdBlocks, productPreview.url);
            const domData = await detailPage.evaluate(() => {
                const pickText = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
                const findDetailPanel = () => {
                    const selectors = [
                        '[data-testid="tab-panel-Detalhes"]',
                        '[data-testid="tab-panel-detalhes"]',
                        '[data-testid*="tab-panel"][id*="etalh"]',
                        '[role="tabpanel"][id*="detal"]',
                        '[aria-labelledby*="detal"]',
                        '#detalhes',
                        '#Detalhes',
                        '#product-description-region',
                        '[data-testid="product-description-region"]',
                    ];
                    for (const selector of selectors) {
                        const candidate = document.querySelector(selector);
                        if (candidate)
                            return candidate;
                    }
                    return null;
                };
                const detailPanel = findDetailPanel();
                const descriptionElement = detailPanel ||
                    document.querySelector('[data-testid="product-description"]') ||
                    document.querySelector('[itemprop="description"]') ||
                    document.querySelector('#descricao') ||
                    document.querySelector('#description') ||
                    document.querySelector('.descricao') ||
                    document.querySelector('.description') ||
                    document.querySelector('.product-description');
                const detailParagraphs = detailPanel
                    ? Array.from(detailPanel.querySelectorAll('p'))
                        .map((p) => p.textContent?.trim())
                        .filter((text) => Boolean(text))
                    : [];
                const detailFirstParagraph = detailParagraphs.length > 0 ? detailParagraphs[0] : null;
                const joinedDetailText = detailParagraphs.length > 0 ? detailParagraphs.join('\n\n') : null;
                const detailInnerHtml = detailPanel?.innerHTML ?? null;
                const metaPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') || null;
                const syndigoHtml = window.blz?.product?.description ?? null;
                const normalizeParagraphs = (html) => {
                    if (!html)
                        return [];
                    const container = document.createElement('div');
                    container.innerHTML = html;
                    return Array.from(container.querySelectorAll('p'))
                        .map((p) => p.textContent?.trim())
                        .filter((text) => Boolean(text));
                };
                const syndigoParagraphs = normalizeParagraphs(syndigoHtml);
                const bestParagraphs = detailParagraphs.length > 0 ? detailParagraphs : syndigoParagraphs;
                const bestFirstParagraph = bestParagraphs.length > 0 ? bestParagraphs[0] : null;
                const combinedDetailHtml = detailInnerHtml ?? syndigoHtml ?? descriptionElement?.innerHTML ?? null;
                return {
                    title: pickText('h1, [data-testid="product-name"], .product-name'),
                    brand: pickText('[data-testid="product-brand"], .product-brand, .brand-name, [itemprop="brand"]'),
                    priceText: pickText('[data-testid="product-price"], [itemprop="price"], .price-sales, .price'),
                    metaPrice,
                    shortDescription: bestParagraphs.length > 0 ? bestParagraphs[0] : pickText('.short-description, .product-short-description') ||
                        document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                        null,
                    longDescriptionHtml: combinedDetailHtml,
                    detailTextCombined: bestParagraphs.length > 0 ? bestParagraphs.join('\n\n') : joinedDetailText,
                };
            });
            const expectedSku = detailFromJsonLd.sku ?? productPreview.sku ?? null;
            let galleryImages = await collectGalleryUrlsFromPage(detailPage, expectedSku);
            if (galleryImages.length === 0) {
                const fallbackContext = await browser.newContext(sharedContextOptions);
                await fallbackContext.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    // @ts-ignore
                    window.chrome = window.chrome || { runtime: {} };
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
                    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
                });
                const fallbackPage = await fallbackContext.newPage();
                try {
                    await fallbackPage.goto(productPreview.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await fallbackPage.waitForTimeout(6000);
                    galleryImages = await collectGalleryUrlsFromPage(fallbackPage, expectedSku);
                }
                catch (error) {
                    console.warn('[warn] Falha ao coletar imagens no fallback:', error.message);
                }
                finally {
                    await fallbackContext.close();
                }
            }
            const uniqueGalleryImages = Array.from(new Set(galleryImages));
            const metaPrice = parsePrice(domData.metaPrice);
            const detailBase = new URL(productPreview.url);
            const gallerySources = uniqueGalleryImages.length > 0 ? uniqueGalleryImages : detailFromJsonLd.images;
            const mergedImages = gallerySources
                ? Array.from(new Set(gallerySources
                    .map((img) => absoluteUrl(detailBase, img) ?? img)
                    .filter((img) => Boolean(img))
                    .map(upscaleImage)))
                : undefined;
            const domPrice = domData.priceText ? parsePrice(domData.priceText) : null;
            const merged = {
                title: detailFromJsonLd.title ?? domData.title ?? productPreview.title,
                brand: detailFromJsonLd.brand ?? domData.brand ?? productPreview.brand ?? null,
                price: detailFromJsonLd.price ?? domPrice ?? metaPrice ?? productPreview.price ?? null,
                sku: detailFromJsonLd.sku ?? productPreview.sku ?? null,
                shortDescription: domData.shortDescription ??
                    domData.detailTextCombined ??
                    detailFromJsonLd.shortDescription ??
                    null,
                longDescriptionHtml: domData.longDescriptionHtml ?? detailFromJsonLd.longDescriptionHtml ?? null,
                images: mergedImages,
                detailUrl: productPreview.url,
            };
            console.log(`\n=== Produto detalhado (${processedDetails}/${targets.length}) ===`);
            console.log(JSON.stringify(merged, null, 2));
            await detailPage.close();
        }
        await page.close();
        await context.close();
    }
    catch (error) {
        console.error('Falha ao buscar HTML:', error);
    }
    finally {
        await browser.close();
    }
}
main().catch((error) => {
    console.error('Falha no scraping:', error);
    process.exit(1);
});
