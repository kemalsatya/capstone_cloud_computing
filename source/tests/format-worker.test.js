import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { registerFormatWorker } from '../src/modules/workers/format.worker.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';
import { storage } from '../src/modules/storage/index.js';
import { DEFAULT_RULES } from '../src/modules/rules/defaults.js';
import { buildDocx } from './fixtures/docx-builder.js';

function captureHandler() {
    let handler = null;
    const boss = {
        work(queue, options, fn) {
            handler = fn;
            return 'worker-1';
        },
    };

    registerFormatWorker(boss);
    return handler;
}

function job(overrides = {}) {
    return [{
        id: 'job-1',
        data: { manuscriptId: 'ms-1', tenantId: 'tenant-a' },
        retryCount: 0,
        retryLimit: 2,
        ...overrides,
    }];
}

function mockRepository(overrides = {}) {
    const originals = {};
    const state = {
        completeFormat: null,
        failFormat: null,
        markFormatRunning: 0,
    };

    const implementations = {
        getFormatCheck: async () => ({ status: 'queued' }),
        markFormatRunning: async () => {
            state.markFormatRunning += 1;
            return true;
        },
        findManuscriptById: async () => ({
            id: 'ms-1',
            tenant_id: 'tenant-a',
            object_key: 'tenants/tenant-a/manuscripts/ms-1.docx',
            rule_template_id: 'tpl-a-v1',
            created_at: new Date().toISOString(),
        }),
        getRuleTemplateById: async () => ({ id: 'tpl-a-v1', version: 1, rules: DEFAULT_RULES }),
        completeFormat: async (id, payload) => {
            state.completeFormat = { id, payload };
        },
        failFormat: async (id, code, message) => {
            state.failFormat = { id, code, message };
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

describe('Format worker', () => {
    test('completes a valid DOCX with passing format results', async () => {
        const buffer = await buildDocx();
        const originalGet = storage.get;
        storage.get = async () => buffer;
        const mocks = mockRepository();
        const handler = captureHandler();

        try {
            await handler(job());

            assert.ok(mocks.state.completeFormat);
            assert.equal(mocks.state.completeFormat.id, 'ms-1');
            assert.equal(mocks.state.completeFormat.payload.outcome, 'passed');
            assert.equal(mocks.state.completeFormat.payload.counts.error, 0);
            assert.equal(mocks.state.completeFormat.payload.document.abstract.wordCount, 120);
            assert.equal(mocks.state.completeFormat.payload.tenantId, 'tenant-a');
            assert.equal(mocks.state.failFormat, null);
        } finally {
            storage.get = originalGet;
            mocks.restore();
        }
    });

    test('marks a corrupt DOCX as failed without crashing', async () => {
        const originalGet = storage.get;
        storage.get = async () => Buffer.from('not a zip file');
        const mocks = mockRepository();
        const handler = captureHandler();

        try {
            await handler(job());

            assert.ok(mocks.state.failFormat);
            assert.equal(mocks.state.failFormat.code, 'INVALID_FILE');
            assert.equal(mocks.state.completeFormat, null);
        } finally {
            storage.get = originalGet;
            mocks.restore();
        }
    });

    test('is idempotent when the format check is already completed', async () => {
        const mocks = mockRepository({
            getFormatCheck: async () => ({ status: 'completed' }),
        });
        const handler = captureHandler();

        try {
            await handler(job());

            assert.equal(mocks.state.markFormatRunning, 0);
            assert.equal(mocks.state.completeFormat, null);
            assert.equal(mocks.state.failFormat, null);
        } finally {
            mocks.restore();
        }
    });

    test('throws a transient error so pg-boss retries', async () => {
        const originalGet = storage.get;
        storage.get = async () => {
            throw new Error('transient storage failure');
        };
        const mocks = mockRepository();
        const handler = captureHandler();

        try {
            await assert.rejects(() => handler(job({ retryCount: 0, retryLimit: 2 })));
            assert.equal(mocks.state.failFormat, null);
            assert.equal(mocks.state.markFormatRunning, 1);
        } finally {
            storage.get = originalGet;
            mocks.restore();
        }
    });

    test('marks the check failed on the final retry attempt', async () => {
        const originalGet = storage.get;
        storage.get = async () => {
            throw new Error('transient storage failure');
        };
        const mocks = mockRepository();
        const handler = captureHandler();

        try {
            await handler(job({ retryCount: 2, retryLimit: 2 }));

            assert.ok(mocks.state.failFormat);
            assert.equal(mocks.state.failFormat.code, 'FORMAT_CHECK_FAILED');
            assert.match(mocks.state.failFormat.message, /transient storage failure/);
        } finally {
            storage.get = originalGet;
            mocks.restore();
        }
    });
});
