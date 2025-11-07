"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedHosts = getAllowedHosts;
exports.isUrlWhitelisted = isUrlWhitelisted;
exports.getMaxRequestsPerSecond = getMaxRequestsPerSecond;
exports.getScraperUserAgent = getScraperUserAgent;
exports.getMaxProductsForMode = getMaxProductsForMode;
exports.getScraperConcurrency = getScraperConcurrency;
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1'];
let cachedWhitelist = null;
function loadWhitelist() {
    if (cachedWhitelist)
        return cachedWhitelist;
    const raw = process.env.SCRAPER_ALLOWED_HOSTS;
    if (!raw) {
        cachedWhitelist = DEFAULT_ALLOWED_HOSTS;
        return cachedWhitelist;
    }
    cachedWhitelist = raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    if (cachedWhitelist.length === 0) {
        cachedWhitelist = DEFAULT_ALLOWED_HOSTS;
    }
    return cachedWhitelist;
}
function getAllowedHosts() {
    return loadWhitelist();
}
function isUrlWhitelisted(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        return loadWhitelist().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    }
    catch (error) {
        return false;
    }
}
function getMaxRequestsPerSecond() {
    const fromEnv = Number(process.env.SCRAPER_MAX_RPS);
    if (Number.isFinite(fromEnv) && fromEnv > 0)
        return fromEnv;
    return 2;
}
function getScraperUserAgent() {
    return process.env.SCRAPER_USER_AGENT || 'DermosulScraper/1.0 (+https://dermosul.com.br)';
}
function getMaxProductsForMode(mode) {
    if (mode === 'test')
        return 1;
    const fromEnv = Number(process.env.SCRAPER_MAX_PRODUCTS_CAP);
    if (Number.isFinite(fromEnv) && fromEnv > 0)
        return fromEnv;
    return Number.POSITIVE_INFINITY;
}
function getScraperConcurrency() {
    const fromEnv = Number(process.env.SCRAPER_CONCURRENCY);
    if (Number.isFinite(fromEnv) && fromEnv >= 1)
        return Math.floor(fromEnv);
    return 1;
}
