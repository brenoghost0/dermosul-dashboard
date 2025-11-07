export type ScrapeMode = 'full' | 'test';

export interface ScrapeRuntimeConfig {
  maxRequestsPerSecond?: number;
  detailConcurrency?: number;
  allowDynamicRendering?: boolean;
  preferDynamicCatalog?: boolean;
}

export interface ScrapeQueuePayload {
  jobId: string;
  sourceUrl: string;
  mode: ScrapeMode;
  userId?: string | null;
  turbo?: boolean;
  config?: ScrapeRuntimeConfig;
}

export interface ScrapedProductInput {
  title: string;
  brand?: string | null;
  price?: number | null;
  sku?: string | null;
  shortDescription?: string | null;
  longDescriptionHtml?: string | null;
  images?: string[];
  attributes?: Record<string, unknown>;
  detailUrl?: string | null;
  raw?: Record<string, unknown>;
  categories?: string[];
  stockQuantity?: number;
}

export type ScrapeRealtimeEvent =
  | {
      type: 'log';
      jobId: string;
      message: string;
      level?: 'info' | 'warn' | 'error';
      logId?: string;
      timestamp?: string;
      processed?: number;
      total?: number;
      meta?: Record<string, unknown>;
    }
  | {
      type: 'progress';
      jobId: string;
      processed: number;
      total: number;
    }
  | {
      type: 'status';
      jobId: string;
      status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
      processed?: number;
      total?: number;
      errorMessage?: string;
    };

export interface ScrapeRunnerOptions {
  maxRequestsPerSecond?: number;
  detailConcurrency?: number;
  allowDynamicRendering?: boolean;
  preferDynamicCatalog?: boolean;
}
