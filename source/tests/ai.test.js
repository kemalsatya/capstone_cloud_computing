import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCost, checkScope, validateScopeOutput } from '../src/modules/ai/index.js';
import { AiSchemaError } from '../src/modules/ai/schema.js';
import { env } from '../src/config/env.js';

describe('AI scope checker', () => {
    test('mock mode returns a schema-valid result without network', async () => {
        const result = await checkScope({
            aimScope: 'cloud computing kubernetes gitops observability reliability',
            abstract: 'This paper studies kubernetes and reliability in cloud computing.',
            keywords: ['cloud computing', 'kubernetes'],
        });

        assert.ok(['high', 'medium', 'low'].includes(result.fit_level));
        assert.ok(result.tokens_in > 0);
        assert.ok(result.tokens_out > 0);
        assert.equal(result.ai_provider, 'mock');
        assert.doesNotThrow(() => validateScopeOutput(result));
    });

    test('schema rejects invalid AI output', () => {
        assert.throws(
            () => validateScopeOutput({
                fit_level: 'very-high',
                rationale: 'x',
                matched_topics: [],
                suggestions: [],
            }),
            (err) => err instanceof AiSchemaError && err.code === 'AI_INVALID_OUTPUT'
        );

        assert.throws(
            () => validateScopeOutput({
                fit_level: 'high',
                rationale: 'x',
                matched_topics: 'not-an-array',
                suggestions: [],
            }),
            (err) => err instanceof AiSchemaError
        );

        assert.throws(
            () => validateScopeOutput({
                fit_level: 'high',
                rationale: 'x',
                matched_topics: [],
                suggestions: ['1', '2', '3', '4'],
            }),
            (err) => err instanceof AiSchemaError
        );
    });

    test('calculateCost uses per-million pricing from env', () => {
        const originalIn = env.AI_PRICE_IN_PER_1M;
        const originalOut = env.AI_PRICE_OUT_PER_1M;

        try {
            env.AI_PRICE_IN_PER_1M = 2;
            env.AI_PRICE_OUT_PER_1M = 3;
            assert.equal(calculateCost(1_000_000, 1_000_000), 5);
            assert.equal(calculateCost(0, 0), 0);
        } finally {
            env.AI_PRICE_IN_PER_1M = originalIn;
            env.AI_PRICE_OUT_PER_1M = originalOut;
        }
    });
});
