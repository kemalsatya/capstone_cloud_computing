import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import SwaggerParser from '@apidevtools/swagger-parser';
import { openApiSpec } from '../src/docs/index.js';
import { createApp } from '../src/app.js';
import { configureAuthForTests } from '../src/common/middlewares/auth.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';

function mockToken({ sub = 'user-a-01', tenant = 'tenant-a', roles = ['author'] } = {}) {
    const role = roles.includes('tenant_admin')
        ? 'tenant_admin'
        : roles.includes('editor')
            ? 'editor'
            : roles[0];
    const payload = {
        sub,
        tenant_id: tenant,
        role,
        realm_access: { roles },
        preferred_username: sub,
        name: sub,
        email: `${sub}@test.local`,
    };

    return `mock.jwt.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

function reportFixture(id) {
    return {
        manuscript: {
            id,
            tenant_id: 'tenant-a',
            author_id: 'user-a-01',
            revision_no: 1,
            title: 'Cloud Native Performance Study',
            status: 'completed',
            created_at: '2026-01-01T00:00:00.000Z',
        },
        format: {
            status: 'completed',
            outcome: 'passed',
            summary: { counts: { error: 0, warning: 0, info: 0 } },
        },
        scope: { status: 'queued', summary: {} },
        findings: [],
        rule: { template_id: 'tpl-a-default', version: 1 },
    };
}

describe('OpenAPI tenant restrictions', () => {
    let server;
    let baseUrl;
    let originalGetReport;

    before(async () => {
        configureAuthForTests({ mode: 'mock' });
        originalGetReport = manuscriptRepository.getFullReportByManuscriptId;
        manuscriptRepository.getFullReportByManuscriptId = async (id) => reportFixture(id);

        const app = createApp();
        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', resolve);
        });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    after(async () => {
        manuscriptRepository.getFullReportByManuscriptId = originalGetReport;
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    async function request(path, { token, headers = {}, method = 'GET' } = {}) {
        const requestHeaders = { ...headers };
        if (token) requestHeaders.Authorization = `Bearer ${token}`;
        return fetch(`${baseUrl}${path}`, { method, headers: requestHeaders });
    }

    test('OpenAPI document is valid', async () => {
        await SwaggerParser.validate(structuredClone(openApiSpec));
    });

    test('every tenant-scoped operation documents auth and isolation', () => {
        const operations = [];

        for (const [path, methods] of Object.entries(openApiSpec.paths)) {
            for (const [method, operation] of Object.entries(methods)) {
                if (operation && operation['x-tenant-scoped']) {
                    operations.push({ path, method, operation });
                }
            }
        }

        assert.ok(operations.length >= 3);

        for (const { path, method, operation } of operations) {
            assert.ok(
                operation.security?.some((requirement) => requirement.bearerAuth),
                `${method.toUpperCase()} ${path} harus memakai bearerAuth`
            );
            assert.ok(operation.responses['401'], `${method.toUpperCase()} ${path} harus mendokumentasikan 401`);
            assert.ok(operation.responses['403'], `${method.toUpperCase()} ${path} harus mendokumentasikan 403`);

            if (path.includes('{')) {
                assert.ok(operation.responses['404'], `${method.toUpperCase()} ${path} harus mendokumentasikan 404`);
            }
        }

        assert.ok(openApiSpec.paths['/api/manuscripts'].post.responses['202']);
        assert.ok(openApiSpec.paths['/api/manuscripts'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/manuscripts/upload'].post.responses['201']);
        assert.ok(openApiSpec.paths['/api/manuscripts/{id}'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/manuscripts/{id}/history'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/manuscripts/{id}/report'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/rule-templates'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/rule-templates'].post.responses['201']);
        assert.ok(openApiSpec.paths['/api/tenant/rule-templates/{id}'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/rule-templates/{id}/rules'].put.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/rule-templates/{id}/activate'].post.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/aim-scope'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/aim-scope'].put.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/summary'].get.responses['200']);
        assert.ok(openApiSpec.paths['/api/tenant/ai-usage'].get.responses['200']);
    });

    test('author in tenant-a can read the tenant-a report', async () => {
        const response = await request('/api/manuscripts/ms-001/report', {
            token: mockToken({ tenant: 'tenant-a', roles: ['author'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.manuscript.tenant_id, 'tenant-a');
        assert.equal(body.data.format.status, 'completed');
    });

    test('author in tenant-b receives 404 for a tenant-a manuscript', async () => {
        const response = await request('/api/manuscripts/ms-001/report', {
            token: mockToken({
                sub: 'user-b-01',
                tenant: 'tenant-b',
                roles: ['author'],
            }),
        });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('editor in tenant-a can read the tenant-a report', async () => {
        const response = await request('/api/manuscripts/ms-001/report', {
            token: mockToken({ sub: 'user-a-editor', tenant: 'tenant-a', roles: ['editor'] }),
        });

        assert.equal(response.status, 200);
    });

    test('editor cannot use the author-only upload endpoint', async () => {
        const response = await request('/api/manuscripts', {
            method: 'POST',
            token: mockToken({ sub: 'user-a-editor', tenant: 'tenant-a', roles: ['editor'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('missing bearer token is rejected with 401', async () => {
        const response = await request('/api/manuscripts/ms-001/report');
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, 'UNAUTHENTICATED');
    });

    test('a forged X-Tenant-ID is ignored when a valid JWT is present', async () => {
        const response = await request('/api/manuscripts/ms-001/report', {
            token: mockToken({ tenant: 'tenant-a', roles: ['author'] }),
            headers: { 'X-Tenant-ID': 'tenant-b' },
        });

        assert.equal(response.status, 200);
    });

    test('header mode still enforces tenant isolation', async () => {
        configureAuthForTests({ mode: 'header' });

        try {
            const own = await request('/api/manuscripts/ms-001/report', {
                headers: { 'X-Tenant-ID': 'tenant-a' },
            });
            assert.equal(own.status, 200);

            const cross = await request('/api/manuscripts/ms-001/report', {
                headers: { 'X-Tenant-ID': 'tenant-b' },
            });
            assert.equal(cross.status, 404);

            const missing = await request('/api/manuscripts/ms-001/report');
            assert.equal(missing.status, 400);
        } finally {
            configureAuthForTests({ mode: 'mock' });
        }
    });
});
