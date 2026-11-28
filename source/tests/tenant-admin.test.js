import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tenantService } from '../src/modules/tenant/services/tenant.service.js';
import { tenantRepository } from '../src/modules/tenant/repositories/tenant.repository.js';
import { storage } from '../src/modules/storage/index.js';
import { createApp } from '../src/app.js';
import { configureAuthForTests } from '../src/common/middlewares/auth.js';
import { AppError } from '../src/common/middlewares/errorHandler.js';
import { buildDocx } from './fixtures/docx-builder.js';

function stubRepository(overrides = {}) {
    const originals = {};

    for (const [name, implementation] of Object.entries(overrides)) {
        originals[name] = tenantRepository[name];
        tenantRepository[name] = implementation;
    }

    return () => {
        for (const [name, original] of Object.entries(originals)) {
            tenantRepository[name] = original;
        }
    };
}

function adminAuth(overrides = {}) {
    return {
        tenantId: 'tenant-a',
        roles: ['tenant_admin'],
        user: { id: 'user-a-admin' },
        sub: 'user-a-admin',
        ...overrides,
    };
}

function mockToken({ sub = 'user-a-admin', tenant = 'tenant-a', roles = ['tenant_admin'] } = {}) {
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

describe('Tenant admin service', () => {
    test('creates a draft rule from a DOCX template', async () => {
        const buffer = await buildDocx();
        const originalPut = storage.put;
        let received = null;

        storage.put = async (key) => key;
        const restore = stubRepository({
            createRuleTemplate: async (args) => {
                received = args;
                return {
                    id: args.id,
                    version: 1,
                    status: 'draft',
                    generated_rules: args.generatedRules,
                };
            },
        });

        try {
            const result = await tenantService.createRuleTemplate({
                tenantId: 'tenant-a',
                file: { buffer, originalname: 'template.docx', size: buffer.length },
                auth: adminAuth(),
            });

            assert.match(result.id, /^tpl-/);
            assert.equal(result.version, 1);
            assert.equal(result.status, 'draft');
            assert.equal(received.generatedRules.rules.length, 9);
            assert.equal(received.objectKey, `tenants/tenant-a/templates/${result.id}.docx`);
            assert.equal(received.sha256.length, 64);
            assert.equal(received.createdBy, 'user-a-admin');
        } finally {
            storage.put = originalPut;
            restore();
        }
    });

    test('validates aim_scope length', async () => {
        await assert.rejects(
            () => tenantService.updateAimScope('tenant-a', { aim_scope: 'too short' }),
            (err) => err.statusCode === 422 && err.code === 'INVALID_AIM_SCOPE'
        );

        await assert.rejects(
            () => tenantService.updateAimScope('tenant-a', { aim_scope: 'x'.repeat(4001) }),
            (err) => err.statusCode === 422 && err.code === 'INVALID_AIM_SCOPE'
        );

        let received = null;
        const restore = stubRepository({
            updateAimScope: async (tenantId, aimScope) => {
                received = { tenantId, aimScope };
                return { id: tenantId, aim_scope: aimScope, updated_at: new Date() };
            },
        });

        try {
            const aimScope = 'x'.repeat(60);
            const result = await tenantService.updateAimScope('tenant-a', { aim_scope: aimScope });
            assert.equal(result.aim_scope, aimScope);
            assert.equal(received.aimScope, aimScope);
        } finally {
            restore();
        }
    });

    test('rejects invalid rules and accepts a valid rule set', async () => {
        await assert.rejects(
            () => tenantService.saveRules({
                tenantId: 'tenant-a',
                id: 'tpl-1',
                body: { schema_version: 1, rules: [{ id: 'FMT-999' }] },
                auth: adminAuth(),
            }),
            (err) => err.statusCode === 422 && err.code === 'RULE_INVALID'
        );

        let received = null;
        const restore = stubRepository({
            saveDraftRules: async (args) => {
                received = args;
                return { id: args.id, status: 'draft', rules: args.rules };
            },
        });

        try {
            const body = {
                schema_version: 1,
                rules: [{
                    id: 'FMT-001',
                    enabled: true,
                    severity: 'error',
                    params: { width_twips: 11906, height_twips: 16838 },
                }],
            };
            const result = await tenantService.saveRules({
                tenantId: 'tenant-a',
                id: 'tpl-1',
                body,
                auth: adminAuth(),
            });

            assert.equal(result.id, 'tpl-1');
            assert.equal(received.reviewedBy, 'user-a-admin');
        } finally {
            restore();
        }
    });

    test('activates a draft through the repository', async () => {
        let received = null;
        const restore = stubRepository({
            activateDraft: async (args) => {
                received = args;
                return { id: args.id, status: 'active' };
            },
        });

        try {
            const result = await tenantService.activateRuleTemplate({
                tenantId: 'tenant-a',
                id: 'tpl-1',
                auth: adminAuth(),
            });

            assert.equal(result.status, 'active');
            assert.equal(received.activatedBy, 'user-a-admin');
        } finally {
            restore();
        }
    });

    test('surfaces RULE_NOT_DRAFT from the repository', async () => {
        const restore = stubRepository({
            saveDraftRules: async () => {
                throw new AppError('Only draft rule templates can be edited.', 409, null, 'RULE_NOT_DRAFT');
            },
        });

        try {
            await assert.rejects(
                () => tenantService.saveRules({
                    tenantId: 'tenant-a',
                    id: 'tpl-1',
                    body: {
                        schema_version: 1,
                        rules: [{
                            id: 'FMT-001',
                            enabled: true,
                            severity: 'error',
                            params: { width_twips: 11906, height_twips: 16838 },
                        }],
                    },
                    auth: adminAuth(),
                }),
                (err) => err.statusCode === 409 && err.code === 'RULE_NOT_DRAFT'
            );
        } finally {
            restore();
        }
    });

    test('computes AI usage percentage from the monthly totals', async () => {
        const restore = stubRepository({
            getTenant: async () => ({ id: 'tenant-a', ai_monthly_token_quota: 1000 }),
            getAiUsage: async () => ({ tokens_in: 100, tokens_out: 50, est_cost_usd: 0.01 }),
        });

        try {
            const usage = await tenantService.getAiUsage('tenant-a');
            assert.equal(usage.total_tokens, 150);
            assert.equal(usage.quota, 1000);
            assert.equal(usage.usage_percentage, 15);
        } finally {
            restore();
        }
    });

    test('rejects an invalid summary date range', async () => {
        await assert.rejects(
            () => tenantService.getSummary({
                tenantId: 'tenant-a',
                query: { from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
            }),
            (err) => err.statusCode === 400 && err.code === 'INVALID_QUERY'
        );
    });
});

describe('Tenant admin HTTP', () => {
    let server;
    let baseUrl;
    let restoreRepository;

    before(async () => {
        configureAuthForTests({ mode: 'mock' });
        restoreRepository = stubRepository({
            getTenant: async () => ({
                id: 'tenant-a',
                aim_scope: 'x'.repeat(60),
                ai_monthly_token_quota: 1000,
                updated_at: '2026-01-01T00:00:00.000Z',
            }),
            getSummary: async () => ({
                total_manuscripts: 3,
                format: { checks: 3, passed: 2, failed: 1 },
                scope: { completed: 0, skipped: 0, delayed: 0 },
            }),
            getAiUsage: async () => ({ tokens_in: 100, tokens_out: 50, est_cost_usd: 0.01 }),
            listRuleTemplates: async () => [],
            getRuleTemplateById: async () => null,
        });

        const app = createApp();
        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                baseUrl = `http://127.0.0.1:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        restoreRepository?.();
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
        const requestHeaders = { ...headers };
        if (token) requestHeaders.Authorization = `Bearer ${token}`;
        if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

        return fetch(`${baseUrl}${path}`, {
            method,
            headers: requestHeaders,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }

    test('author cannot access tenant admin endpoints', async () => {
        const response = await request('/api/tenant/aim-scope', {
            token: mockToken({ roles: ['author'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.error.code, 'FORBIDDEN');
    });

    test('GET /api/tenant/aim-scope returns the tenant aim and scope', async () => {
        const response = await request('/api/tenant/aim-scope', {
            token: mockToken(),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.aim_scope.length, 60);
    });

    test('PUT /api/tenant/aim-scope validates length', async () => {
        const response = await request('/api/tenant/aim-scope', {
            token: mockToken(),
            method: 'PUT',
            body: { aim_scope: 'short' },
        });
        const body = await response.json();

        assert.equal(response.status, 422);
        assert.equal(body.error.code, 'INVALID_AIM_SCOPE');
    });

    test('GET /api/tenant/summary returns tenant statistics', async () => {
        const response = await request('/api/tenant/summary', {
            token: mockToken(),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.total_manuscripts, 3);
        assert.equal(body.data.format.passed, 2);
    });

    test('GET /api/tenant/ai-usage returns quota and percentage', async () => {
        const response = await request('/api/tenant/ai-usage', {
            token: mockToken(),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.total_tokens, 150);
        assert.equal(body.data.usage_percentage, 15);
    });

    test('GET /api/tenant/rule-templates lists versions', async () => {
        const response = await request('/api/tenant/rule-templates', {
            token: mockToken(),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body.data.items, []);
    });

    test('GET /api/tenant/rule-templates/:id returns 404 for a missing rule', async () => {
        const response = await request('/api/tenant/rule-templates/missing', {
            token: mockToken(),
        });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('POST /api/tenant/rule-templates requires a file', async () => {
        const response = await request('/api/tenant/rule-templates', {
            token: mockToken(),
            method: 'POST',
        });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, 'INVALID_FILE');
    });
});
