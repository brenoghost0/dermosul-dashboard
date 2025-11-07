import { Router, Request, Response } from 'express';
import { ScrapeJobStatus } from '@prisma/client';
import { z } from 'zod';
import {
  appendScrapeJobLog,
  createScrapeJobRecord,
  getScrapeJobById,
  listScrapeJobs,
  listScrapeResults,
  setScrapeJobCancelRequested,
  setScrapeJobTotals,
  markScrapeJobFinished,
  deleteFinishedScrapeJobs,
} from '../data/scrape';
import { scrapeQueue } from '../lib/scraping/queue';
import type { ScrapeQueuePayload } from '../lib/scraping/types';
import { isUrlWhitelisted } from '../lib/scraping/config';
import { generateShortId } from '../utils/index.js';

const router = Router();

const startSchema = z.object({
  url: z.string().url('URL inválida.'),
  mode: z.enum(['full', 'test']).default('full'),
  turbo: z.boolean().optional().default(false),
});

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { url, mode, turbo } = startSchema.parse(req.body ?? {});

    if (!isUrlWhitelisted(url)) {
      return res.status(400).json({
        error: 'url_not_allowed',
        message: 'A URL fornecida não está na lista de domínios autorizados para scraping.',
      });
    }

    const job = await createScrapeJobRecord({
      sourceUrl: url,
      mode: turbo ? `${mode}:turbo` : mode,
      initialLogMessage: `Job criado para ${url}`,
    });

    if (turbo) {
      await appendScrapeJobLog(job.id, {
        id: generateShortId(12),
        level: 'info',
        message: 'Modo turbo ativado: uso agressivo de requisições e processamento paralelo.',
        timestamp: new Date().toISOString(),
        context: { turbo: true },
      });
    }

    const payload: ScrapeQueuePayload = {
      jobId: job.id,
      sourceUrl: url,
      mode,
      turbo,
    };

    await scrapeQueue.add('scrape', payload, {
      jobId: job.id,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return res.status(201).json({
      jobId: job.id,
      status: job.status,
      mode: job.mode,
      turbo,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation_failed', issues: error.issues });
    }
    console.error('[scrape:start] Erro inesperado', error);
    return res.status(500).json({ error: 'server_error', message: 'Não foi possível iniciar o scraping.' });
  }
});

router.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await listScrapeJobs();
    res.json({
      data: jobs.map((job) => {
        const turbo = Boolean(job.mode?.includes(':turbo'));
        const normalizedMode = turbo ? job.mode.replace(':turbo', '') : job.mode;
        return {
          ...job,
          mode: normalizedMode,
          turbo,
        };
      }),
    });
  } catch (error) {
    console.error('[scrape:jobs] Falha ao listar jobs', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível carregar os jobs.' });
  }
});

router.delete('/jobs', async (_req: Request, res: Response) => {
  try {
    const finishedJobs = await scrapeQueue.getJobs(['completed', 'failed', 'delayed']);
    let removedFromQueue = 0;
    for (const queueJob of finishedJobs) {
      try {
        await queueJob.remove();
        removedFromQueue += 1;
      } catch (innerError) {
        console.warn('[scrape:jobs:clear] Falha ao remover job da fila', queueJob.id, innerError);
      }
    }

    const result = await deleteFinishedScrapeJobs();
    res.json({ deleted: result.count, queueRemoved: removedFromQueue });
  } catch (error) {
    console.error('[scrape:jobs:clear] Falha ao limpar histórico', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível limpar o histórico.' });
  }
});

router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await getScrapeJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'not_found', message: 'Job não encontrado.' });
    }
    const normalizedMode = job.mode?.includes(':turbo') ? job.mode.replace(':turbo', '') : job.mode;
    const turbo = Boolean(job.mode?.includes(':turbo'));
    const results = await listScrapeResults(jobId);
    res.json({
      job: {
        ...job,
        mode: normalizedMode,
        turbo,
      },
      processedResults: results.length,
    });
  } catch (error) {
    console.error('[scrape:status] Erro ao carregar status', error);
    res.status(500).json({ error: 'server_error', message: 'Erro ao carregar o status do job.' });
  }
});

router.get('/result/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const results = await listScrapeResults(jobId);
    res.json({
      data: results,
    });
  } catch (error) {
    console.error('[scrape:result] Erro ao carregar resultados', error);
    res.status(500).json({ error: 'server_error', message: 'Erro ao carregar resultados.' });
  }
});

router.post('/cancel/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await getScrapeJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: 'not_found', message: 'Job não encontrado.' });
    }

    await setScrapeJobCancelRequested(jobId, true);
    await appendScrapeJobLog(jobId, {
      id: generateShortId(12),
      level: 'warn',
      message: 'Cancelamento solicitado pelo usuário.',
      timestamp: new Date().toISOString(),
    });

    if (job.status === 'queued') {
      const pendingJob = await scrapeQueue.getJob(jobId);
      if (pendingJob) {
        await pendingJob.remove();
        await setScrapeJobTotals(jobId, { totalFound: job.totalFound ?? 0, processed: job.processed ?? 0 });
        await markScrapeJobFinished(jobId, ScrapeJobStatus.cancelled);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[scrape:cancel] Erro ao cancelar job', error);
    res.status(500).json({ error: 'server_error', message: 'Não foi possível cancelar o job.' });
  }
});

export default router;
