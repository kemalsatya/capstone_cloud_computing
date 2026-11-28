import { query, withTransaction } from '../../../config/database.js';
import { AppError } from '../../../common/middlewares/errorHandler.js';

function json(value) {
    return value === undefined || value === null ? null : JSON.stringify(value);
}

export const tenantRepository = {
    async getTenant(tenantId) {
        const result = await query(
            `SELECT id, name, aim_scope, ai_monthly_token_quota, updated_at
             FROM tenants
             WHERE id = $1`,
            [tenantId]
        );
        return result.rows[0] || null;
    },

    async updateAimScope(tenantId, aimScope) {
        const result = await query(
            `UPDATE tenants
             SET aim_scope = $2, updated_at = now()
             WHERE id = $1
             RETURNING id, aim_scope, updated_at`,
            [tenantId, aimScope]
        );
        return result.rows[0] || null;
    },

    async createRuleTemplate({
        id,
        tenantId,
        templateName,
        objectKey,
        sha256,
        generatedRules,
        createdBy,
        originalFilename,
        sizeBytes,
    }) {
        return withTransaction(async (client) => {
            await client.query('SELECT id FROM tenants WHERE id = $1 FOR UPDATE', [tenantId]);

            const versionResult = await client.query(
                `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
                 FROM format_rule_templates
                 WHERE tenant_id = $1`,
                [tenantId]
            );

            const version = versionResult.rows[0].next_version;

            const result = await client.query(
                `INSERT INTO format_rule_templates (
                    id, tenant_id, template_name, version, status,
                    template_object_key, template_sha256, generated_rules, rules,
                    created_by, template_original_filename, template_size_bytes,
                    created_at, updated_at
                 ) VALUES (
                    $1, $2, $3, $4, 'draft',
                    $5, $6, $7::jsonb, NULL,
                    $8, $9, $10,
                    now(), now()
                 )
                 RETURNING *`,
                [
                    id,
                    tenantId,
                    templateName,
                    version,
                    objectKey,
                    sha256,
                    json(generatedRules),
                    createdBy || null,
                    originalFilename,
                    sizeBytes,
                ]
            );

            return result.rows[0];
        });
    },

    async listRuleTemplates(tenantId) {
        const result = await query(
            `SELECT id, tenant_id, version, status, template_name,
                    template_original_filename, template_size_bytes,
                    created_at, activated_at, archived_at
             FROM format_rule_templates
             WHERE tenant_id = $1
             ORDER BY version DESC`,
            [tenantId]
        );
        return result.rows;
    },

    async getRuleTemplateById({ id, tenantId }) {
        const result = await query(
            `SELECT * FROM format_rule_templates
             WHERE id = $1 AND tenant_id = $2`,
            [id, tenantId]
        );
        return result.rows[0] || null;
    },

    async saveDraftRules({ id, tenantId, rules, reviewedBy }) {
        return withTransaction(async (client) => {
            const existing = await client.query(
                `SELECT status FROM format_rule_templates
                 WHERE id = $1 AND tenant_id = $2
                 FOR UPDATE`,
                [id, tenantId]
            );

            if (!existing.rows[0]) {
                throw new AppError('Rule template not found.', 404, null, 'NOT_FOUND');
            }

            if (existing.rows[0].status !== 'draft') {
                throw new AppError(
                    'Only draft rule templates can be edited.',
                    409,
                    null,
                    'RULE_NOT_DRAFT'
                );
            }

            const result = await client.query(
                `UPDATE format_rule_templates
                 SET rules = $3::jsonb,
                     reviewed_by = $4,
                     updated_at = now()
                 WHERE id = $1 AND tenant_id = $2
                 RETURNING *`,
                [id, tenantId, json(rules), reviewedBy || null]
            );

            return result.rows[0];
        });
    },

    async activateDraft({ id, tenantId, activatedBy }) {
        try {
            return await withTransaction(async (client) => {
                const draft = await client.query(
                    `SELECT status, rules FROM format_rule_templates
                     WHERE id = $1 AND tenant_id = $2
                     FOR UPDATE`,
                    [id, tenantId]
                );

                if (!draft.rows[0]) {
                    throw new AppError('Rule template not found.', 404, null, 'NOT_FOUND');
                }

                if (draft.rows[0].status !== 'draft') {
                    throw new AppError(
                        'Only draft rule templates can be activated.',
                        409,
                        null,
                        'RULE_NOT_DRAFT'
                    );
                }

                if (!draft.rows[0].rules) {
                    throw new AppError(
                        'Rule template has no reviewed rules.',
                        422,
                        null,
                        'RULE_INVALID'
                    );
                }

                await client.query(
                    `UPDATE format_rule_templates
                     SET status = 'archived',
                         archived_at = now(),
                         updated_at = now()
                     WHERE tenant_id = $1 AND status = 'active'`,
                    [tenantId]
                );

                const result = await client.query(
                    `UPDATE format_rule_templates
                     SET status = 'active',
                         activated_by = $3,
                         activated_at = now(),
                         updated_at = now()
                     WHERE id = $1 AND tenant_id = $2
                     RETURNING *`,
                    [id, tenantId, activatedBy || null]
                );

                return result.rows[0];
            });
        } catch (err) {
            if (err.code === '23505') {
                throw new AppError(
                    'Another rule template was activated concurrently.',
                    409,
                    null,
                    'ACTIVATION_CONFLICT'
                );
            }
            throw err;
        }
    },

    async getSummary({ tenantId, from, to }) {
        const result = await query(
            `SELECT
                COUNT(DISTINCT m.id) AS total_manuscripts,
                COUNT(*) FILTER (WHERE cr.check_type = 'format') AS format_checks,
                COUNT(*) FILTER (WHERE cr.check_type = 'format' AND cr.outcome = 'passed') AS format_passed,
                COUNT(*) FILTER (WHERE cr.check_type = 'format' AND cr.outcome = 'failed') AS format_failed,
                COUNT(*) FILTER (WHERE cr.check_type = 'scope' AND cr.status = 'completed') AS scope_completed,
                COUNT(*) FILTER (WHERE cr.check_type = 'scope' AND cr.status = 'skipped') AS scope_skipped,
                COUNT(*) FILTER (WHERE cr.check_type = 'scope' AND cr.status = 'delayed') AS scope_delayed
             FROM check_results cr
             JOIN manuscripts m ON m.id = cr.manuscript_id AND m.tenant_id = cr.tenant_id
             WHERE cr.tenant_id = $1
               AND cr.created_at >= $2
               AND cr.created_at <= $3`,
            [tenantId, from, to]
        );

        const row = result.rows[0] || {};
        return {
            total_manuscripts: Number(row.total_manuscripts || 0),
            format: {
                checks: Number(row.format_checks || 0),
                passed: Number(row.format_passed || 0),
                failed: Number(row.format_failed || 0),
            },
            scope: {
                completed: Number(row.scope_completed || 0),
                skipped: Number(row.scope_skipped || 0),
                delayed: Number(row.scope_delayed || 0),
            },
        };
    },

    async getAiUsage(tenantId) {
        const result = await query(
            `SELECT
                COALESCE(SUM(tokens_in), 0) AS tokens_in,
                COALESCE(SUM(tokens_out), 0) AS tokens_out,
                COALESCE(SUM(est_cost_usd), 0) AS est_cost_usd
             FROM check_results
             WHERE tenant_id = $1
               AND check_type = 'scope'
               AND finished_at >= date_trunc('month', now())`,
            [tenantId]
        );

        const row = result.rows[0] || {};
        return {
            tokens_in: Number(row.tokens_in || 0),
            tokens_out: Number(row.tokens_out || 0),
            est_cost_usd: Number(row.est_cost_usd || 0),
        };
    },
};
