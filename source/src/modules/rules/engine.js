import { RULES } from './catalog.js';

const SEVERITIES = new Set(['error', 'warning', 'info']);

export function runRules(document, config) {
    const ruleList = Array.isArray(config) ? config : config?.rules || [];
    const findings = [];

    for (const ruleConfig of ruleList) {
        if (!ruleConfig || ruleConfig.enabled === false) continue;

        const definition = RULES[ruleConfig.id];
        if (!definition) continue;

        const severity = ruleConfig.severity || definition.defaultSeverity;
        const params = {
            ...definition.defaultParams,
            ...(ruleConfig.params || {}),
        };

        let results = [];
        try {
            results = definition.evaluate(document, params) || [];
        } catch (err) {
            results = [{
                message: `Gagal mengevaluasi ${ruleConfig.id}: ${err.message}`,
                location: {},
                expected: null,
                actual: null,
            }];
        }

        for (const result of results) {
            findings.push({
                rule_id: ruleConfig.id,
                severity,
                ...result,
            });
        }
    }

    return findings;
}

export function countFindings(findings) {
    const counts = { error: 0, warning: 0, info: 0 };

    for (const finding of findings) {
        if (counts[finding.severity] !== undefined) {
            counts[finding.severity] += 1;
        }
    }

    return counts;
}

export function outcomeFor(findings) {
    return findings.some((finding) => finding.severity === 'error') ? 'failed' : 'passed';
}

export function validateRuleConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Konfigurasi rule harus berupa objek.');
    }

    if (!Array.isArray(config.rules)) {
        throw new Error('Konfigurasi rule harus memiliki array "rules".');
    }

    for (const rule of config.rules) {
        if (!rule?.id || !RULES[rule.id]) {
            throw new Error(`Rule tidak dikenal: ${rule?.id || '(kosong)'}.`);
        }

        if (rule.severity && !SEVERITIES.has(rule.severity)) {
            throw new Error(`Severity tidak valid untuk ${rule.id}: ${rule.severity}.`);
        }
    }

    return config;
}
