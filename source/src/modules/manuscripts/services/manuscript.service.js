import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { manuscriptRepository } from '../repositories/manuscript.repository.js';
import { AppError } from '../../../common/middlewares/errorHandler.js';

export const manuscriptService = {
    async extractTextFromDocx(buffer) {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value || '';
        } catch {
            // Fallback for mock/test text uploads
            return buffer.toString('utf-8');
        }
    },

    evaluateRules(text, template) {
        const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
        const minWords = template.min_words ?? 3000;
        const maxWords = template.max_words ?? 8000;
        const requireAbstract = template.require_abstract ?? true;
        const requireKeywords = template.require_keywords ?? true;

        const findings = [];
        let score = 100;

        // 1. Word count rule
        if (words < minWords) {
            score -= 20;
            findings.push({
                ruleType: 'WORD_COUNT',
                severity: 'WARNING',
                message: `Word count (${words}) is below minimum requirement of ${minWords} words.`,
            });
        } else if (words > maxWords) {
            score -= 15;
            findings.push({
                ruleType: 'WORD_COUNT',
                severity: 'WARNING',
                message: `Word count (${words}) exceeds maximum limit of ${maxWords} words.`,
            });
        } else {
            findings.push({
                ruleType: 'WORD_COUNT',
                severity: 'INFO',
                message: `Word count is ${words} words (compliant: ${minWords}-${maxWords} words).`,
            });
        }

        // 2. Abstract check
        const hasAbstract = /abstract/i.test(text);
        if (requireAbstract) {
            if (hasAbstract) {
                findings.push({
                    ruleType: 'ABSTRACT_CHECK',
                    severity: 'INFO',
                    message: 'Abstract section is present.',
                });
            } else {
                score -= 15;
                findings.push({
                    ruleType: 'ABSTRACT_CHECK',
                    severity: 'WARNING',
                    message: 'Abstract section is required but was not found.',
                });
            }
        }

        // 3. Keywords check
        const hasKeywords = /keyword|kata kunci/i.test(text);
        if (requireKeywords) {
            if (hasKeywords) {
                findings.push({
                    ruleType: 'KEYWORDS_CHECK',
                    severity: 'INFO',
                    message: 'Keywords section is present.',
                });
            } else {
                score -= 15;
                findings.push({
                    ruleType: 'KEYWORDS_CHECK',
                    severity: 'WARNING',
                    message: 'Keywords section is required but was not found.',
                });
            }
        }

        return {
            formatScore: Math.max(0, Math.min(100, score)),
            findings,
            wordCount: words,
        };
    },

    async processUpload({ tenantId, file, authorId = null }) {
        if (!file) {
            throw new AppError('File is required (.docx format)', 400);
        }

        // Ensure tenant and default rule template exist in PostgreSQL
        await manuscriptRepository.ensureTenantExists(tenantId);
        const template = await manuscriptRepository.ensureDefaultRuleTemplate(tenantId);

        // Ensure uploads directory exists on host/container
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        const manuscriptId = `ms-${crypto.randomUUID().slice(0, 8)}`;
        const storedFileName = `${manuscriptId}-${file.originalname}`;
        const storedFilePath = path.join(uploadsDir, storedFileName);

        await fs.writeFile(storedFilePath, file.buffer);

        // Extract text and evaluate rules
        const textContent = await this.extractTextFromDocx(file.buffer);
        const { formatScore, findings } = this.evaluateRules(textContent, template);

        // Save manuscript record
        const manuscript = await manuscriptRepository.createManuscript({
            id: manuscriptId,
            tenantId,
            authorId,
            title: file.originalname,
            filePath: `/uploads/${storedFileName}`,
        });

        // Save check result
        const checkResultId = `cr-${crypto.randomUUID().slice(0, 8)}`;
        const checkResult = await manuscriptRepository.createCheckResult({
            id: checkResultId,
            manuscriptId: manuscript.id,
            status: 'COMPLETED',
            formatScore,
        });

        // Save findings
        const findingsPayload = findings.map((f, idx) => ({
            id: `f-${checkResultId.slice(3)}-${idx + 1}`,
            checkResultId: checkResult.id,
            ruleType: f.ruleType,
            severity: f.severity,
            message: f.message,
        }));
        const savedFindings = await manuscriptRepository.createFindings(findingsPayload);

        return {
            manuscript,
            checkResult,
            findings: savedFindings,
        };
    },

    async getReport(manuscriptId, requestingTenantId) {
        const fullReport = await manuscriptRepository.getFullReportByManuscriptId(manuscriptId);
        if (!fullReport || !fullReport.manuscript) {
            throw new AppError(`Manuscript with ID '${manuscriptId}' not found`, 404);
        }

        // Multi-Tenant Isolation Enforcement (Negative Test)
        if (fullReport.manuscript.tenant_id !== requestingTenantId) {
            throw new AppError(
                `Access forbidden: Tenant '${requestingTenantId}' is not authorized to access manuscript '${manuscriptId}' owned by '${fullReport.manuscript.tenant_id}'`,
                403
            );
        }

        return {
            manuscript: fullReport.manuscript,
            checkResult: fullReport.checkResult,
            findings: fullReport.findings,
        };
    },
};
