import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { createApp } from '../src/app.js';
import { AppError } from '../src/common/middlewares/errorHandler.js';
import { configureAuthForTests } from '../src/common/middlewares/auth.js';
import { configureTokenVerifier, verifyAccessToken } from '../src/modules/auth/services/token.service.js';
import { mapClaims } from '../src/modules/auth/mappers/claims.js';
import { userRepository } from '../src/modules/auth/repositories/user.repository.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';

const ISSUER = 'http://localhost:8081/realms/journalfit';
const AUDIENCE = 'journalfit-api';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const { privateKey: otherPrivateKey } = await generateKeyPair('RS256');
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = 'test-key';
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';
const jwks = createLocalJWKSet({ keys: [publicJwk] });

configureTokenVerifier({ jwks, issuer: ISSUER, audience: AUDIENCE });
configureAuthForTests({ mode: 'jwt' });

function signToken({
    payload = {},
    issuer = ISSUER,
    audience = AUDIENCE,
    sub = 'user-sub',
    expiresIn = '5m',
    key = privateKey,
} = {}) {
    return new SignJWT({
        tenant_id: 'tenant-a',
        realm_access: { roles: ['author'] },
        name: 'Author A',
        email: 'author.a@tenant-a.test',
        ...payload,
    })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(key);
}

describe('Keycloak token verification', () => {
    test('accepts a valid token and exposes the tenant claim', async () => {
        const token = await signToken();
        const payload = await verifyAccessToken(token);

        assert.strictEqual(payload.tenant_id, 'tenant-a');
        assert.deepStrictEqual(payload.realm_access.roles, ['author']);
    });

    test('rejects an expired token', async () => {
        const token = await signToken({ expiresIn: Math.floor(Date.now() / 1000) - 10 });
        await assert.rejects(() => verifyAccessToken(token));
    });

    test('rejects a wrong issuer', async () => {
        const token = await signToken({ issuer: 'http://localhost:8081/realms/other' });
        await assert.rejects(() => verifyAccessToken(token));
    });

    test('rejects a wrong audience', async () => {
        const token = await signToken({ audience: 'another-api' });
        await assert.rejects(() => verifyAccessToken(token));
    });

    test('rejects a bad signature', async () => {
        const token = await signToken({ key: otherPrivateKey });
        await assert.rejects(() => verifyAccessToken(token));
    });
});

describe('Claim mapping', () => {
    test('throws UNAUTHENTICATED when sub is absent', () => {
        assert.throws(
            () => mapClaims({ tenant_id: 'tenant-a', realm_access: { roles: ['author'] } }),
            (err) => err.code === 'UNAUTHENTICATED' && err.statusCode === 401
        );
    });

    test('throws TENANT_CLAIM_MISSING when tenant_id is absent', () => {
        assert.throws(
            () => mapClaims({ sub: 'user', realm_access: { roles: ['author'] } }),
            (err) => err.code === 'TENANT_CLAIM_MISSING' && err.statusCode === 403
        );
    });

    test('normalizes legacy realm role aliases', () => {
        const mapped = mapClaims({
            sub: 'user',
            tenant_id: 'tenant-a',
            realm_access: { roles: ['user', 'operator'] },
        });

        assert.deepStrictEqual(mapped.roles.sort(), ['author', 'editor']);
        assert.strictEqual(mapped.role, 'editor');
    });

    test('prefers tenant_admin over other roles', () => {
        const mapped = mapClaims({
            sub: 'user',
            tenant_id: 'tenant-b',
            realm_access: { roles: ['author', 'editor', 'admin'] },
        });

        assert.strictEqual(mapped.role, 'tenant_admin');
        assert.strictEqual(mapped.tenantId, 'tenant-b');
    });
});

