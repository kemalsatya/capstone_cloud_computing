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

const MANUSCRIPT_STATUSES = new Set(['queued', 'processing', 'completed', 'failed']);

function notFound(manuscriptId) {
    return new AppError(
        `Manuscript with ID '${manuscriptId}' not found`,
        404,
        null,
        'NOT_FOUND'
    );
}

function isAuthorOnly(auth) {
    const roles = auth?.roles || [];
    return roles.length > 0 && roles.every((role) => role === 'author');
}

function authorIdentity(auth) {
    return auth?.user?.id || auth?.sub || null;
}

function assertManuscriptAccess(manuscript, auth) {
    if (!manuscript) {
        throw notFound(manuscript?.id || '(unknown)');
    }

    if (manuscript.tenant_id !== auth?.tenantId) {
        throw notFound(manuscript.id);
    }

    if (isAuthorOnly(auth)) {
        const userId = authorIdentity(auth);
        if (userId && manuscript.author_id !== userId) {
            throw notFound(manuscript.id);
        }
    }
}

function toIso(value) {
    if (value instanceof Date) return value.toISOString();
    return value ?? null;
}

function parseDate(value, name) {
    if (value === undefined || value === null || value === '') return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new AppError(
            `Parameter '${name}' tidak valid.`,
            400,
            null,
            'INVALID_QUERY'
        );
    }

    return date;
}

function decodeCursor(raw) {
    try {
        const payload = JSON.parse(Buffer.from(String(raw), 'base64url').toString('utf8'));
        const createdAt = new Date(payload?.created_at);

        if (!payload?.id || typeof payload.id !== 'string' || Number.isNaN(createdAt.getTime())) {
            throw new Error('Malformed cursor.');
        }

        return { createdAt, id: payload.id };
    } catch {
        throw new AppError('Parameter cursor tidak valid.', 400, null, 'INVALID_CURSOR');
    }
}

function encodeCursor(item) {
    return Buffer.from(
        JSON.stringify({ created_at: toIso(item.created_at), id: item.id }),
        'utf8'
    ).toString('base64url');
}

function parseListQuery(query = {}) {
    const parsed = {
        status: null,
        from: null,
        to: null,
        authorId: null,
        limit: 20,
        cursor: null,
    };

    if (query.status !== undefined && query.status !== '') {
        if (!MANUSCRIPT_STATUSES.has(query.status)) {
            throw new AppError(
                "Parameter 'status' tidak valid.",
                400,
                null,
                'INVALID_QUERY'
            );
        }
        parsed.status = query.status;
    }

    parsed.from = parseDate(query.from, 'from');
    parsed.to = parseDate(query.to, 'to');

    if (parsed.from && parsed.to && parsed.from > parsed.to) {
        throw new AppError(
            "Parameter 'from' tidak boleh melebihi 'to'.",
            400,
            null,
            'INVALID_QUERY'
        );
    }

    if (query.limit !== undefined && query.limit !== '') {
        const limit = Number(query.limit);
        if (!Number.isInteger(limit) || limit < 1) {
            throw new AppError(
                "Parameter 'limit' harus berupa bilangan bulat positif.",
                400,
                null,
                'INVALID_QUERY'
            );
        }
        parsed.limit = Math.min(limit, 100);
    }

    if (query.author_id !== undefined && query.author_id !== '') {
        parsed.authorId = String(query.author_id);
    }

    if (query.cursor) {
        parsed.cursor = decodeCursor(query.cursor);
    }

    return parsed;
}

function mapListItem(row) {
    return {
        id: row.id,
        revision_no: row.revision_no,
        title: row.title,
        status: row.status,
        author_id: row.author_id,
        created_at: toIso(row.created_at),
        original_filename: row.original_filename ?? null,
        size_bytes: row.size_bytes ?? null,
        format: {
            status: row.format_status || 'queued',
            outcome: row.format_outcome || null,
        },
        scope: {
            status: row.scope_status || 'queued',
            outcome: row.scope_outcome || null,
        },
    };
}

function mapHistoryItem(row) {
    return {
        id: row.id,
        revision_no: row.revision_no,
        parent_manuscript_id: row.parent_manuscript_id ?? null,
        title: row.title,
        status: row.status,
        author_id: row.author_id,
        created_at: toIso(row.created_at),
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
            throw notFound(manuscriptId);
        }

        assertManuscriptAccess(fullReport.manuscript, auth);

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

    async listManuscripts(query, auth) {
        if (!auth?.tenantId) {
            throw new AppError(
                'Access token is missing the tenant_id claim.',
                403,
                null,
                'TENANT_CLAIM_MISSING'
            );
        }

        const parsed = parseListQuery(query);

        let authorId = parsed.authorId;
        if (isAuthorOnly(auth)) {
            const userId = authorIdentity(auth);
            if (!userId) {
                throw new AppError(
                    'Author identity is required to list manuscripts.',
                    403,
                    null,
                    'FORBIDDEN'
                );
            }
            authorId = userId;
        }

        const { items, hasMore } = await manuscriptRepository.listManuscripts({
            tenantId: auth.tenantId,
            authorId,
            status: parsed.status,
            from: parsed.from,
            to: parsed.to,
            limit: parsed.limit,
            cursor: parsed.cursor,
        });

        const mapped = items.map(mapListItem);
        const nextCursor = hasMore && mapped.length > 0
            ? encodeCursor(mapped[mapped.length - 1])
            : null;

        return {
            items: mapped,
            next_cursor: nextCursor,
        };
    },

    async getDetail(manuscriptId, auth) {
        const fullReport = await manuscriptRepository.getFullReportByManuscriptId(manuscriptId);
        if (!fullReport?.manuscript) {
            throw notFound(manuscriptId);
        }

        assertManuscriptAccess(fullReport.manuscript, auth);

        const manuscript = fullReport.manuscript;
        const format = fullReport.format;
        const scope = fullReport.scope;

        return {
            manuscript: {
                id: manuscript.id,
                tenant_id: manuscript.tenant_id,
                author_id: manuscript.author_id,
                revision_no: manuscript.revision_no,
                title: manuscript.title,
                status: manuscript.status,
                created_at: toIso(manuscript.created_at),
            },
            rule: fullReport.rule,
            format: {
                status: format?.status || 'queued',
                outcome: format?.outcome || null,
                counts: format?.summary?.counts || { error: 0, warning: 0, info: 0 },
            },
            scope: {
                status: scope?.status || 'queued',
                fit_level: scope?.outcome || null,
            },
            generated_at: new Date().toISOString(),
        };
    },

    async getHistory(manuscriptId, auth) {
        const manuscript = await manuscriptRepository.findManuscriptById(manuscriptId);
        if (!manuscript) {
            throw notFound(manuscriptId);
        }

        assertManuscriptAccess(manuscript, auth);

        let rows = await manuscriptRepository.getRevisionChain({
            manuscriptId,
            tenantId: auth.tenantId,
        });

        if (!rows.length) {
            rows = [manuscript];
        }

        return {
            items: rows.map(mapHistoryItem),
        };
    },
};
