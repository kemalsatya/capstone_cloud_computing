import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../../../config/env.js';

let remoteJwks;
let overrides = {};

export function configureTokenVerifier(options = {}) {
    overrides = { ...overrides, ...options };
}

function getJwks() {
    if (overrides.jwks) return overrides.jwks;

    remoteJwks ||= createRemoteJWKSet(new URL(env.KEYCLOAK_JWKS_URI), {
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
    });
    return remoteJwks;
}

export async function verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, getJwks(), {
        issuer: overrides.issuer ?? env.KEYCLOAK_ISSUER,
        audience: overrides.audience ?? env.KEYCLOAK_AUDIENCE,
        algorithms: ['RS256'],
        clockTolerance: 5,
    });

    return payload;
}
