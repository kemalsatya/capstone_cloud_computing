import { env } from '../../config/env.js';
import { checkScopeGroq } from './groq.js';
import { checkScopeMock } from './mock.js';

export { validateScopeOutput, AiSchemaError } from './schema.js';

export async function checkScope(input) {
    if (env.AI_MODE === 'mock') {
        return checkScopeMock(input);
    }

    if (env.AI_MODE === 'groq') {
        return checkScopeGroq(input);
    }

    const err = new Error(`AI_MODE '${env.AI_MODE}' tidak dikenal.`);
    err.code = 'AI_CONFIG';
    throw err;
}

export function calculateCost(tokensIn, tokensOut) {
    return (
        (Number(tokensIn || 0) * env.AI_PRICE_IN_PER_1M)
        + (Number(tokensOut || 0) * env.AI_PRICE_OUT_PER_1M)
    ) / 1_000_000;
}
