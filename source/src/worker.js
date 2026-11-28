import http from 'node:http';
import { assertSafeAiMode, assertSafeAuthMode, env } from './config/env.js';
import { startQueue, stopQueue } from './modules/queue/index.js';
import { registerFormatWorker } from './modules/workers/format.worker.js';
import { registerScopeWorker } from './modules/workers/scope.worker.js';
import { renderPrometheusMetrics } from './common/utils/metrics.js';

assertSafeAuthMode();

const metricsServer = http.createServer((req, res) => {
    if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(renderPrometheusMetrics());
        return;
    }

    if (req.url === '/health/live') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'alive' }));
        return;
    }

    if (req.url === '/health/ready') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready', queue: 'ready' }));
        return;
    }

    res.writeHead(404);
    res.end();
});

metricsServer.on('error', (err) => {
    console.error(`[JournalFit Worker] Metrics server error: ${err.message}`);
});

async function main() {
    console.log(`[JournalFit Worker] Starting worker type: ${env.WORKER_TYPE}`);
    const boss = await startQueue();

    if (env.WORKER_TYPE === 'format') {
        await registerFormatWorker(boss);
    } else if (env.WORKER_TYPE === 'scope') {
        assertSafeAiMode();
        await registerScopeWorker(boss);
    } else {
        throw new Error(`WORKER_TYPE tidak dikenal: ${env.WORKER_TYPE}`);
    }

    metricsServer.listen(env.WORKER_METRICS_PORT, () => {
        console.log(`[JournalFit Worker] Metrics on http://localhost:${env.WORKER_METRICS_PORT}/metrics`);
    });

    console.log('[JournalFit Worker] Ready and listening for jobs.');
}

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
        console.log(`[JournalFit Worker] Received ${signal}, stopping...`);
        metricsServer.close();
        await stopQueue().catch(() => {});
        process.exit(0);
    });
}

main().catch((err) => {
    console.error('[JournalFit Worker] Fatal error:', err);
    process.exit(1);
});
