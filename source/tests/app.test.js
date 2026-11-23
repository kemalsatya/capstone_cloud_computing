import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptService } from '../src/modules/manuscripts/services/manuscript.service.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';
import { createApp } from '../src/app.js';
import { configureAuthForTests } from '../src/common/middlewares/auth.js';

configureAuthForTests({ mode: 'header' });

describe('JournalFit Modular Monolith Tests', () => {
    describe('Multi-Tenant Isolation Security Logic', () => {
        test('should return report when requesting tenant matches manuscript owner', async () => {
            // Mock repository response
            const originalGet = manuscriptRepository.getFullReportByManuscriptId;
            manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
                manuscript: { id, tenant_id: 'tenant-a', title: 'Paper 1' },
                checkResult: { id: 'cr-1', format_score: 90 },
                findings: [],
            });

            try {
                const report = await manuscriptService.getReport('ms-001', 'tenant-a');
                assert.strictEqual(report.manuscript.id, 'ms-001');
                assert.strictEqual(report.manuscript.tenant_id, 'tenant-a');
            } finally {
                manuscriptRepository.getFullReportByManuscriptId = originalGet;
            }
        });

        test('should throw 404 when requesting tenant is different (Negative Test)', async () => {
            const originalGet = manuscriptRepository.getFullReportByManuscriptId;
            manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
                manuscript: { id, tenant_id: 'tenant-a', author_id: 'user-a-01', title: 'Paper 1' },
                checkResult: { id: 'cr-1', format_score: 90 },
                findings: [],
            });

            try {
                await assert.rejects(
                    async () => {
                        await manuscriptService.getReport('ms-001', {
                            tenantId: 'tenant-b',
                            roles: ['author'],
                            user: { id: 'user-b-01' },
                        });
                    },
                    (err) => {
                        assert.strictEqual(err.statusCode, 404);
                        assert.strictEqual(err.code, 'NOT_FOUND');
                        return true;
                    }
                );
            } finally {
                manuscriptRepository.getFullReportByManuscriptId = originalGet;
            }
        });

        test('should throw 404 when an author reads another author manuscript in the same tenant', async () => {
            const originalGet = manuscriptRepository.getFullReportByManuscriptId;
            manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
                manuscript: { id, tenant_id: 'tenant-a', author_id: 'user-a-01', title: 'Paper 1' },
                checkResult: { id: 'cr-1', format_score: 90 },
                findings: [],
            });

            try {
                await assert.rejects(
                    async () => {
                        await manuscriptService.getReport('ms-001', {
                            tenantId: 'tenant-a',
                            roles: ['author'],
                            user: { id: 'user-a-99' },
                        });
                    },
                    (err) => {
                        assert.strictEqual(err.statusCode, 404);
                        assert.strictEqual(err.code, 'NOT_FOUND');
                        return true;
                    }
                );
            } finally {
                manuscriptRepository.getFullReportByManuscriptId = originalGet;
            }
        });

        test('should throw 404 when manuscript does not exist', async () => {
            const originalGet = manuscriptRepository.getFullReportByManuscriptId;
            manuscriptRepository.getFullReportByManuscriptId = async () => null;

            try {
                await assert.rejects(
                    async () => {
                        await manuscriptService.getReport('non-existent', 'tenant-a');
                    },
                    (err) => {
                        assert.strictEqual(err.statusCode, 404);
                        return true;
                    }
                );
            } finally {
                manuscriptRepository.getFullReportByManuscriptId = originalGet;
            }
        });
    });

    describe('Endpoints HTTP Integration (Header Mode)', async () => {
        const app = createApp();
        const server = app.listen(0); // bind to random free port
        const port = server.address().port;
        const baseUrl = `http://localhost:${port}`;

        test('GET /health/live returns 200 alive', async () => {
            const res = await fetch(`${baseUrl}/health/live`);
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.status, 'alive');
        });

        test('GET /api/auth/me returns the tenant from the header in header mode', async () => {
            const res = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { 'X-Tenant-ID': 'tenant-a' },
            });
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.tenant_id, 'tenant-a');
            assert.strictEqual(data.role, 'author');
            assert.deepStrictEqual(data.roles, ['author']);
        });

        test('GET /api/manuscripts/ms-001/report without X-Tenant-ID header returns 400', async () => {
            const res = await fetch(`${baseUrl}/api/manuscripts/ms-001/report`);
            const data = await res.json();

            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
        });

        test('GET /metrics returns Prometheus text metrics', async () => {
            const res = await fetch(`${baseUrl}/metrics`);
            const body = await res.text();

            assert.strictEqual(res.status, 200);
            assert.match(res.headers.get('content-type') || '', /text\/plain/);
            assert.match(body, /http_requests_total/);
            assert.match(body, /http_request_duration_seconds_bucket/);
            assert.match(body, /journalfit_process_uptime_seconds/);
        });

        // Close server after tests
        test('teardown server', () => {
            server.close();
        });
    });
});
