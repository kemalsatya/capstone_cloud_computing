import { createApp } from './app.js';
import { assertSafeAuthMode, env } from './config/env.js';
import { startQueue, stopQueue } from './modules/queue/index.js';

assertSafeAuthMode();

const app = createApp();
const PORT = env.PORT;
let queueRetryTimer = null;

const server = app.listen(PORT, () => {
    console.log(`[JournalFit Server] Running on http://localhost:${PORT}`);
    console.log(`[JournalFit Server] Environment: PORT=${PORT}, DB_HOST=${env.DB_HOST}:${env.DB_PORT}, DB_NAME=${env.DB_NAME}`);
    console.log(`[JournalFit Server] Auth mode: ${env.AUTH_MODE}, issuer=${env.KEYCLOAK_ISSUER}, audience=${env.KEYCLOAK_AUDIENCE}`);
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
    server.close(() => process.exit(0));
}

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
        shutdown(signal).catch(() => process.exit(1));
    });
}
