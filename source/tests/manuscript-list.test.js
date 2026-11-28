import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptService } from '../src/modules/manuscripts/services/manuscript.service.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';
import { createApp } from '../src/app.js';
import { configureAuthForTests } from '../src/common/middlewares/auth.js';

const manuscript = {
    id: 'ms-001',
    tenant_id: 'tenant-a',
    author_id: 'user-a-01',
    revision_no: 1,
    parent_manuscript_id: null,
    title: 'Cloud Native Performance Study',
    status: 'completed',
    created_at: '2026-01-01T00:00:00.000Z',
};

const listRow = {
    ...manuscript,
    original_filename: 'paper.docx',
    size_bytes: 100,
    format_status: 'completed',
    format_outcome: 'passed',
    scope_status: 'queued',
    scope_outcome: null,
};

function stubRepository(overrides = {}) {
    const originals = {};

    for (const [name, implementation] of Object.entries(overrides)) {
        originals[name] = manuscriptRepository[name];
        manuscriptRepository[name] = implementation;
    }

    return () => {
        for (const [name, original] of Object.entries(originals)) {
            manuscriptRepository[name] = original;
        }
    };
}

function authorAuth(overrides = {}) {
    return {
        tenantId: 'tenant-a',
        roles: ['author'],
        user: { id: 'user-a-01' },
        sub: 'user-a-01',
        ...overrides,
    };
}

function editorAuth(overrides = {}) {
    return {
        tenantId: 'tenant-a',
        roles: ['editor'],
        user: { id: 'user-a-editor' },
        sub: 'user-a-editor',
        ...overrides,
    };
}

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

describe('Manuscript list/detail/history service', () => {
    test('author list forces author_id from the token', async () => {
        let received = null;
        const restore = stubRepository({
            listManuscripts: async (args) => {
                received = args;
                return { items: [], hasMore: false };
            },
        });

        try {
            const result = await manuscriptService.listManuscripts(
                { author_id: 'user-a-99' },
                authorAuth()
            );

            assert.equal(received.authorId, 'user-a-01');
            assert.equal(received.tenantId, 'tenant-a');
            assert.deepEqual(result, { items: [], next_cursor: null });
        } finally {
            restore();
        }
    });

    test('editor list honors the author_id filter', async () => {
        let received = null;
        const restore = stubRepository({
            listManuscripts: async (args) => {
                received = args;
                return { items: [], hasMore: false };
            },
        });

        try {
            await manuscriptService.listManuscripts(
                { author_id: 'user-a-02', status: 'completed', limit: '500' },
                editorAuth()
            );

            assert.equal(received.authorId, 'user-a-02');
            assert.equal(received.status, 'completed');
            assert.equal(received.limit, 100);
        } finally {
            restore();
        }
    });

    test('author list without an identity is forbidden', async () => {
        await assert.rejects(
            () => manuscriptService.listManuscripts(
                {},
                { tenantId: 'tenant-a', roles: ['author'], user: null, sub: null }
            ),
            (err) => err.statusCode === 403 && err.code === 'FORBIDDEN'
        );
    });

    test('rejects an unknown status and a malformed cursor', async () => {
        await assert.rejects(
            () => manuscriptService.listManuscripts({ status: 'bogus' }, authorAuth()),
            (err) => err.statusCode === 400 && err.code === 'INVALID_QUERY'
        );

        await assert.rejects(
            () => manuscriptService.listManuscripts({ cursor: 'not-a-cursor' }, authorAuth()),
            (err) => err.statusCode === 400 && err.code === 'INVALID_CURSOR'
        );
    });

    test('returns a next_cursor when more rows exist', async () => {
        const restore = stubRepository({
            listManuscripts: async () => ({ items: [listRow], hasMore: true }),
        });

        try {
            const result = await manuscriptService.listManuscripts({}, authorAuth());
            assert.equal(result.items.length, 1);
            assert.equal(result.items[0].format.status, 'completed');
            assert.ok(result.next_cursor);

            const payload = JSON.parse(
                Buffer.from(result.next_cursor, 'base64url').toString('utf8')
            );
            assert.equal(payload.id, 'ms-001');
            assert.equal(payload.created_at, '2026-01-01T00:00:00.000Z');
        } finally {
            restore();
        }
    });

    test('detail returns 404 for another tenant or another author', async () => {
        const restore = stubRepository({
            getFullReportByManuscriptId: async (id) => ({
                manuscript: { ...manuscript, id },
                format: { status: 'completed', outcome: 'passed', summary: { counts: { error: 0, warning: 0, info: 0 } } },
                scope: { status: 'queued', summary: {} },
                findings: [],
                rule: { template_id: 'tpl-a-v1', version: 1 },
            }),
        });

        try {
            await assert.rejects(
                () => manuscriptService.getDetail('ms-001', authorAuth({ tenantId: 'tenant-b' })),
                (err) => err.statusCode === 404 && err.code === 'NOT_FOUND'
            );

            await assert.rejects(
                () => manuscriptService.getDetail('ms-001', authorAuth({ user: { id: 'user-a-99' }, sub: 'user-a-99' })),
                (err) => err.statusCode === 404 && err.code === 'NOT_FOUND'
            );
        } finally {
            restore();
        }
    });

    test('detail returns metadata and separate check statuses', async () => {
        const restore = stubRepository({
            getFullReportByManuscriptId: async (id) => ({
                manuscript: { ...manuscript, id },
                format: { status: 'completed', outcome: 'passed', summary: { counts: { error: 0, warning: 1, info: 0 } } },
                scope: { status: 'queued', summary: {} },
                findings: [],
                rule: { template_id: 'tpl-a-v1', version: 2 },
            }),
        });

        try {
            const detail = await manuscriptService.getDetail('ms-001', editorAuth());
            assert.equal(detail.manuscript.id, 'ms-001');
            assert.equal(detail.format.status, 'completed');
            assert.equal(detail.format.counts.warning, 1);
            assert.equal(detail.scope.status, 'queued');
            assert.deepEqual(detail.rule, { template_id: 'tpl-a-v1', version: 2 });
        } finally {
            restore();
        }
    });

    test('history maps the revision chain and enforces access', async () => {
        const restore = stubRepository({
            findManuscriptById: async (id) => ({ ...manuscript, id }),
            getRevisionChain: async () => [
                { ...manuscript, revision_no: 1, parent_manuscript_id: null },
                { ...manuscript, id: 'ms-002', revision_no: 2, parent_manuscript_id: 'ms-001' },
            ],
        });

        try {
            const history = await manuscriptService.getHistory('ms-001', authorAuth());
            assert.equal(history.items.length, 2);
            assert.equal(history.items[1].revision_no, 2);
            assert.equal(history.items[1].parent_manuscript_id, 'ms-001');

            await assert.rejects(
                () => manuscriptService.getHistory('ms-001', authorAuth({ user: { id: 'user-a-99' }, sub: 'user-a-99' })),
                (err) => err.statusCode === 404
            );
        } finally {
            restore();
        }
    });
});

