import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerScopeWorker } from '../src/modules/workers/scope.worker.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';

function captureHandler() {
    let handler = null;
    const boss = {
        work(queue, options, fn) {
            handler = fn;
            return 'worker-1';
        },
    };

    registerScopeWorker(boss);
    return handler;
}

function job(overrides = {}) {
    return [{
        id: 'job-1',
        data: { manuscriptId: 'ms-1', tenantId: 'tenant-a' },
        retryCount: 0,
        retryLimit: 3,
        ...overrides,
    }];
}

function context(overrides = {}) {
    return {
        id: 'ms-1',
        tenant_id: 'tenant-a',
        abstract_text: 'Cloud computing and kubernetes reliability study.',
        keywords: ['cloud computing', 'kubernetes'],
        created_at: new Date().toISOString(),
        aim_scope: 'cloud computing kubernetes gitops observability reliability',
        ai_monthly_token_quota: 100000,
        ...overrides,
    };
}

function mockRepository(overrides = {}) {
    const originals = {};
    const state = {
        completeScope: null,
        skipScope: null,
        delayScope: null,
        markScopeRunning: 0,
    };

    const implementations = {
        getScopeCheck: async () => ({ status: 'queued' }),
        markScopeRunning: async () => {
            state.markScopeRunning += 1;
            return 1;
        },
        getScopeContext: async () => context(),
        getTenantAiUsageThisMonth: async () => ({ tokens_in: 0, tokens_out: 0 }),
        completeScope: async (id, payload) => {
            state.completeScope = { id, payload };
        },
        skipScope: async (id, code, message) => {
            state.skipScope = { id, code, message };
        },
        delayScope: async (id, code, message) => {
            state.delayScope = { id, code, message };
        },
        ...overrides,
    };

    for (const [name, implementation] of Object.entries(implementations)) {
        originals[name] = manuscriptRepository[name];
        manuscriptRepository[name] = implementation;
    }

    return {
        state,
        restore() {
            for (const [name, original] of Object.entries(originals)) {
                manuscriptRepository[name] = original;
            }
        },
    };
}

describe('Scope worker', () => {
    test('completes a scope check and records token usage', async () => {
        const mocks = mockRepository();
        const handler = captureHandler();

        try {
            await handler(job());

            assert.ok(mocks.state.completeScope);
            assert.equal(mocks.state.completeScope.id, 'ms-1');
            assert.ok(['high', 'medium', 'low'].includes(
                mocks.state.completeScope.payload.output.fit_level
            ));
            assert.ok(mocks.state.completeScope.payload.tokensIn > 0);
            assert.ok(mocks.state.completeScope.payload.tokensOut > 0);
            assert.equal(mocks.state.skipScope, null);
            assert.equal(mocks.state.delayScope, null);
        } finally {
            mocks.restore();
        }
    });

    test('skips when the manuscript has no abstract', async () => {
        const mocks = mockRepository({
            getScopeContext: async () => context({ abstract_text: '' }),
        });
        const handler = captureHandler();

        try {
            await handler(job());

            assert.ok(mocks.state.skipScope);
            assert.equal(mocks.state.skipScope.code, 'NO_ABSTRACT');
            assert.equal(mocks.state.completeScope, null);
        } finally {
            mocks.restore();
        }
    });

    test('skips when the tenant quota is exhausted', async () => {
        const mocks = mockRepository({
            getScopeContext: async () => context({ ai_monthly_token_quota: 100 }),
            getTenantAiUsageThisMonth: async () => ({ tokens_in: 80, tokens_out: 20 }),
        });
        const handler = captureHandler();

        try {
            await handler(job());

            assert.ok(mocks.state.skipScope);
            assert.equal(mocks.state.skipScope.code, 'QUOTA_EXCEEDED');
            assert.equal(mocks.state.completeScope, null);
        } finally {
            mocks.restore();
        }
    });

    test('is idempotent when the scope check is already completed', async () => {
        const mocks = mockRepository({
            getScopeCheck: async () => ({ status: 'completed' }),
        });
        const handler = captureHandler();

        try {
            await handler(job());

            assert.equal(mocks.state.markScopeRunning, 0);
            assert.equal(mocks.state.completeScope, null);
        } finally {
            mocks.restore();
        }
    });

    test('throws a transient error so pg-boss retries', async () => {
        const mocks = mockRepository({
            getScopeContext: async () => {
                throw Object.assign(new Error('provider unavailable'), { code: 'AI_ERROR' });
            },
        });
        const handler = captureHandler();

        try {
            await assert.rejects(() => handler(job({ retryCount: 0, retryLimit: 3 })));
            assert.equal(mocks.state.delayScope, null);
        } finally {
            mocks.restore();
        }
    });

    test('marks scope delayed on the final retry attempt', async () => {
        const mocks = mockRepository({
            getScopeContext: async () => {
                throw Object.assign(new Error('provider unavailable'), { code: 'AI_ERROR' });
            },
        });
        const handler = captureHandler();

        try {
            await handler(job({ retryCount: 3, retryLimit: 3 }));

            assert.ok(mocks.state.delayScope);
            assert.equal(mocks.state.delayScope.code, 'AI_ERROR');
            assert.equal(mocks.state.completeScope, null);
        } finally {
            mocks.restore();
        }
    });
});
