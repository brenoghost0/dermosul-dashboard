import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import type { ScrapeQueuePayload } from './types';

export const SCRAPE_QUEUE_PREFIX = 'scrape-jobs';

export function createScrapeRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export const scrapeQueueConnection = createScrapeRedisConnection();
export const scrapeEventsConnection = createScrapeRedisConnection();

scrapeQueueConnection.on('error', (err) => {
  console.error('[scrapeQueue] Redis connection error', err);
});

scrapeEventsConnection.on('error', (err) => {
  console.error('[scrapeQueueEvents] Redis connection error', err);
});

export const SCRAPE_QUEUE_NAME = 'scrape-jobs';

export const scrapeQueue = new Queue<ScrapeQueuePayload>(SCRAPE_QUEUE_NAME, {
  connection: scrapeQueueConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
  prefix: SCRAPE_QUEUE_PREFIX,
});

export const scrapeQueueEvents = new QueueEvents(SCRAPE_QUEUE_NAME, {
  connection: scrapeEventsConnection,
  prefix: SCRAPE_QUEUE_PREFIX,
});

scrapeQueueEvents.waitUntilReady().catch((error) => {
  console.error('[scrapeQueueEvents] failed to initialize', error);
});
