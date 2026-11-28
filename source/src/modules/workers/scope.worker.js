import { calculateCost, checkScope } from '../ai/index.js';
import { manuscriptRepository } from '../manuscripts/repositories/manuscript.repository.js';
import { SCOPE_QUEUE } from '../queue/names.js';
import {
    recordAiUsage,
    recordCheckDuration,
    recordJobResult,
} from '../../common/utils/metrics.js';

async function skip(manuscriptId, errorCode, message) {
    await manuscriptRepository.skipScope(manuscriptId, errorCode, message);
    recordJobResult(SCOPE_QUEUE, 'skipped');
}

export function registerScopeWorker(boss) {
    return boss.work(SCOPE_QUEUE, { batchSize: 1 }, async (jobs) => {
        const job = jobs[0];
        if (!job) return;

        const { manuscriptId, tenantId } = job.data || {};
        if (!manuscriptId) return;

        const existing = await manuscriptRepository.getScopeCheck(manuscriptId);
        if (!existing) {
            recordJobResult(SCOPE_QUEUE, 'skipped');
            return;
        }

        if (existing.status === 'completed' || existing.status === 'skipped') {
            recordJobResult(SCOPE_QUEUE, 'skipped');
            return;
        }

        try {
            const attempt = await manuscriptRepository.markScopeRunning(manuscriptId);
            if (attempt === null) {
                recordJobResult(SCOPE_QUEUE, 'skipped');
                return;
            }

            const context = await manuscriptRepository.getScopeContext(manuscriptId);
            if (!context) {
                await skip(manuscriptId, 'NOT_FOUND', 'Naskah tidak ditemukan.');
                return;
            }

            const abstractText = String(context.abstract_text || '').trim();
            if (!abstractText) {
                await skip(manuscriptId, 'NO_ABSTRACT', 'Abstrak tidak tersedia untuk pemeriksaan scope.');
                return;
            }

            const tenant = context.tenant_id || tenantId;
            const quota = Number(context.ai_monthly_token_quota || 0);
            if (quota > 0) {
                const usage = await manuscriptRepository.getTenantAiUsageThisMonth(tenant);
                if (usage.tokens_in + usage.tokens_out >= quota) {
                    await skip(
                        manuscriptId,
                        'QUOTA_EXCEEDED',
                        'Kuota token AI tenant untuk bulan berjalan telah habis.'
                    );
                    return;
                }
            }

            const output = await checkScope({
                aimScope: context.aim_scope || '',
                abstract: abstractText,
                keywords: context.keywords || [],
            });

            const estCostUsd = calculateCost(output.tokens_in, output.tokens_out);

            await manuscriptRepository.completeScope(manuscriptId, {
                tenantId: tenant,
                output,
                tokensIn: output.tokens_in,
                tokensOut: output.tokens_out,
                estCostUsd,
            });

            recordAiUsage(tenant, output.tokens_in, output.tokens_out, estCostUsd);
            recordCheckDuration(
                'scope',
                Date.now() - new Date(context.created_at).getTime()
            );
            recordJobResult(SCOPE_QUEUE, 'completed');
        } catch (err) {
            const retryCount = Number(job.retryCount || 0);
            const retryLimit = Number(job.retryLimit ?? 3);
            const finalAttempt = retryCount >= retryLimit;

            if (finalAttempt) {
                await manuscriptRepository
                    .delayScope(manuscriptId, err.code || 'AI_ERROR', err.message)
                    .catch(() => {});
                recordJobResult(SCOPE_QUEUE, 'dlq');
                return;
            }

            recordJobResult(SCOPE_QUEUE, 'retry');
            throw err;
        }
    });
}
