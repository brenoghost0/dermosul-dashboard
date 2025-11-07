import * as dotenv from 'dotenv';
dotenv.config();

import { Worker } from 'bullmq';
import { ScrapeJobStatus } from '@prisma/client';
import {
  appendScrapeJobLog,
  incrementScrapeJobProcessed,
  markScrapeJobFinished,
  setScrapeJobStatus,
  setScrapeJobTotals,
  getScrapeJobById,
  persistScrapedProduct,
  type ScrapeJobLogEntry,
} from '../data/scrape';
import { createScrapeRedisConnection, SCRAPE_QUEUE_NAME, SCRAPE_QUEUE_PREFIX } from '../lib/scraping/queue';
import { getScraperConcurrency } from '../lib/scraping/config';
import { runScrapeProcess } from '../lib/scraping/scrape-runner';
import type { ScrapeQueuePayload, ScrapeRunnerOptions } from '../lib/scraping/types';
import { generateShortId } from '../utils/index';

function buildLogEntry(message: string, level: ScrapeJobLogEntry['level'] = 'info', context?: Record<string, unknown>): ScrapeJobLogEntry {
  return {
    id: generateShortId(12),
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

async function safeUpdateProgress(job: import('bullmq').Job, payload: unknown) {
  try {
    await job.updateProgress(payload as any);
  } catch (error) {
    console.error('[scrape-worker] Falha ao publicar progresso', error);
  }
}

const worker = new Worker<ScrapeQueuePayload>(
  SCRAPE_QUEUE_NAME,
  async (job) => {
    const { jobId, sourceUrl, mode, turbo = false, config: payloadConfig } = job.data;
    const isTurbo = Boolean(turbo);
    const defaultTurboRps = Number(process.env.SCRAPER_TURBO_MAX_RPS ?? '10');
    const defaultTurboConcurrency = Number(process.env.SCRAPER_TURBO_CONCURRENCY ?? '4');
    const turboPreferDynamic = process.env.SCRAPER_TURBO_PREFER_DYNAMIC ?? 'true';
    const runnerOptions: ScrapeRunnerOptions = {
      maxRequestsPerSecond: payloadConfig?.maxRequestsPerSecond ?? (isTurbo ? defaultTurboRps : undefined),
      detailConcurrency: payloadConfig?.detailConcurrency ?? (isTurbo ? defaultTurboConcurrency : undefined),
      allowDynamicRendering: payloadConfig?.allowDynamicRendering ?? true,
      preferDynamicCatalog:
        payloadConfig?.preferDynamicCatalog ??
        (isTurbo ? turboPreferDynamic.toLowerCase() !== 'false' : true),
    };

    await setScrapeJobStatus(jobId, ScrapeJobStatus.running);
    await safeUpdateProgress(job, { type: 'status', jobId, status: 'running', processed: 0, total: 0 });
    await appendScrapeJobLog(jobId, buildLogEntry(`Iniciando extração: ${sourceUrl}`));

    let totalDiscovered = 0;
    let processed = 0;
    let cancelled = false;
    let lastCancelCheck = 0;
    const cancelPollInterval = Math.max(250, Number(process.env.SCRAPER_CANCEL_POLL_INTERVAL_MS ?? '750'));

    const shouldAbort = async () => {
      if (cancelled) return true;
      const now = Date.now();
      if (now - lastCancelCheck < cancelPollInterval) {
        return cancelled;
      }
      lastCancelCheck = now;
      const jobRecord = await getScrapeJobById(jobId);
      if (jobRecord?.cancelRequested) {
        cancelled = true;
      }
      return cancelled;
    };

    const log = async (message: string, level: ScrapeJobLogEntry['level'] = 'info', context?: Record<string, unknown>) => {
      const entry = buildLogEntry(message, level, context);
      await appendScrapeJobLog(jobId, entry);
      await safeUpdateProgress(job, {
        type: 'log',
        jobId,
        message,
        level,
        logId: entry.id,
        timestamp: entry.timestamp,
        processed,
        total: totalDiscovered,
        meta: context,
      });
    };

    if (runnerOptions.maxRequestsPerSecond !== undefined) {
      runnerOptions.maxRequestsPerSecond = Math.max(1, Number(runnerOptions.maxRequestsPerSecond));
    }
    runnerOptions.detailConcurrency = Math.max(1, Number(runnerOptions.detailConcurrency ?? 1));

    try {
      if (isTurbo) {
        await log(
          `Modo turbo: até ${runnerOptions.maxRequestsPerSecond ?? '∞'} req/s, detalhes x${runnerOptions.detailConcurrency}, catálogo dinâmico ${runnerOptions.preferDynamicCatalog ? 'habilitado' : 'desabilitado'}, fallback ${runnerOptions.allowDynamicRendering ? 'on' : 'off'}.`
        );
      }

      const result = await runScrapeProcess(sourceUrl, mode, {
        onLog: log,
        onDiscoveredTotal: async (total) => {
          totalDiscovered = total;
          await setScrapeJobTotals(jobId, { totalFound: total });
          await safeUpdateProgress(job, { type: 'progress', jobId, processed, total });
        },
        onProgress: async (currentProcessed) => {
          processed = currentProcessed;
          await safeUpdateProgress(job, { type: 'progress', jobId, processed: currentProcessed, total: totalDiscovered });
        },
        shouldAbort,
        onProduct: async (product) => {
          await persistScrapedProduct(jobId, product, {
            commitToCatalog: mode !== 'test',
          });
          await incrementScrapeJobProcessed(jobId);
          await log(`Produto importado (${processed + 1}/${totalDiscovered || '?' }): ${product.title}`);
        },
      }, runnerOptions);

      processed = result.processed;
      totalDiscovered = result.totalDiscovered;

      if (cancelled) {
        await log('Extração cancelada pelo usuário.', 'warn');
        await markScrapeJobFinished(jobId, ScrapeJobStatus.cancelled);
        await safeUpdateProgress(job, {
          type: 'status',
          jobId,
          status: 'cancelled',
          processed,
          total: totalDiscovered,
        });
        return { status: 'cancelled', processed, total: totalDiscovered };
      }

      await log('Extração concluída com sucesso!', 'info');
      await markScrapeJobFinished(jobId, ScrapeJobStatus.done);
      await safeUpdateProgress(job, {
        type: 'status',
        jobId,
        status: 'done',
        processed,
        total: totalDiscovered,
      });
      return { status: 'done', processed, total: totalDiscovered };
    } catch (error) {
      await log(`Falha na extração: ${(error as Error).message}`, 'error');
      await markScrapeJobFinished(jobId, ScrapeJobStatus.failed);
      await safeUpdateProgress(job, {
        type: 'status',
        jobId,
        status: 'failed',
        processed,
        total: totalDiscovered,
        errorMessage: (error as Error).message,
      });
      throw error;
    }
  },
  {
    connection: createScrapeRedisConnection(),
    prefix: SCRAPE_QUEUE_PREFIX,
    concurrency: getScraperConcurrency(),
  }
);

worker.on('completed', (job, result) => {
  console.log(`[scrape-worker] Job ${job.id} concluído`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[scrape-worker] Job ${job?.id} falhou`, err);
});
