import 'dotenv/config';

export const env = {
    PORT: process.env.PORT || 8000,
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
    DB_NAME: process.env.DB_NAME || 'journalfit',
    AUTH_MODE: process.env.AUTH_MODE || 'jwt',
    KEYCLOAK_ISSUER: process.env.KEYCLOAK_ISSUER || 'http://localhost:8081/realms/journalfit',
    KEYCLOAK_JWKS_URI: process.env.KEYCLOAK_JWKS_URI
        || 'http://localhost:8081/realms/journalfit/protocol/openid-connect/certs',
    KEYCLOAK_AUDIENCE: process.env.KEYCLOAK_AUDIENCE || 'journalfit-api',
    KEYCLOAK_TENANT_CLAIM: process.env.KEYCLOAK_TENANT_CLAIM || 'tenant_id',
};

export function assertSafeAuthMode() {
    if (process.env.NODE_ENV === 'production' && env.AUTH_MODE !== 'jwt') {
        throw new Error(
            `AUTH_MODE='${env.AUTH_MODE}' is not allowed in production. Use AUTH_MODE=jwt.`
        );
    }
}
