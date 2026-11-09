import { query } from '../../../config/database.js';

export const manuscriptRepository = {
    async ensureTenantExists(tenantId, name = null) {
        const tenantName = name || `Tenant ${tenantId}`;
        const sql = `
            INSERT INTO tenants (id, name)
            VALUES ($1, $2)
            ON CONFLICT (id) DO NOTHING
            RETURNING *;
        `;
        const res = await query(sql, [tenantId, tenantName]);
        if (res.rows.length > 0) return res.rows[0];

        const existing = await query('SELECT * FROM tenants WHERE id = $1', [tenantId]);
        return existing.rows[0] || null;
    },

    async getRuleTemplate(tenantId) {
        const sql = `
            SELECT * FROM format_rule_templates
            WHERE tenant_id = $1
            LIMIT 1;
        `;
        const res = await query(sql, [tenantId]);
        return res.rows[0] || null;
    },

    async ensureDefaultRuleTemplate(tenantId) {
        const existing = await this.getRuleTemplate(tenantId);
        if (existing) return existing;

        const templateId = `tpl-${tenantId}-default`;
        const sql = `
            INSERT INTO format_rule_templates (id, tenant_id, template_name, min_words, max_words, require_abstract, require_keywords)
            VALUES ($1, $2, $3, 3000, 8000, TRUE, TRUE)
            ON CONFLICT (id) DO UPDATE SET template_name = EXCLUDED.template_name
            RETURNING *;
        `;
        const res = await query(sql, [templateId, tenantId, 'Standard Default Template']);
        return res.rows[0];
    },

    async createManuscript({ id, tenantId, authorId = null, title, filePath }) {
        const sql = `
            INSERT INTO manuscripts (id, tenant_id, author_id, title, file_path)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const res = await query(sql, [id, tenantId, authorId, title, filePath]);
        return res.rows[0];
    },

    async createCheckResult({ id, manuscriptId, status, formatScore }) {
        const sql = `
            INSERT INTO check_results (id, manuscript_id, status, format_score)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const res = await query(sql, [id, manuscriptId, status, formatScore]);
        return res.rows[0];
    },

    async createFindings(findings) {
        if (!findings || findings.length === 0) return [];
        const inserted = [];
        for (const item of findings) {
            const sql = `
                INSERT INTO findings (id, check_result_id, rule_type, severity, message)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const res = await query(sql, [
                item.id,
                item.checkResultId,
                item.ruleType,
                item.severity,
                item.message,
            ]);
            inserted.push(res.rows[0]);
        }
        return inserted;
    },

    async findManuscriptById(id) {
        const sql = `
            SELECT m.*, t.name as tenant_name
            FROM manuscripts m
            LEFT JOIN tenants t ON m.tenant_id = t.id
            WHERE m.id = $1;
        `;
        const res = await query(sql, [id]);
        return res.rows[0] || null;
    },

    async getFullReportByManuscriptId(manuscriptId) {
        const manuscript = await this.findManuscriptById(manuscriptId);
        if (!manuscript) return null;

        const checkRes = await query(
            `SELECT * FROM check_results WHERE manuscript_id = $1 ORDER BY created_at DESC LIMIT 1;`,
            [manuscriptId]
        );
        const checkResult = checkRes.rows[0] || null;

        let findings = [];
        if (checkResult) {
            const findingsRes = await query(
                `SELECT * FROM findings WHERE check_result_id = $1 ORDER BY id ASC;`,
                [checkResult.id]
            );
            findings = findingsRes.rows;
        }

        return {
            manuscript,
            checkResult,
            findings,
        };
    },
};
