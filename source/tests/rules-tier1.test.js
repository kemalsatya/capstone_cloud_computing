import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocx } from '../src/modules/parser/index.js';
import { DEFAULT_RULES } from '../src/modules/rules/defaults.js';
import { countFindings, outcomeFor, runRules } from '../src/modules/rules/engine.js';
import {
    buildDocx,
    compliantBody,
    COMPLIANT_SECTION,
} from './fixtures/docx-builder.js';

async function evaluate(options = {}) {
    const document = await parseDocx(await buildDocx(options));
    const findings = runRules(document, DEFAULT_RULES);

    return {
        document,
        findings,
        counts: countFindings(findings),
        outcome: outcomeFor(findings),
    };
}

function byRule(findings, ruleId) {
    return findings.filter((finding) => finding.rule_id === ruleId);
}

function replaceParagraph(body, predicate, changes) {
    return body.map((item) => (
        item.type === 'paragraph' && predicate(item) ? { ...item, ...changes } : item
    ));
}

describe('Tier 1 rule engine', () => {
    test('compliant document produces no findings', async () => {
        const { findings, counts, outcome } = await evaluate();

        assert.equal(counts.error, 0);
        assert.equal(outcome, 'passed');
        assert.deepEqual(findings, []);
    });

    test('FMT-001 detects an exact one-twip paper size difference', async () => {
        const { findings } = await evaluate({
            section: {
                ...COMPLIANT_SECTION,
                page: {
                    ...COMPLIANT_SECTION.page,
                    width_twips: COMPLIANT_SECTION.page.width_twips + 1,
                },
            },
        });
        const matches = byRule(findings, 'FMT-001');

        assert.equal(matches.length, 1);
        assert.equal(matches[0].actual.width_twips - matches[0].expected.width_twips, 1);
    });

    test('FMT-002 detects an exact one-twip margin difference', async () => {
        const { findings } = await evaluate({
            section: {
                ...COMPLIANT_SECTION,
                margins: {
                    ...COMPLIANT_SECTION.margins,
                    top: COMPLIANT_SECTION.margins.top + 1,
                },
            },
        });
        const matches = byRule(findings, 'FMT-002');

        assert.equal(matches.length, 1);
        assert.deepEqual(matches[0].expected, { top: 1080 });
        assert.deepEqual(matches[0].actual, { top: 1081 });
    });

    test('FMT-003 detects a single-column body', async () => {
        const { findings } = await evaluate({
            section: { ...COMPLIANT_SECTION, columns: { num: 1 } },
        });

        assert.equal(byRule(findings, 'FMT-003').length, 1);
    });

    test('FMT-004 detects a wrong body font', async () => {
        const body = replaceParagraph(
            compliantBody(),
            (item) => item.text === 'Body text for the introduction.',
            { runProps: { font: 'Arial' } }
        );
        const { findings } = await evaluate({ body });
        const matches = byRule(findings, 'FMT-004');

        assert.ok(matches.some((finding) => finding.message.includes('"body"')));
        const bodyFinding = matches.find((finding) => finding.message.includes('"body"'));
        assert.equal(bodyFinding.expected.font, 'Times New Roman');
        assert.equal(bodyFinding.actual.font, 'Arial');
    });

    test('FMT-005 detects wrong body alignment', async () => {
        const body = replaceParagraph(
            compliantBody(),
            (item) => item.text === 'Body text for the introduction.',
            { align: 'center' }
        );
        const { findings } = await evaluate({ body });

        assert.equal(byRule(findings, 'FMT-005').length, 1);
    });

    test('FMT-006 detects a literal heading that does not use a Heading style', async () => {
        const body = compliantBody();
        const index = body.findIndex((item) => item.text === 'Body text for the introduction.');
        body.splice(index + 1, 0, {
            type: 'paragraph',
            text: '1. Manual Heading',
            style: 'Body',
        });

        const { findings } = await evaluate({ body });

        assert.equal(byRule(findings, 'FMT-006').length, 1);
        assert.match(byRule(findings, 'FMT-006')[0].message, /Manual Heading/);
    });

    test('FMT-007 detects a missing required section', async () => {
        const body = replaceParagraph(
            compliantBody(),
            (item) => item.text === 'Conclusion',
            { text: 'Penutup' }
        );
        const { findings } = await evaluate({ body });
        const matches = byRule(findings, 'FMT-007');

        assert.equal(matches.length, 1);
        assert.match(matches[0].message, /conclusion/);
    });

    test('FMT-008 detects an abstract outside the word range', async () => {
        const { findings } = await evaluate({ body: compliantBody({ words: 50 }) });
        const matches = byRule(findings, 'FMT-008');

        assert.equal(matches.length, 1);
        assert.equal(matches[0].actual.word_count, 50);
    });

    test('FMT-009 detects too few keywords', async () => {
        const { findings } = await evaluate({
            body: compliantBody({ keywords: ['cloud', 'kubernetes'] }),
        });
        const matches = byRule(findings, 'FMT-009');

        assert.equal(matches.length, 1);
        assert.equal(matches[0].actual.count, 2);
    });
});