describe('Manuscript list/detail/history HTTP', () => {
    let server;
    let baseUrl;
    let restoreRepository;

    before(async () => {
        configureAuthForTests({ mode: 'mock' });
        restoreRepository = stubRepository({
            listManuscripts: async () => ({ items: [listRow], hasMore: false }),
            getFullReportByManuscriptId: async (id) => ({
                manuscript: { ...manuscript, id },
                format: { status: 'completed', outcome: 'passed', summary: { counts: { error: 0, warning: 0, info: 0 } } },
                scope: { status: 'queued', summary: {} },
                findings: [],
                rule: { template_id: 'tpl-a-v1', version: 1 },
            }),
            findManuscriptById: async (id) => ({ ...manuscript, id }),
            getRevisionChain: async () => [manuscript],
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

    async function request(path, { token, headers = {} } = {}) {
        const requestHeaders = { ...headers };
        if (token) requestHeaders.Authorization = `Bearer ${token}`;
        return fetch(`${baseUrl}${path}`, { headers: requestHeaders });
    }

    test('GET /api/manuscripts requires a token', async () => {
        const response = await request('/api/manuscripts');
        const body = await response.json();

        assert.equal(response.status, 401);
        assert.equal(body.error.code, 'UNAUTHENTICATED');
    });

    test('GET /api/manuscripts returns the author list', async () => {
        const response = await request('/api/manuscripts', {
            token: mockToken({ tenant: 'tenant-a', roles: ['author'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.items.length, 1);
        assert.equal(body.data.items[0].id, 'ms-001');
        assert.equal(body.data.next_cursor, null);
    });

    test('GET /api/manuscripts rejects an invalid status', async () => {
        const response = await request('/api/manuscripts?status=bogus', {
            token: mockToken({ tenant: 'tenant-a', roles: ['author'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.error.code, 'INVALID_QUERY');
    });

    test('GET /api/manuscripts/:id returns 404 across tenants', async () => {
        const response = await request('/api/manuscripts/ms-001', {
            token: mockToken({ sub: 'user-b-01', tenant: 'tenant-b', roles: ['author'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 404);
        assert.equal(body.error.code, 'NOT_FOUND');
    });

    test('GET /api/manuscripts/:id/history returns the chain', async () => {
        const response = await request('/api/manuscripts/ms-001/history', {
            token: mockToken({ tenant: 'tenant-a', roles: ['editor'] }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.items.length, 1);
        assert.equal(body.data.items[0].revision_no, 1);
    });
});
