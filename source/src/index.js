import http from 'node:http';
import { createApp } from './app.js';
import { assertSafeAuthMode, env } from './config/env.js';
import { getQueueDepths, startQueue, stopQueue } from './modules/queue/index.js';
import { renderPrometheusMetrics } from './common/utils/metrics.js';

assertSafeAuthMode();

const app = createApp();
const PORT = env.PORT;
let queueRetryTimer = null;

const server = app.listen(PORT, () => {
    console.log(`[JournalFit Server] Running on http://localhost:${PORT}`);
    console.log(`[JournalFit Server] Environment: PORT=${PORT}, DB_HOST=${env.DB_HOST}:${env.DB_PORT}, DB_NAME=${env.DB_NAME}`);
    console.log(`[JournalFit Server] Auth mode: ${env.AUTH_MODE}, issuer=${env.KEYCLOAK_ISSUER}, audience=${env.KEYCLOAK_AUDIENCE}`);
    console.log(`[JournalFit Server] Metrics: public=${env.METRICS_PUBLIC}, internalPort=${env.METRICS_PORT}`);
});

const metricsServer = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        const queueDepths = await getQueueDepths().catch(() => ({}));
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
        res.end(renderPrometheusMetrics({ queueDepths }));
        return;
    }

    res.writeHead(404);
    res.end();
});

metricsServer.on('error', (err) => {
    console.error(`[JournalFit Server] Metrics server error: ${err.message}`);
});

metricsServer.listen(env.METRICS_PORT, () => {
    console.log(`[JournalFit Server] Internal metrics on http://localhost:${env.METRICS_PORT}/metrics`);
});

async function startQueueWithRetry() {
    try {
        await startQueue();
        console.log('[JournalFit Server] pg-boss queue ready.');
    } catch (err) {
        console.error(`[JournalFit Server] Queue not ready: ${err.message}. Retrying in 5s.`);
        queueRetryTimer = setTimeout(startQueueWithRetry, 5000);
        queueRetryTimer.unref?.();
    }
}

startQueueWithRetry();

async function shutdown(signal) {
    console.log(`[JournalFit Server] Received ${signal}, shutting down...`);
    if (queueRetryTimer) clearTimeout(queueRetryTimer);
    await stopQueue().catch(() => {});
    metricsServer.close();
    server.close(() => process.exit(0));
}

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        shutdown(signal).catch(() => process.exit(1));
    });
}
