import crypto from 'node:crypto';
import path from 'node:path';
import { AppError } from '../../../common/middlewares/errorHandler.js';
import { validateDocx } from '../../parser/index.js';
import { storage, manuscriptObjectKey } from '../../storage/index.js';
import { queueService } from '../../queue/index.js';
import { manuscriptRepository } from '../repositories/manuscript.repository.js';

function newId(prefix) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function originalFilename(file) {
    return path.basename(String(file?.originalname || 'manuscript.docx')).slice(0, 255);
}

function mapFinding(finding) {
    return {
        rule_id: finding.rule_id || finding.rule_type || null,
        severity: finding.severity,
        message: finding.message,
        location: finding.location || null,
        expected: finding.expected || null,
        actual: finding.actual || null,
    };
}

function mapScope(scope) {
    const summary = scope?.summary || {};

    return {
        status: scope?.status || 'queued',
        fit_level: scope?.outcome || null,
        rationale: summary.rationale || null,
        matched_topics: summary.matched_topics || [],
        suggestions: summary.suggestions || [],
        disclaimer: 'Saran kecocokan topik, bukan keputusan penerimaan naskah.',
    };
}

export const manuscriptService = {
    async processUpload({ tenantId, file, authorId = null, legacy = false, parentManuscriptId = null }) {
        if (!file) {
            throw new AppError('File naskah wajib diunggah.', 400, null, 'INVALID_FILE');
        }

        const activeRule = await manuscriptRepository.getActiveRuleTemplate(tenantId);
        if (!activeRule) {
            throw new AppError(
                'Tenant belum memiliki rule format aktif.',
                409,
                null,
                'NO_ACTIVE_RULE'
            );
        }

        if (!legacy) {
            await validateDocx(file.buffer);
        }

        let parent = null;
        if (parentManuscriptId) {
            parent = await manuscriptRepository.findParentManuscript({
                id: parentManuscriptId,
                tenantId,
                authorId,
            });

            if (!parent) {
                throw new AppError(
                    'Naskah induk tidak ditemukan.',
                    404,
                    null,
                    'NOT_FOUND'
                );
            }
        }

        const manuscriptId = newId('ms');
        const objectKey = manuscriptObjectKey(tenantId, manuscriptId);
        const revisionNo = parent ? parent.revision_no + 1 : 1;
        const filename = originalFilename(file);

        await storage.put(objectKey, file.buffer);

        try {
            await manuscriptRepository.createSubmissionTx({
                manuscript: {
                    id: manuscriptId,
                    tenantId,
                    authorId,
                    ruleTemplateId: activeRule.id,
                    ruleVersion: activeRule.version,
                    parentManuscriptId: parent?.id || null,
                    revisionNo,
                    title: filename,
                    objectKey,
                    originalFilename: filename,
                    sizeBytes: file.size ?? file.buffer.length,
                    sha256: sha256(file.buffer),
                },
                formatCheck: { id: newId('cr') },
                scopeCheck: { id: newId('cr') },
                enqueue: (...args) => queueService.enqueueFormatCheck(...args),
            });
        } catch (err) {
            await storage.delete(objectKey).catch(() => {});
            throw err;
        }

        return {
            manuscript_id: manuscriptId,
            revision_no: revisionNo,
            status: 'queued',
        };
    },

    async getReport(manuscriptId, authOrTenant) {
        const auth = typeof authOrTenant === 'string'
            ? { tenantId: authOrTenant, roles: ['tenant_admin'], user: null }
            : (authOrTenant || {});

        const fullReport = await manuscriptRepository.getFullReportByManuscriptId(manuscriptId);
        if (!fullReport?.manuscript) {
            throw new AppError(
                `Manuscript with ID '${manuscriptId}' not found`,
                404,
                null,
                'NOT_FOUND'
            );
        }

        if (fullReport.manuscript.tenant_id !== auth.tenantId) {
            throw new AppError(
                `Manuscript with ID '${manuscriptId}' not found`,
                404,
                null,
                'NOT_FOUND'
            );
        }

        const roles = auth.roles || [];
        const isAuthorOnly = roles.length > 0 && roles.every((role) => role === 'author');
        const userId = auth.user?.id || null;
        if (isAuthorOnly && userId && fullReport.manuscript.author_id !== userId) {
            throw new AppError(
                `Manuscript with ID '${manuscriptId}' not found`,
                404,
                null,
                'NOT_FOUND'
            );
        }

        const format = fullReport.format;
        const countFromFindings = { error: 0, warning: 0, info: 0 };
        for (const finding of fullReport.findings) {
            if (countFromFindings[finding.severity] !== undefined) {
                countFromFindings[finding.severity] += 1;
            }
        }

        return {
            manuscript: {
                id: fullReport.manuscript.id,
                tenant_id: fullReport.manuscript.tenant_id,
                author_id: fullReport.manuscript.author_id,
                revision_no: fullReport.manuscript.revision_no,
                title: fullReport.manuscript.title,
                status: fullReport.manuscript.status,
                created_at: fullReport.manuscript.created_at,
            },
            rule: fullReport.rule,
            format: {
                status: format?.status || 'queued',
                outcome: format?.outcome || null,
                counts: format?.summary?.counts || countFromFindings,
                findings: fullReport.findings.map(mapFinding),
            },
            scope: mapScope(fullReport.scope),
            generated_at: new Date().toISOString(),
        };
    },
};
