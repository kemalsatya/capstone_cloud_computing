import { parseDocx } from '../parser/index.js';
import { countFindings, outcomeFor, runRules } from '../rules/engine.js';
import { manuscriptRepository } from '../manuscripts/repositories/manuscript.repository.js';
import { storage } from '../storage/index.js';
import { FORMAT_QUEUE } from '../queue/names.js';
import { recordCheckDuration, recordJobResult } from '../../common/utils/metrics.js';

async function failPermanently(manuscriptId, errorCode, message) {
    await manuscriptRepository.failFormat(manuscriptId, errorCode, message);
    recordJobResult(FORMAT_QUEUE, 'failed');
}

export function registerFormatWorker(boss) {
    return boss.work(FORMAT_QUEUE, { batchSize: 1 }, async (jobs) => {
        const job = jobs[0];
        if (!job) return;

        const { manuscriptId, tenantId } = job.data || {};
        if (!manuscriptId) return;

        const existing = await manuscriptRepository.getFormatCheck(manuscriptId);
        if (!existing || existing.status === 'completed') {
            recordJobResult(FORMAT_QUEUE, 'skipped');
            return;
        }

        try {
            const started = await manuscriptRepository.markFormatRunning(manuscriptId);
            if (!started) {
                recordJobResult(FORMAT_QUEUE, 'skipped');
                return;
            }

            const manuscript = await manuscriptRepository.findManuscriptById(manuscriptId);
            if (!manuscript) {
                await failPermanently(manuscriptId, 'NOT_FOUND', 'Naskah tidak ditemukan.');
                return;
            }

            const template = await manuscriptRepository.getRuleTemplateById(manuscript.rule_template_id);
            if (!template || !template.rules) {
                await failPermanently(
                    manuscriptId,
                    'NO_ACTIVE_RULE',
                    'Rule format untuk naskah ini tidak tersedia.'
                );
                return;
            }

            const objectKey = manuscript.object_key || manuscript.file_path;
            const buffer = await storage.get(objectKey);

            let document;
            try {
                document = await parseDocx(buffer);
            } catch (parseError) {
                await failPermanently(
                    manuscriptId,
                    parseError.code || 'INVALID_FILE',
                    parseError.message
                );
                return;
            }

            const ruleConfig = typeof template.rules === 'string'
                ? JSON.parse(template.rules)
                : template.rules;
            const findings = runRules(document, ruleConfig);
            const counts = countFindings(findings);
            const outcome = outcomeFor(findings);

            await manuscriptRepository.completeFormat(manuscriptId, {
                tenantId: manuscript.tenant_id || tenantId,
                outcome,
                findings,
                counts,
                document,
                templateVersion: template.version,
            });

            const startedAt = new Date(manuscript.created_at).getTime();
            recordCheckDuration('format', Date.now() - startedAt);
            recordJobResult(FORMAT_QUEUE, 'completed');
        } catch (err) {
            const retryCount = Number(job.retryCount || 0);
            const retryLimit = Number(job.retryLimit ?? 2);
            const finalAttempt = retryCount >= retryLimit;

            if (finalAttempt) {
                await manuscriptRepository
                    .failFormat(manuscriptId, err.code || 'FORMAT_CHECK_FAILED', err.message)
                    .catch(() => {});
                recordJobResult(FORMAT_QUEUE, 'dlq');
                return;
            }

            recordJobResult(FORMAT_QUEUE, 'retry');
            throw err;
        }
    });
}
