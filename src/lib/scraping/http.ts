import { chromium, Browser, Page } from 'playwright';
import { TextDecoder } from 'util';
import { evaluateRobots } from './robots';
import { getMaxRequestsPerSecond, getScraperUserAgent } from './config';

export interface HttpFetcherConfig {
  maxRequestsPerSecond?: number;
  allowDynamicRendering?: boolean;
}

export interface FetchOptions {
  preferDynamic?: boolean;
  timeoutMs?: number;
  allowDynamic?: boolean;
  enhancePage?: (ctx: { page: Page; url: string; signal?: AbortSignal }) => Promise<void>;
  abortSignal?: AbortSignal;
}

const CHARSET_ALIASES: Record<string, string> = {
  utf8: 'utf-8',
  'utf_8': 'utf-8',
  'iso8859-1': 'iso-8859-1',
  'iso_8859-1': 'iso-8859-1',
  latin1: 'iso-8859-1',
  'latin-1': 'iso-8859-1',
  'cp1252': 'windows-1252',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCharsetLabel(label?: string | null): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  return CHARSET_ALIASES[normalized] ?? normalized;
}

function extractCharsetFromContentType(headerValue?: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/charset=([^;]+)/i);
  if (!match) return null;
  return normalizeCharsetLabel(match[1]);
}

function extractCharsetFromMeta(htmlSnippet: string): string | null {
  if (!htmlSnippet) return null;
  const slice = htmlSnippet.slice(0, 5000);
  const direct = slice.match(/<meta[^>]+charset=["']?\s*([^"'>\s]+)/i);
  if (direct?.[1]) {
    return normalizeCharsetLabel(direct[1]);
  }
  const httpEquiv = slice.match(/<meta[^>]+http-equiv=["']content-type["'][^>]*content=["'][^"']*charset=([^"'>\s]+)/i);
  if (httpEquiv?.[1]) {
    return normalizeCharsetLabel(httpEquiv[1]);
  }
  return null;
}

async function readResponseBody(response: Response): Promise<string> {
  const buffer = Buffer.from(await response.arrayBuffer());
  let text = buffer.toString('utf8');
  let charset = extractCharsetFromContentType(response.headers.get('content-type'));

  if (!charset || charset === 'utf-8') {
    const metaCharset = extractCharsetFromMeta(text);
    if (metaCharset && metaCharset !== 'utf-8') {
      charset = metaCharset;
    }
  }

  if (charset && charset !== 'utf-8') {
    try {
      const decoder = new TextDecoder(charset as any, { fatal: false });
      text = decoder.decode(buffer);
    } catch {
      // Fallback silencioso: mantém o texto já decodificado em UTF-8
    }
  }

  return text;
}

export class HttpFetcher {
  private lastRequestAt = 0;
  private readonly delayMs: number;
  private crawlDelayMs = 0;
  private browser: Browser | null = null;
  private readonly allowDynamic: boolean;
  private cancelled = false;
  private readonly activeHttpControllers = new Set<AbortController>();

  constructor(config: HttpFetcherConfig = {}) {
    const rps = config.maxRequestsPerSecond ?? getMaxRequestsPerSecond();
    this.delayMs = Math.ceil(1000 / Math.max(1, rps));
    this.allowDynamic = config.allowDynamicRendering ?? true;
  }

  async fetchHtml(urlStr: string, options: FetchOptions = {}): Promise<string> {
    const parsedUrl = new URL(urlStr);
    const robots = await evaluateRobots(parsedUrl);
    if (!robots.allowed) {
      throw new Error(`Robots.txt bloqueia o acesso a ${parsedUrl.pathname}`);
    }
    if (robots.crawlDelayMs && robots.crawlDelayMs > this.crawlDelayMs) {
      this.crawlDelayMs = robots.crawlDelayMs;
    }

    if (this.cancelled) {
      throw new Error('SCRAPE_CANCELLED');
    }
    await this.enforceRateLimit();

    const allowDynamic = options.allowDynamic ?? this.allowDynamic;
    try {
      if (options.preferDynamic && allowDynamic) {
        return await this.fetchWithPlaywright(urlStr, options.timeoutMs, options.enhancePage, options.abortSignal);
      }
      return await this.fetchWithHttp(urlStr, options.timeoutMs, options.abortSignal);
    } catch (error) {
      if (!options.preferDynamic && allowDynamic) {
        return await this.fetchWithPlaywright(urlStr, options.timeoutMs, options.enhancePage, options.abortSignal);
      }
      throw error;
    }
  }

  private async enforceRateLimit() {
    const delay = Math.max(this.delayMs, this.crawlDelayMs);
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < delay) {
      await sleep(delay - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private async fetchWithHttp(urlStr: string, timeoutMs = 45000, externalSignal?: AbortSignal): Promise<string> {
    const controller = new AbortController();
    this.activeHttpControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortHandler = () => controller.abort();
    externalSignal?.addEventListener('abort', abortHandler);
    try {
      const response = await fetch(urlStr, {
        headers: {
          'user-agent': getScraperUserAgent(),
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'pt-BR,pt;q=0.9',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Falha ao buscar ${urlStr}: HTTP ${response.status}`);
      }
      return await readResponseBody(response);
    } catch (error) {
      if (this.cancelled) {
        throw new Error('SCRAPE_CANCELLED');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      this.activeHttpControllers.delete(controller);
      externalSignal?.removeEventListener('abort', abortHandler);
    }
  }

  private buildSecChUa(userAgent: string) {
    const chromeMatch = /Chrome\/(\d+)/i.exec(userAgent);
    const chromeVersion = chromeMatch?.[1] ?? '129';
    return `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not=A?Brand";v="24"`;
  }

  private inferPlatform(userAgent: string) {
    if (/android/i.test(userAgent)) return '"Android"';
    if (/iphone|ipad|ios/i.test(userAgent)) return '"iOS"';
    if (/windows/i.test(userAgent)) return '"Windows"';
    if (/macintosh|mac os x/i.test(userAgent)) return '"macOS"';
    return '"Linux"';
  }

  private async fetchWithPlaywright(
    urlStr: string,
    timeoutMs = 60000,
    enhancePage?: (ctx: { page: Page; url: string; signal?: AbortSignal }) => Promise<void>,
    externalSignal?: AbortSignal
  ): Promise<string> {
    const browser = await this.getBrowser();
    const userAgent = getScraperUserAgent();
    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1440, height: 900 },
      locale: 'pt-BR',
      extraHTTPHeaders: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': this.buildSecChUa(userAgent),
        'sec-ch-ua-mobile': /mobile/i.test(userAgent) ? '?1' : '?0',
        'sec-ch-ua-platform': this.inferPlatform(userAgent),
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
    try {
      const abortHandler = () => {
        try {
          page.close().catch(() => undefined);
        } catch {
          // ignore
        }
      };
      externalSignal?.addEventListener('abort', abortHandler);
      await page.goto(urlStr, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(2500);
      if (enhancePage) {
        await enhancePage({ page, url: urlStr, signal: externalSignal });
      }
      externalSignal?.removeEventListener('abort', abortHandler);
      const html = await page.content();
      return html;
    } catch (error) {
      if (this.cancelled) {
        throw new Error('SCRAPE_CANCELLED');
      }
      throw error;
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    return this.browser;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async cancel() {
    this.cancelled = true;
    for (const controller of Array.from(this.activeHttpControllers)) {
      controller.abort();
    }
    this.activeHttpControllers.clear();
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }
}
