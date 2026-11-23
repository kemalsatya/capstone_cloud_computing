import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/modules/parser/index.js';
import { DEFAULT_RULES } from '../src/modules/rules/defaults.js';
import { countFindings, runRules } from '../src/modules/rules/engine.js';

const templatePath = process.env.TEMPLATE_INFORMATIK_PATH
    || path.resolve(process.cwd(), 'Copy of Template Journal Informatik.docx');

test(
    'golden: template Informatik produces zero format errors',
    { skip: !fs.existsSync(templatePath) },
    async () => {
        const document = await parseDocx(fs.readFileSync(templatePath));
        const findings = runRules(document, DEFAULT_RULES);
        const counts = countFindings(findings);

        assert.equal(counts.error, 0, JSON.stringify(findings, null, 2));
        assert.equal(document.sections[document.bodySectionIndex].columns.num, 2);
        assert.ok(document.abstract.wordCount >= 100 && document.abstract.wordCount <= 200);
        assert.ok(document.keywords.count >= 3);
    }
);
