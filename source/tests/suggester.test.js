import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildDocx } from './fixtures/docx-builder.js';
import { parseDocx } from '../src/modules/parser/index.js';
import { deriveTemplateRules, suggestRulesFromBuffer } from '../src/modules/suggester/index.js';

describe('Template suggester', () => {
    test('derives Tier-1 rules from a DOCX template', async () => {
        const buffer = await buildDocx();
        const { document, generatedRules } = await suggestRulesFromBuffer(buffer);

        assert.equal(generatedRules.schema_version, 1);
        assert.equal(generatedRules.rules.length, 9);
        assert.ok(document.sections.length >= 1);

        const byId = Object.fromEntries(generatedRules.rules.map((rule) => [rule.id, rule]));

        assert.equal(byId['FMT-001'].params.width_twips, 11906);
        assert.equal(byId['FMT-001'].params.height_twips, 16838);
        assert.equal(byId['FMT-002'].params.top, 1080);
        assert.equal(byId['FMT-003'].params.body_columns, 2);
        assert.equal(byId['FMT-004'].params.styles.body.font, 'Times New Roman');
        assert.equal(byId['FMT-008'].params.abstract.min_words, 100);
        assert.equal(byId['FMT-008'].params.abstract.max_words, 200);
        assert.equal(byId['FMT-009'].params.keywords.max, 5);
    });

    test('deriveTemplateRules is consistent with the parsed document', async () => {
        const document = await parseDocx(await buildDocx());
        const config = deriveTemplateRules(document);

        assert.equal(config.rules.length, 9);
        assert.equal(config.rules.find((rule) => rule.id === 'FMT-003').params.body_columns, 2);
    });
});
