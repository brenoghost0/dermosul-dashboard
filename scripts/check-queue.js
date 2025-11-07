"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queue_1 = require("../src/lib/scraping/queue");
(async () => {
    const states = ['waiting', 'delayed', 'active', 'completed', 'failed', 'paused'];
    for (const state of states) {
        const jobs = await queue_1.scrapeQueue.getJobs([state]);
        console.log(state.toUpperCase(), jobs.length);
        for (const job of jobs) {
            console.log('  job', job.id, job.name, 'state', await job.getState());
        }
    }
    await queue_1.scrapeQueue.close();
    process.exit(0);
})();