describe('JWT HTTP integration', () => {
    let server;
    let baseUrl;
    let originalProvision;

    before(async () => {
        originalProvision = userRepository.provisionFromClaims;
        userRepository.provisionFromClaims = async (claims) => ({
            id: claims.sub,
            tenant_id: claims.tenantId,
            role: claims.role,
            name: claims.name,
            email: claims.email,
        });

        const app = createApp();
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                baseUrl = `http://localhost:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        userRepository.provisionFromClaims = originalProvision;
        await new Promise((resolve) => server.close(resolve));
    });

    test('GET /api/auth/me returns the token tenant and role', async () => {
        const token = await signToken({
            sub: 'user-a-01',
            payload: { name: 'Author A', email: 'author.a@tenant-a.test' },
        });

        const res = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.tenant_id, 'tenant-a');
        assert.strictEqual(data.role, 'author');
        assert.strictEqual(data.user_id, 'user-a-01');
    });

    test('rejects a request without a bearer token', async () => {
        const res = await fetch(`${baseUrl}/api/auth/me`);
        const data = await res.json();

        assert.strictEqual(res.status, 401);
        assert.strictEqual(data.error.code, 'UNAUTHENTICATED');
    });

    test('rejects a token without a tenant claim', async () => {
        const token = await new SignJWT({ realm_access: { roles: ['author'] } })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setIssuer(ISSUER)
            .setAudience(AUDIENCE)
            .setSubject('user-x')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);

        const res = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        assert.strictEqual(res.status, 403);
        assert.strictEqual(data.error.code, 'TENANT_CLAIM_MISSING');
    });

    test('ignores a forged X-Tenant-ID when a valid token is present', async () => {
        const originalReport = manuscriptRepository.getFullReportByManuscriptId;
        manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
            manuscript: { id, tenant_id: 'tenant-a', author_id: 'user-a-01', title: 'Paper 1' },
            checkResult: { id: 'cr-1', format_score: 90 },
            findings: [],
        });

        try {
            const token = await signToken({ sub: 'user-a-01' });
            const res = await fetch(`${baseUrl}/api/manuscripts/ms-001/report`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Tenant-ID': 'tenant-b',
                },
            });
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.data.manuscript.tenant_id, 'tenant-a');
        } finally {
            manuscriptRepository.getFullReportByManuscriptId = originalReport;
        }
    });

    test('returns 404 for a cross-tenant manuscript', async () => {
        const originalReport = manuscriptRepository.getFullReportByManuscriptId;
        manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
            manuscript: { id, tenant_id: 'tenant-a', author_id: 'user-a-01', title: 'Paper 1' },
            checkResult: { id: 'cr-1', format_score: 90 },
            findings: [],
        });

        try {
            const token = await signToken({
                sub: 'user-b-01',
                payload: { tenant_id: 'tenant-b' },
            });
            const res = await fetch(`${baseUrl}/api/manuscripts/ms-001/report`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            assert.strictEqual(res.status, 404);
            assert.strictEqual(data.error.code, 'NOT_FOUND');
        } finally {
            manuscriptRepository.getFullReportByManuscriptId = originalReport;
        }
    });

    test('rejects an editor on the author-only upload endpoint', async () => {
        const token = await signToken({
            sub: 'editor-a',
            payload: { realm_access: { roles: ['editor'] } },
        });

        const res = await fetch(`${baseUrl}/api/manuscripts/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        assert.strictEqual(res.status, 403);
        assert.strictEqual(data.error.code, 'FORBIDDEN');
    });

    test('rejects a token whose tenant differs from the provisioned user', async () => {
        userRepository.provisionFromClaims = async () => {
            throw new AppError('Access token tenant does not match the provisioned user.', 403, null, 'FORBIDDEN');
        };

        try {
            const token = await signToken({ sub: 'user-a-01' });
            const res = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();

            assert.strictEqual(res.status, 403);
            assert.strictEqual(data.error.code, 'FORBIDDEN');
        } finally {
            userRepository.provisionFromClaims = async (claims) => ({
                id: claims.sub,
                tenant_id: claims.tenantId,
                role: claims.role,
                name: claims.name,
                email: claims.email,
            });
        }
    });
});
