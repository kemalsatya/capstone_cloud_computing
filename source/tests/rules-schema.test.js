import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RULES } from '../src/modules/rules/defaults.js';
import { validateRuleConfig } from '../src/modules/rules/engine.js';

function configWith(rule) {
    return {
        schema_version: 1,
        rules: [rule],
    };
}

describe('Rule JSON Schema', () => {
    test('accepts the default rule configuration', () => {
        assert.doesNotThrow(() => validateRuleConfig(DEFAULT_RULES));
    });

    test('rejects an unknown rule id', () => {
        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-999',
                enabled: true,
                severity: 'error',
                params: {},
            })),
            /Konfigurasi rule tidak valid/
        );
    });

    test('rejects wrong parameter types and negative values', () => {
        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-001',
                enabled: true,
                severity: 'error',
                params: { width_twips: '11906', height_twips: 16838 },
            })),
            /Konfigurasi rule tidak valid/
        );

        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-002',
                enabled: true,
                severity: 'error',
                params: { top: -1, right: 907, bottom: 1440, left: 907 },
            })),
            /Konfigurasi rule tidak valid/
        );
    });

    test('rejects invalid severity and missing params', () => {
        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-003',
                enabled: true,
                severity: 'fatal',
                params: { body_columns: 2 },
            })),
            /Konfigurasi rule tidak valid/
        );

        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-003',
                enabled: true,
                severity: 'error',
            })),
            /Konfigurasi rule tidak valid/
        );
    });

    test('rejects cross-field ranges where max is smaller than min', () => {
        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-008',
                enabled: true,
                severity: 'error',
                params: { abstract: { min_words: 200, max_words: 100 } },
            })),
            /max_words tidak boleh lebih kecil/
        );

        assert.throws(
            () => validateRuleConfig(configWith({
                id: 'FMT-009',
                enabled: true,
                severity: 'error',
                params: { keywords: { min: 5, max: 3 } },
            })),
            /max tidak boleh lebih kecil/
        );
    });

    test('accepts a valid subset of rules', () => {
        assert.doesNotThrow(() => validateRuleConfig(configWith({
            id: 'FMT-009',
            enabled: true,
            severity: 'warning',
            params: { keywords: { min: 3, max: 5 } },
        })));
    });
});
