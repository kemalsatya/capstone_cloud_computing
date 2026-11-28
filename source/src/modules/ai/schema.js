const FIT_LEVELS = new Set(['high', 'medium', 'low']);

export class AiSchemaError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AiSchemaError';
        this.code = 'AI_INVALID_OUTPUT';
    }
}

function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateScopeOutput(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new AiSchemaError('Output AI harus berupa objek JSON.');
    }

    const { fit_level: fitLevel, rationale, matched_topics: matchedTopics, suggestions } = value;

    if (!FIT_LEVELS.has(fitLevel)) {
        throw new AiSchemaError('fit_level harus high, medium, atau low.');
    }

    if (typeof rationale !== 'string' || rationale.trim().length === 0) {
        throw new AiSchemaError('rationale wajib berupa teks tidak kosong.');
    }

    if (!isStringArray(matchedTopics)) {
        throw new AiSchemaError('matched_topics harus berupa array string.');
    }

    if (!isStringArray(suggestions) || suggestions.length > 3) {
        throw new AiSchemaError('suggestions harus berupa array string maksimal 3 item.');
    }

    return {
        fit_level: fitLevel,
        rationale: rationale.trim(),
        matched_topics: matchedTopics,
        suggestions,
    };
}
