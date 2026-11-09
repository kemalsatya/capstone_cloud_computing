import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptService } from '../src/modules/manuscripts/services/manuscript.service.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';
import { createApp } from '../src/app.js';

describe('JournalFit Modular Monolith Tests', () => {
    describe('Rule Evaluator Service', () => {
        const dummyTemplate = {
            min_words: 3000,
            max_words: 8000,
            require_abstract: true,
            require_keywords: true,
        };

        test('should flag manuscript if word count is below minimum', () => {
            const shortText = 'This is a short abstract test with keywords.';
            const result = manuscriptService.evaluateRules(shortText, dummyTemplate);

            assert.strictEqual(result.wordCount, 8);
            assert.ok(result.formatScore < 100);
            const wordCountFinding = result.findings.find(f => f.ruleType === 'WORD_COUNT');
            assert.strictEqual(wordCountFinding.severity, 'WARNING');
        });

        test('should evaluate compliant manuscript with abstract and keywords', () => {
            const compliantText = 'Abstract ' + 'word '.repeat(3500) + ' Keywords: cloud computing';
            const result = manuscriptService.evaluateRules(compliantText, dummyTemplate);

            assert.strictEqual(result.formatScore, 100);
            assert.strictEqual(result.findings.every(f => f.severity === 'INFO'), true);
        });

        test('should penalize missing abstract and keywords', () => {
            const noSectionText = 'word '.repeat(3500);
            const result = manuscriptService.evaluateRules(noSectionText, dummyTemplate);

            const abstractFinding = result.findings.find(f => f.ruleType === 'ABSTRACT_CHECK');
            const keywordFinding = result.findings.find(f => f.ruleType === 'KEYWORDS_CHECK');

            assert.strictEqual(abstractFinding.severity, 'WARNING');
            assert.strictEqual(keywordFinding.severity, 'WARNING');
            assert.strictEqual(result.formatScore, 70); // 100 - 15 - 15
        });
    });

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

        test('should throw 403 Forbidden when requesting tenant is different (Negative Test)', async () => {
            const originalGet = manuscriptRepository.getFullReportByManuscriptId;
            manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
                manuscript: { id, tenant_id: 'tenant-a', title: 'Paper 1' },
                checkResult: { id: 'cr-1', format_score: 90 },
                findings: [],
            });

            try {
                await assert.rejects(
                    async () => {
                        await manuscriptService.getReport('ms-001', 'tenant-b');
                    },
                    (err) => {
                        assert.strictEqual(err.statusCode, 403);
                        assert.match(err.message, /Access forbidden: Tenant 'tenant-b'/);
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

    describe('Endpoints HTTP Integration (Mock)', async () => {
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

        test('POST /api/auth/token generates mock token', async () => {
            const res = await fetch(`${baseUrl}/api/auth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'john-doe',
                    role: 'author',
                    tenantId: 'tenant-a',
                }),
            });
            const data = await res.json();

            assert.strictEqual(res.status, 200);
            assert.strictEqual(data.token_type, 'Bearer');
            assert.strictEqual(data.user.role, 'author');
            assert.strictEqual(data.user.tenant_id, 'tenant-a');
        });

        test('GET /api/manuscripts/ms-001/report without X-Tenant-ID header returns 400', async () => {
            const res = await fetch(`${baseUrl}/api/manuscripts/ms-001/report`);
            const data = await res.json();

            assert.strictEqual(res.status, 400);
            assert.strictEqual(data.success, false);
        });

        // Close server after tests
        test('teardown server', () => {
            server.close();
        });
    });
});
