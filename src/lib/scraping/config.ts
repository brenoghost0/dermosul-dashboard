import { ScrapeMode } from './types';

const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1'];

let cachedWhitelist: string[] | null = null;

function loadWhitelist(): string[] {
  if (cachedWhitelist) return cachedWhitelist;
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

export function getAllowedHosts(): string[] {
  return loadWhitelist();
}

export function isUrlWhitelisted(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return loadWhitelist().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch (error) {
    return false;
  }
}

export function getMaxRequestsPerSecond(): number {
  const fromEnv = Number(process.env.SCRAPER_MAX_RPS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 2;
}

export function getScraperUserAgent(): string {
  return process.env.SCRAPER_USER_AGENT || 'DermosulScraper/1.0 (+https://dermosul.com.br)';
}

export function getMaxProductsForMode(mode: ScrapeMode): number {
  if (mode === 'test') return 1;
  const fromEnv = Number(process.env.SCRAPER_MAX_PRODUCTS_CAP);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return Number.POSITIVE_INFINITY;
}

export function getScraperConcurrency(): number {
  const fromEnv = Number(process.env.SCRAPER_CONCURRENCY);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) return Math.floor(fromEnv);
  return 1;
}
