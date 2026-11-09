import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
const PORT = env.PORT;

app.listen(PORT, () => {
    console.log(`[JournalFit Server] Running on http://localhost:${PORT}`);
    console.log(`[JournalFit Server] Environment: PORT=${PORT}, DB_HOST=${env.DB_HOST}:${env.DB_PORT}, DB_NAME=${env.DB_NAME}`);
});
