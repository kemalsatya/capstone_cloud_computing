import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { manuscriptService } from '../src/modules/manuscripts/services/manuscript.service.js';
import { manuscriptRepository } from '../src/modules/manuscripts/repositories/manuscript.repository.js';
import { storage } from '../src/modules/storage/index.js';
import { buildDocx } from './fixtures/docx-builder.js';

function fileFrom(buffer, originalname = 'manuscript.docx') {
    return { buffer, originalname, size: buffer.length };
}

describe('Manuscript submission service', () => {
    test('rejects upload when the tenant has no active rule', async () => {
        const original = manuscriptRepository.getActiveRuleTemplate;
        manuscriptRepository.getActiveRuleTemplate = async () => null;

        try {
            await assert.rejects(
                () => manuscriptService.processUpload({
                    tenantId: 'tenant-a',
                    file: fileFrom(Buffer.from('x'), 'x.docx'),
                }),
                (err) => err.statusCode === 409 && err.code === 'NO_ACTIVE_RULE'
            );
        } finally {
            manuscriptRepository.getActiveRuleTemplate = original;
        }
    });

    test('stores the DOCX and creates an atomic queued submission', async () => {
        const originalRule = manuscriptRepository.getActiveRuleTemplate;
        const originalCreate = manuscriptRepository.createSubmissionTx;
        const originalPut = storage.put;
        let stored = null;
        let submission = null;

        manuscriptRepository.getActiveRuleTemplate = async () => ({ id: 'tpl-a-v1', version: 1 });
        manuscriptRepository.createSubmissionTx = async (args) => {
            submission = args;
            return { jobId: 'job-1' };
        };
        storage.put = async (key, buffer) => {
            stored = { key, buffer };
            return key;
        };

        try {
            const buffer = await buildDocx();
            const result = await manuscriptService.processUpload({
                tenantId: 'tenant-a',
                authorId: 'user-a-01',
                file: fileFrom(buffer),
            });

            assert.match(result.manuscript_id, /^ms-/);
            assert.equal(result.revision_no, 1);
            assert.equal(result.status, 'queued');

            assert.equal(stored.key, `tenants/tenant-a/manuscripts/${result.manuscript_id}.docx`);
            assert.equal(stored.buffer.length, buffer.length);

            assert.equal(submission.manuscript.ruleTemplateId, 'tpl-a-v1');
            assert.equal(submission.manuscript.ruleVersion, 1);
            assert.equal(submission.manuscript.revisionNo, 1);
            assert.equal(submission.manuscript.sizeBytes, buffer.length);
            assert.equal(submission.manuscript.sha256.length, 64);
            assert.match(submission.formatCheck.id, /^cr-/);
            assert.match(submission.scopeCheck.id, /^cr-/);
        } finally {
            manuscriptRepository.getActiveRuleTemplate = originalRule;
            manuscriptRepository.createSubmissionTx = originalCreate;
            storage.put = originalPut;
        }
    });

    test('deletes the stored object when the submission transaction fails', async () => {
        const originalRule = manuscriptRepository.getActiveRuleTemplate;
        const originalCreate = manuscriptRepository.createSubmissionTx;
        const originalPut = storage.put;
        const originalDelete = storage.delete;
        let deletedKey = null;

        manuscriptRepository.getActiveRuleTemplate = async () => ({ id: 'tpl-a-v1', version: 1 });
        manuscriptRepository.createSubmissionTx = async () => {
            throw new Error('database unavailable');
        };
        storage.put = async (key) => key;
        storage.delete = async (key) => {
            deletedKey = key;
        };

        try {
            const buffer = await buildDocx();
            await assert.rejects(() => manuscriptService.processUpload({
                tenantId: 'tenant-a',
                authorId: 'user-a-01',
                file: fileFrom(buffer),
            }));

            assert.ok(deletedKey);
            assert.match(deletedKey, /^tenants\/tenant-a\/manuscripts\/ms-/);
        } finally {
            manuscriptRepository.getActiveRuleTemplate = originalRule;
            manuscriptRepository.createSubmissionTx = originalCreate;
            storage.put = originalPut;
            storage.delete = originalDelete;
        }
    });

    test('legacy upload skips strict DOCX validation', async () => {
        const originalRule = manuscriptRepository.getActiveRuleTemplate;
        const originalCreate = manuscriptRepository.createSubmissionTx;
        const originalPut = storage.put;
        let called = false;

        manuscriptRepository.getActiveRuleTemplate = async () => ({ id: 'tpl-a-v1', version: 1 });
        manuscriptRepository.createSubmissionTx = async () => {
            called = true;
            return { jobId: 'job-2' };
        };
        storage.put = async (key) => key;

        try {
            const result = await manuscriptService.processUpload({
                tenantId: 'tenant-a',
                authorId: 'user-a-01',
                file: fileFrom(Buffer.from('not a zip file'), 'legacy.docx'),
                legacy: true,
            });

            assert.equal(result.status, 'queued');
            assert.equal(called, true);
        } finally {
            manuscriptRepository.getActiveRuleTemplate = originalRule;
            manuscriptRepository.createSubmissionTx = originalCreate;
            storage.put = originalPut;
        }
    });

    test('increments revision number for a parent owned by the same author', async () => {
        const originalRule = manuscriptRepository.getActiveRuleTemplate;
        const originalCreate = manuscriptRepository.createSubmissionTx;
        const originalFindParent = manuscriptRepository.findParentManuscript;
        const originalPut = storage.put;
        let submission = null;

        manuscriptRepository.getActiveRuleTemplate = async () => ({ id: 'tpl-a-v1', version: 1 });
        manuscriptRepository.findParentManuscript = async () => ({
            id: 'ms-parent',
            revision_no: 2,
            tenant_id: 'tenant-a',
            author_id: 'user-a-01',
        });
        manuscriptRepository.createSubmissionTx = async (args) => {
            submission = args;
            return { jobId: 'job-3' };
        };
        storage.put = async (key) => key;

        try {
            const result = await manuscriptService.processUpload({
                tenantId: 'tenant-a',
                authorId: 'user-a-01',
                parentManuscriptId: 'ms-parent',
                file: fileFrom(await buildDocx()),
            });

            assert.equal(result.revision_no, 3);
            assert.equal(submission.manuscript.parentManuscriptId, 'ms-parent');
        } finally {
            manuscriptRepository.getActiveRuleTemplate = originalRule;
            manuscriptRepository.createSubmissionTx = originalCreate;
            manuscriptRepository.findParentManuscript = originalFindParent;
            storage.put = originalPut;
        }
    });

    test('maps the report and enforces tenant and author isolation', async () => {
        const original = manuscriptRepository.getFullReportByManuscriptId;
        manuscriptRepository.getFullReportByManuscriptId = async (id) => ({
            manuscript: {
                id,
                tenant_id: 'tenant-a',
                author_id: 'user-a-01',
                revision_no: 1,
                title: 'Paper',
                status: 'completed',
                created_at: '2026-01-01T00:00:00.000Z',
            },
            format: {
                status: 'completed',
                outcome: 'failed',
                summary: { counts: { error: 1, warning: 0, info: 0 } },
            },
            scope: { status: 'queued', summary: {} },
            findings: [{
                rule_id: 'FMT-002',
                severity: 'error',
                message: 'Margin atas tidak sesuai ketentuan.',
                location: { section: 1 },
                expected: { top: 1080 },
                actual: { top: 1081 },
            }],
            rule: { template_id: 'tpl-a-v1', version: 1 },
        });

        try {
            const report = await manuscriptService.getReport('ms-001', {
                tenantId: 'tenant-a',
                roles: ['author'],
                user: { id: 'user-a-01' },
            });

            assert.equal(report.format.counts.error, 1);
            assert.equal(report.format.findings[0].rule_id, 'FMT-002');
            assert.equal(report.scope.status, 'queued');
            assert.match(report.scope.disclaimer, /bukan keputusan penerimaan/);
            assert.deepEqual(report.rule, { template_id: 'tpl-a-v1', version: 1 });

            await assert.rejects(
                () => manuscriptService.getReport('ms-001', {
                    tenantId: 'tenant-b',
                    roles: ['author'],
                    user: { id: 'user-b-01' },
                }),
                (err) => err.statusCode === 404
            );

            await assert.rejects(
                () => manuscriptService.getReport('ms-001', {
                    tenantId: 'tenant-a',
                    roles: ['author'],
                    user: { id: 'user-a-99' },
                }),
                (err) => err.statusCode === 404
            );
        } finally {
            manuscriptRepository.getFullReportByManuscriptId = original;
        }
    });
});
