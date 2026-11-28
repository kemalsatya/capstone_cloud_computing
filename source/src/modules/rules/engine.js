import Ajv from 'ajv';
import { RULES } from './catalog.js';
import { RULE_SCHEMA } from './rule-schema.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateRuleSchema = ajv.compile(RULE_SCHEMA);

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
    if (!validateRuleSchema(config)) {
        const detail = (validateRuleSchema.errors || [])
            .map((error) => `${error.instancePath || '/'} ${error.message}`)
            .join('; ');
        throw new Error(`Konfigurasi rule tidak valid: ${detail}`);
    }

    const ruleById = new Map(config.rules.map((rule) => [rule.id, rule]));
    const abstractRule = ruleById.get('FMT-008');
    const abstract = abstractRule?.params?.abstract;

    if (abstract && abstract.max_words < abstract.min_words) {
        throw new Error('FMT-008: max_words tidak boleh lebih kecil dari min_words.');
    }

    const keywordsRule = ruleById.get('FMT-009');
    const keywords = keywordsRule?.params?.keywords;

    if (keywords && keywords.max < keywords.min) {
        throw new Error('FMT-009: max tidak boleh lebih kecil dari min.');
    }

    return config;
}
