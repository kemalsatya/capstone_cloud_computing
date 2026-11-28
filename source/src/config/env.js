import 'dotenv/config';

function positiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const env = {
    PORT: process.env.PORT || 8000,
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
    DB_NAME: process.env.DB_NAME || 'journalfit',
    DATABASE_URL: process.env.DATABASE_URL || null,
    AUTH_MODE: process.env.AUTH_MODE || 'jwt',
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER || 'http://localhost:8081/realms/journalfit',
    KEYCLOAK_JWKS_URI: process.env.KEYCLOAK_JWKS_URI
        || 'http://localhost:8081/realms/journalfit/protocol/openid-connect/certs',
    KEYCLOAK_AUDIENCE: process.env.KEYCLOAK_AUDIENCE || 'journalfit-api',
    KEYCLOAK_TENANT_CLAIM: process.env.KEYCLOAK_TENANT_CLAIM || 'tenant_id',
    MAX_UPLOAD_MB: positiveInt(process.env.MAX_UPLOAD_MB, 10),
    UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
    PG_BOSS_SCHEMA: process.env.PG_BOSS_SCHEMA || 'pgboss',
    FORMAT_QUEUE: process.env.FORMAT_QUEUE || 'format-check',
    SCOPE_QUEUE: process.env.SCOPE_QUEUE || 'scope-check',
    WORKER_TYPE: process.env.WORKER_TYPE || 'format',
    WORKER_METRICS_PORT: positiveInt(process.env.WORKER_METRICS_PORT, 9101),
    ENABLE_DOCS: process.env.ENABLE_DOCS === 'true',
    AI_MODE: process.env.AI_MODE || 'mock',
    GROQ_API_KEY: process.env.GROQ_API_KEY || null,
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    AI_TIMEOUT_MS: positiveInt(process.env.AI_TIMEOUT_MS, 30000),
    AI_PRICE_IN_PER_1M: nonNegativeNumber(process.env.AI_PRICE_IN_PER_1M, 0),
    AI_PRICE_OUT_PER_1M: nonNegativeNumber(process.env.AI_PRICE_OUT_PER_1M, 0),
};

export function databaseConnectionString() {
    if (env.DATABASE_URL) {
        return env.DATABASE_URL;
    }

    const user = encodeURIComponent(env.DB_USER);
    const password = encodeURIComponent(env.DB_PASSWORD);
    return `postgres://${user}:${password}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
}

export function assertSafeAuthMode() {
    if (process.env.NODE_ENV === 'production' && env.AUTH_MODE !== 'jwt') {
        throw new Error(
            `AUTH_MODE='${env.AUTH_MODE}' is not allowed in production. Use AUTH_MODE=jwt.`
        );
    }
}

export function assertSafeAiMode() {
    if (!['groq', 'mock'].includes(env.AI_MODE)) {
        throw new Error(`AI_MODE='${env.AI_MODE}' tidak dikenal. Gunakan groq atau mock.`);
    }

    if (env.AI_MODE === 'groq' && !env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY wajib diisi ketika AI_MODE=groq.');
    }
}
