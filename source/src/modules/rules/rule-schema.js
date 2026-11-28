import { RULE_IDS } from './catalog.js';

const nonNegativeInt = { type: 'integer', minimum: 0 };
const positiveInt = { type: 'integer', minimum: 1 };

const ROLE_NAMES = [
    'title',
    'author',
    'abstract',
    'body',
    'heading1',
    'heading2',
    'heading3',
    'heading4',
    'heading5',
    'caption',
    'references',
];

const PARAGRAPH_ROLES = ['title', 'author', 'abstract', 'body', 'heading1', 'references'];

const styleRole = {
    type: 'object',
    properties: {
        font: { type: 'string', minLength: 1 },
        size_halfpt: positiveInt,
    },
    additionalProperties: false,
    minProperties: 1,
};

const paragraphRole = {
    type: 'object',
    properties: {
        align: { type: 'string', enum: ['left', 'center', 'right', 'justify', 'both'] },
        line: nonNegativeInt,
        after: nonNegativeInt,
    },
    additionalProperties: false,
    minProperties: 1,
};

const styleProperties = Object.fromEntries(ROLE_NAMES.map((role) => [role, styleRole]));
const paragraphProperties = Object.fromEntries(
    PARAGRAPH_ROLES.map((role) => [role, paragraphRole])
);

function paramsSchema(properties, required) {
    return {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
    };
}

const RULE_PARAMS = {
    'FMT-001': paramsSchema(
        { width_twips: nonNegativeInt, height_twips: nonNegativeInt },
        ['width_twips', 'height_twips']
    ),
    'FMT-002': paramsSchema(
        {
            top: nonNegativeInt,
            right: nonNegativeInt,
            bottom: nonNegativeInt,
            left: nonNegativeInt,
            scope: { type: 'string', enum: ['body', 'all'] },
        },
        ['top', 'right', 'bottom', 'left']
    ),
    'FMT-003': paramsSchema({ body_columns: positiveInt }, ['body_columns']),
    'FMT-004': paramsSchema(
        {
            styles: {
                type: 'object',
                properties: styleProperties,
                additionalProperties: false,
                minProperties: 1,
            },
        },
        ['styles']
    ),
    'FMT-005': paramsSchema(
        {
            paragraph: {
                type: 'object',
                properties: paragraphProperties,
                additionalProperties: false,
                minProperties: 1,
            },
        },
        ['paragraph']
    ),
    'FMT-006': paramsSchema({ heading_style_required: { type: 'boolean' } }, ['heading_style_required']),
    'FMT-007': paramsSchema(
        {
            required_sections: {
                type: 'array',
                items: {
                    type: 'string',
                    enum: [
                        'introduction',
                        'methodology',
                        'result and discussion',
                        'conclusion',
                        'references',
                    ],
                },
                minItems: 1,
                uniqueItems: true,
            },
        },
        ['required_sections']
    ),
    'FMT-008': paramsSchema(
        {
            abstract: {
                type: 'object',
                properties: { min_words: nonNegativeInt, max_words: nonNegativeInt },
                required: ['min_words', 'max_words'],
                additionalProperties: false,
            },
        },
        ['abstract']
    ),
    'FMT-009': paramsSchema(
        {
            keywords: {
                type: 'object',
                properties: { min: nonNegativeInt, max: nonNegativeInt },
                required: ['min', 'max'],
                additionalProperties: false,
            },
        },
        ['keywords']
    ),
};

const ruleItem = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', enum: RULE_IDS },
        enabled: { type: 'boolean' },
        severity: { type: 'string', enum: ['error', 'warning', 'info'] },
        params: { type: 'object' },
    },
    additionalProperties: false,
    allOf: Object.entries(RULE_PARAMS).map(([id, params]) => ({
        if: { properties: { id: { const: id } } },
        then: { required: ['params'], properties: { params } },
    })),
};

export const RULE_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['schema_version', 'rules'],
    properties: {
        schema_version: { type: 'integer', minimum: 1 },
        rules: {
            type: 'array',
            items: ruleItem,
            minItems: 1,
        },
    },
    additionalProperties: false,
};
