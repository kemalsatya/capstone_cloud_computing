import { createApp } from './app.js';
import { env, assertSafeAuthMode } from './config/env.js';

assertSafeAuthMode();

const app = createApp();
const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`[JournalFit Server] Running on http://localhost:${PORT}`);
    console.log(`[JournalFit Server] Environment: PORT=${PORT}, DB_HOST=${env.DB_HOST}:${env.DB_PORT}, DB_NAME=${env.DB_NAME}`);
    console.log(`[JournalFit Server] Auth mode: ${env.AUTH_MODE}, issuer=${env.KEYCLOAK_ISSUER}, audience=${env.KEYCLOAK_AUDIENCE}`);
});
