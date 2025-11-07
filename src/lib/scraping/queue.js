"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeQueueEvents = exports.scrapeQueue = exports.SCRAPE_QUEUE_NAME = exports.scrapeEventsConnection = exports.scrapeQueueConnection = exports.SCRAPE_QUEUE_PREFIX = void 0;
exports.createScrapeRedisConnection = createScrapeRedisConnection;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
exports.SCRAPE_QUEUE_PREFIX = 'scrape-jobs';
function createScrapeRedisConnection() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    return new ioredis_1.default(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
}
exports.scrapeQueueConnection = createScrapeRedisConnection();
exports.scrapeEventsConnection = createScrapeRedisConnection();
exports.scrapeQueueConnection.on('error', (err) => {
    console.error('[scrapeQueue] Redis connection error', err);
});
exports.scrapeEventsConnection.on('error', (err) => {
    console.error('[scrapeQueueEvents] Redis connection error', err);
});
exports.SCRAPE_QUEUE_NAME = 'scrape-jobs';
exports.scrapeQueue = new bullmq_1.Queue(exports.SCRAPE_QUEUE_NAME, {
    connection: exports.scrapeQueueConnection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
    },
    prefix: exports.SCRAPE_QUEUE_PREFIX,
});
exports.scrapeQueueEvents = new bullmq_1.QueueEvents(exports.SCRAPE_QUEUE_NAME, {
    connection: exports.scrapeEventsConnection,
    prefix: exports.SCRAPE_QUEUE_PREFIX,
});
exports.scrapeQueueEvents.waitUntilReady().catch((error) => {
    console.error('[scrapeQueueEvents] failed to initialize', error);
});
