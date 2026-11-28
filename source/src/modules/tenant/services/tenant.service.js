import crypto from 'node:crypto';
import path from 'node:path';
import { AppError } from '../../../common/middlewares/errorHandler.js';
import { suggestRulesFromBuffer } from '../../suggester/index.js';
import { validateRuleConfig } from '../../rules/engine.js';
import { storage, templateObjectKey } from '../../storage/index.js';
import { tenantRepository } from '../repositories/tenant.repository.js';

const AIM_SCOPE_MIN = 50;
const AIM_SCOPE_MAX = 4000;
const DEFAULT_SUMMARY_DAYS = 30;

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function actorId(auth) {
    return auth?.user?.id || auth?.sub || null;
}

function notFound() {
    return new AppError('Tenant not found.', 404, null, 'NOT_FOUND');
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

export const tenantService = {
    async getAimScope(tenantId) {
        const tenant = await tenantRepository.getTenant(tenantId);
        if (!tenant) throw notFound();

        return {
            aim_scope: tenant.aim_scope,
            updated_at: tenant.updated_at,
        };
    },

    async updateAimScope(tenantId, body) {
        const raw = body?.aim_scope;
        if (typeof raw !== 'string') {
            throw new AppError(
                'Field aim_scope wajib berupa teks.',
                422,
                null,
                'INVALID_AIM_SCOPE'
            );
        }

        const aimScope = raw.trim();
        if (aimScope.length < AIM_SCOPE_MIN || aimScope.length > AIM_SCOPE_MAX) {
            throw new AppError(
                `aim_scope harus ${AIM_SCOPE_MIN}–${AIM_SCOPE_MAX} karakter.`,
                422,
                null,
                'INVALID_AIM_SCOPE'
            );
        }

        const updated = await tenantRepository.updateAimScope(tenantId, aimScope);
        if (!updated) throw notFound();

        return {
            aim_scope: updated.aim_scope,
            updated_at: updated.updated_at,
        };
    },

    async createRuleTemplate({ tenantId, file, auth }) {
        if (!file?.buffer) {
            throw new AppError('File template wajib diunggah.', 400, null, 'INVALID_FILE');
        }

        const { generatedRules } = await suggestRulesFromBuffer(file.buffer);

        const templateId = `tpl-${crypto.randomUUID()}`;
        const objectKey = templateObjectKey(tenantId, templateId);
        const originalFilename = path.basename(String(file.originalname || 'template.docx')).slice(0, 255);
        const templateName = originalFilename.slice(0, 100) || 'Template';

        await storage.put(objectKey, file.buffer);

        try {
            const row = await tenantRepository.createRuleTemplate({
                id: templateId,
                tenantId,
                templateName,
                objectKey,
                sha256: sha256(file.buffer),
                generatedRules,
                createdBy: actorId(auth),
                originalFilename,
                sizeBytes: file.size ?? file.buffer.length,
            });

            return {
                id: row.id,
                version: row.version,
                status: row.status,
                generated_rules: row.generated_rules,
            };
        } catch (err) {
            await storage.delete(objectKey).catch(() => {});
            throw err;
        }
    },

    async listRuleTemplates(tenantId) {
        return {
            items: await tenantRepository.listRuleTemplates(tenantId),
        };
    },

    async getRuleTemplate({ tenantId, id }) {
        const row = await tenantRepository.getRuleTemplateById({ id, tenantId });
        if (!row) {
            throw new AppError('Rule template not found.', 404, null, 'NOT_FOUND');
        }
        return row;
    },

    async saveRules({ tenantId, id, body, auth }) {
        if (!body || typeof body !== 'object') {
            throw new AppError(
                'Body harus berisi schema_version dan rules.',
                422,
                null,
                'RULE_INVALID'
            );
        }

        if (
            body.schema_version !== undefined
            && (!Number.isInteger(body.schema_version) || body.schema_version < 1)
        ) {
            throw new AppError('schema_version tidak valid.', 422, null, 'RULE_INVALID');
        }

        try {
            validateRuleConfig(body);
        } catch (err) {
            throw new AppError(err.message, 422, null, 'RULE_INVALID');
        }

        return tenantRepository.saveDraftRules({
            id,
            tenantId,
            rules: body,
            reviewedBy: actorId(auth),
        });
    },

    async activateRuleTemplate({ tenantId, id, auth }) {
        return tenantRepository.activateDraft({
            id,
            tenantId,
            activatedBy: actorId(auth),
        });
    },

    async getSummary({ tenantId, query }) {
        const now = new Date();
        const defaultFrom = new Date(now.getTime() - DEFAULT_SUMMARY_DAYS * 24 * 60 * 60 * 1000);

        const from = parseDate(query?.from, 'from') || defaultFrom;
        const to = parseDate(query?.to, 'to') || now;

        if (from > to) {
            throw new AppError(
                "Parameter 'from' tidak boleh melebihi 'to'.",
                400,
                null,
                'INVALID_QUERY'
            );
        }

        return {
            from: from.toISOString(),
            to: to.toISOString(),
            ...(await tenantRepository.getSummary({ tenantId, from, to })),
        };
    },

    async getAiUsage(tenantId) {
        const tenant = await tenantRepository.getTenant(tenantId);
        if (!tenant) throw notFound();

        const usage = await tenantRepository.getAiUsage(tenantId);
        const totalTokens = usage.tokens_in + usage.tokens_out;
        const quota = Number(tenant.ai_monthly_token_quota || 0);

        return {
            tokens_in: usage.tokens_in,
            tokens_out: usage.tokens_out,
            total_tokens: totalTokens,
            est_cost_usd: usage.est_cost_usd,
            quota,
            usage_percentage: quota > 0
                ? Number(((totalTokens / quota) * 100).toFixed(2))
                : 0,
        };
    },
};
