import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    bootstrapDatabase,
    cleanupUploads,
    countFiles,
    hasTestDb,
    mockToken,
} from './helpers.js';

const suite = hasTestDb ? describe : describe.skip;

const AUTHOR_A = { sub: 'user-a-01', tenant: 'tenant-a', roles: ['author'] };
const AUTHOR_B = { sub: 'user-b-01', tenant: 'tenant-b', roles: ['author'] };
const EDITOR_A = { sub: 'user-a-editor', tenant: 'tenant-a', roles: ['editor'] };
const EDITOR_B = { sub: 'user-b-editor', tenant: 'tenant-b', roles: ['editor'] };
const ADMIN_B = { sub: 'user-b-admin', tenant: 'tenant-b', roles: ['tenant_admin'] };

suite('Negative authorization NT-01..NT-10', () => {
    let server;
    let baseUrl;
    let pool;
    let templateIds;
    let uploadDir;

    before(async () => {
        const boot = await bootstrapDatabase();
        pool = boot.pool;
        templateIds = boot.templateIds;
        uploadDir = boot.uploadDir;

        const { createApp } = await import('../../src/app.js');
        const { configureAuthForTests } = await import('../../src/common/middlewares/auth.js');

        configureAuthForTests({ mode: 'mock' });

        const app = createApp();
        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                baseUrl = `http://127.0.0.1:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        if (pool) {
            await pool.end();
        }
        await cleanupUploads();
    });

    async function request(path, {
        token = null,
        method = 'GET',
        headers = {},
        body,
    } = {}) {
        const requestHeaders = { ...headers };
        if (token) requestHeaders.Authorization = `Bearer ${token}`;

        return fetch(`${baseUrl}${path}`, {
            method,
            headers: requestHeaders,
            body,
        });
    }

    test('NT-01: author tenant B cannot read tenant A manuscript', async () => {
        const response = await request('/api/manuscripts/ms-a-1/report', {
            token: mockToken(AUTHOR_B),
        });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('NT-02: editor tenant B list never contains tenant A', async () => {
        const response = await request('/api/manuscripts', {
            token: mockToken(EDITOR_B),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        const ids = body.data.items.map((item) => item.id);
        assert.ok(ids.includes('ms-b-1'));
        assert.ok(!ids.includes('ms-a-1'));
        assert.ok(!ids.includes('ms-a-other'));
    });

    test('NT-03: author cannot read another author manuscript in the same tenant', async () => {
        const response = await request('/api/manuscripts/ms-a-other/report', {
            token: mockToken(AUTHOR_A),
        });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('NT-04: author cannot use tenant admin endpoints', async () => {
        const response = await request('/api/tenant/rule-templates', {
            method: 'POST',
            token: mockToken(AUTHOR_A),
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('NT-05: editor cannot upload a manuscript', async () => {
        const response = await request('/api/manuscripts', {
            method: 'POST',
            token: mockToken(EDITOR_A),
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('NT-06: missing or invalid token is rejected', async () => {
        const missing = await request('/api/manuscripts/ms-a-1/report');
        const missingBody = await missing.json();
        assert.equal(missing.status, 401);
        assert.equal(missingBody.error.code, 'UNAUTHENTICATED');

        const invalid = await request('/api/manuscripts/ms-a-1/report', {
            token: 'not-a-valid-token',
        });
        const invalidBody = await invalid.json();
        assert.equal(invalid.status, 401);
        assert.equal(invalidBody.error.code, 'UNAUTHENTICATED');
    });

    test('NT-07: token without tenant_id is rejected', async () => {
        const response = await request('/api/auth/me', {
            token: mockToken({ ...AUTHOR_A, tenant: null }),
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, 'TENANT_CLAIM_MISSING');
    });

    test('NT-08: non-DOCX upload leaves no rows or objects', async () => {
        const beforeFiles = await countFiles(uploadDir);
        const beforeRows = await pool.query(
            `SELECT COUNT(*)::int AS count FROM manuscripts WHERE tenant_id = 'tenant-a'`
        );

        const form = new FormData();
        form.append(
            'file',
            new Blob([Buffer.from('not a docx file')], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }),
            'bad.docx'
        );

        const response = await request('/api/manuscripts', {
            method: 'POST',
            token: mockToken(AUTHOR_A),
            body: form,
        });
        const body = await response.json();

        assert.ok([400, 415].includes(response.status));
        assert.equal(body.error.code, 'INVALID_FILE');

        const afterFiles = await countFiles(uploadDir);
        const afterRows = await pool.query(
            `SELECT COUNT(*)::int AS count FROM manuscripts WHERE tenant_id = 'tenant-a'`
        );

        assert.equal(afterFiles, beforeFiles);
        assert.equal(afterRows.rows[0].count, beforeRows.rows[0].count);
    });

    test('NT-09: admin tenant B cannot activate tenant A rule', async () => {
        const response = await request(
            `/api/tenant/rule-templates/${templateIds['tenant-a']}/activate`,
            {
                method: 'POST',
                token: mockToken(ADMIN_B),
            }
        );
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('NT-10: forged X-Tenant-ID is ignored with a valid token', async () => {
        const response = await request('/api/manuscripts/ms-a-1/report', {
            token: mockToken(AUTHOR_A),
            headers: { 'X-Tenant-ID': 'tenant-b' },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.manuscript.tenant_id, 'tenant-a');
    });
});
