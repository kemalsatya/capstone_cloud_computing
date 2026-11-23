import { pgBossDbAdapter, query, withTransaction } from '../../../config/database.js';

function json(value) {
    return value === undefined || value === null ? null : JSON.stringify(value);
}

export const manuscriptRepository = {
    async getActiveRuleTemplate(tenantId) {
        const result = await query(
            `SELECT * FROM format_rule_templates
             WHERE tenant_id = $1 AND status = 'active'
             ORDER BY version DESC
             LIMIT 1`,
            [tenantId]
        );
        return result.rows[0] || null;
    },

    async getRuleTemplateById(id) {
        if (!id) return null;
        const result = await query('SELECT * FROM format_rule_templates WHERE id = $1', [id]);
        return result.rows[0] || null;
    },

    async findManuscriptById(id) {
        const result = await query(
            `SELECT m.*, t.name AS tenant_name
             FROM manuscripts m
             LEFT JOIN tenants t ON m.tenant_id = t.id
             WHERE m.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    },

    async findParentManuscript({ id, tenantId, authorId }) {
        const result = await query(
            `SELECT * FROM manuscripts
             WHERE id = $1 AND tenant_id = $2 AND author_id = $3`,
            [id, tenantId, authorId]
        );
        return result.rows[0] || null;
    },

    async getFormatCheck(manuscriptId) {
        const result = await query(
            `SELECT * FROM check_results
             WHERE manuscript_id = $1 AND check_type = 'format'`,
            [manuscriptId]
        );
        return result.rows[0] || null;
    },

    async createSubmissionTx({
        manuscript,
        formatCheck,
        scopeCheck,
        enqueue,
    }) {
        return withTransaction(async (client) => {
            await client.query(
                `INSERT INTO manuscripts (
                    id, tenant_id, author_id, rule_template_id, parent_manuscript_id,
                    revision_no, title, file_path, object_key, original_filename,
                    size_bytes, sha256, status
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                [
                    manuscript.id,
                    manuscript.tenantId,
                    manuscript.authorId,
                    manuscript.ruleTemplateId,
                    manuscript.parentManuscriptId || null,
                    manuscript.revisionNo,
                    manuscript.title,
                    manuscript.objectKey,
                    manuscript.objectKey,
                    manuscript.originalFilename,
                    manuscript.sizeBytes,
                    manuscript.sha256,
                    'queued',
                ]
            );

            await client.query(
                `INSERT INTO check_results (
                    id, manuscript_id, tenant_id, check_type, status,
                    rule_template_id, rule_version, summary, attempt_count
                 ) VALUES ($1,$2,$3,'format','queued',$4,$5,$6::jsonb,0)`,
                [
                    formatCheck.id,
                    manuscript.id,
                    manuscript.tenantId,
                    manuscript.ruleTemplateId,
                    manuscript.ruleVersion,
                    json({}),
                ]
            );

            await client.query(
                `INSERT INTO check_results (
                    id, manuscript_id, tenant_id, check_type, status, summary, attempt_count
                 ) VALUES ($1,$2,$3,'scope','queued',$4::jsonb,0)`,
                [scopeCheck.id, manuscript.id, manuscript.tenantId, json({})]
            );

            const jobId = await enqueue(
                manuscript.id,
                manuscript.tenantId,
                pgBossDbAdapter(client)
            );

            return { jobId };
        });
    },

    async markFormatRunning(manuscriptId) {
        return withTransaction(async (client) => {
            const update = await client.query(
                `UPDATE check_results
                 SET status = 'running',
                     started_at = COALESCE(started_at, now()),
                     attempt_count = attempt_count + 1
                 WHERE manuscript_id = $1
                   AND check_type = 'format'
                   AND status <> 'completed'`,
                [manuscriptId]
            );

            if (update.rowCount > 0) {
                await client.query(
                    `UPDATE manuscripts
                     SET status = 'processing', updated_at = now()
                     WHERE id = $1`,
                    [manuscriptId]
                );
            }

            return update.rowCount > 0;
        });
    },

    async completeFormat(manuscriptId, { tenantId, outcome, findings, counts, document, templateVersion }) {
        return withTransaction(async (client) => {
            const checkResult = await client.query(
                `UPDATE check_results
                 SET status = 'completed',
                     outcome = $2,
                     summary = $3::jsonb,
                     format_score = $4,
                     finished_at = now(),
                     error_code = NULL
                 WHERE manuscript_id = $1 AND check_type = 'format'
                 RETURNING id`,
                [
                    manuscriptId,
                    outcome,
                    json({
                        counts,
                        abstract_word_count: document.abstract?.wordCount ?? 0,
                        keyword_count: document.keywords?.count ?? 0,
                        title: document.title?.text || null,
                    }),
                    outcome === 'passed' ? 100 : 0,
                ]
            );

            const checkResultId = checkResult.rows[0]?.id;
            if (!checkResultId) {
                throw new Error('Format check result tidak ditemukan.');
            }

            await client.query('DELETE FROM findings WHERE check_result_id = $1', [checkResultId]);

            let findingIndex = 0;
            for (const finding of findings) {
                findingIndex += 1;
                await client.query(
                    `INSERT INTO findings (
                        id, check_result_id, tenant_id, rule_type, rule_id,
                        severity, message, location, expected, actual
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)`,
                    [
                        `f-${manuscriptId}-${findingIndex}`,
                        checkResultId,
                        tenantId || null,
                        finding.rule_id,
                        finding.rule_id,
                        finding.severity,
                        finding.message,
                        json(finding.location),
                        json(finding.expected),
                        json(finding.actual),
                    ]
                );
            }

            const extractedTitle = document.title?.text
                ? String(document.title.text).slice(0, 255)
                : null;

            await client.query(
                `UPDATE manuscripts
                 SET status = 'completed',
                     title = COALESCE($2, title),
                     abstract_text = $3,
                     keywords = $4,
                     updated_at = now()
                 WHERE id = $1`,
                [
                    manuscriptId,
                    extractedTitle,
                    document.abstract?.text || null,
                    document.keywords?.values?.length ? document.keywords.values : null,
                ]
            );

            return { checkResultId, templateVersion };
        });
    },

    async failFormat(manuscriptId, errorCode, message) {
        return withTransaction(async (client) => {
            await client.query(
                `UPDATE check_results
                 SET status = 'failed',
                     error_code = $2,
                     finished_at = now(),
                     summary = jsonb_set(
                         COALESCE(summary, '{}'::jsonb),
                         '{error_message}',
                         to_jsonb($3::text)
                     )
                 WHERE manuscript_id = $1 AND check_type = 'format'`,
                [manuscriptId, errorCode, message || null]
            );

            await client.query(
                `UPDATE manuscripts
                 SET status = 'failed', updated_at = now()
                 WHERE id = $1`,
                [manuscriptId]
            );
        });
    },

    async getFullReportByManuscriptId(manuscriptId) {
        const manuscript = await this.findManuscriptById(manuscriptId);
        if (!manuscript) return null;

        const formatResult = await query(
            `SELECT * FROM check_results
             WHERE manuscript_id = $1 AND check_type = 'format'`,
            [manuscriptId]
        );
        const scopeResult = await query(
            `SELECT * FROM check_results
             WHERE manuscript_id = $1 AND check_type = 'scope'`,
            [manuscriptId]
        );

        const format = formatResult.rows[0] || null;
        const scope = scopeResult.rows[0] || null;

        let findings = [];
        if (format) {
            const findingsResult = await query(
                `SELECT * FROM findings
                 WHERE check_result_id = $1
                 ORDER BY id ASC`,
                [format.id]
            );
            findings = findingsResult.rows;
        }

        let rule = null;
        if (manuscript.rule_template_id) {
            const template = await this.getRuleTemplateById(manuscript.rule_template_id);
            rule = template
                ? { template_id: template.id, version: template.version }
                : null;
        }

        return {
            manuscript,
            format,
            scope,
            findings,
            rule,
            checkResult: format,
        };
    },
};
