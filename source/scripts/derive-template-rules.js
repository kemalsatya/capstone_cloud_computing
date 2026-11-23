import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/modules/parser/index.js';
import { defaultRuleConfig } from '../src/modules/rules/catalog.js';
import { countFindings, runRules } from '../src/modules/rules/engine.js';

const DEFAULT_TEMPLATE = 'Copy of Template Journal Informatik.docx';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/modules/rules/default-rules.json');

function firstTextParagraph(document, role) {
    return (document.roles?.[role] || [])
        .map((index) => document.paragraphs[index])
        .find((paragraph) => paragraph && !paragraph.empty) || null;
}

function updateRule(config, id, params) {
    const rule = config.rules.find((item) => item.id === id);
    if (!rule) return;
    rule.params = { ...rule.params, ...params };
}

function deriveStyleParams(document) {
    const styles = {};
    const roles = [
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

    for (const role of roles) {
        const paragraph = firstTextParagraph(document, role);
        if (!paragraph) continue;

        const font = paragraph.effective?.rPr?.font ?? null;
        const sizeHalfPt = paragraph.effective?.rPr?.sizeHalfPt ?? null;
        if (!font && sizeHalfPt === null) continue;

        styles[role] = {};
        if (font) styles[role].font = font;
        if (sizeHalfPt !== null) styles[role].size_halfpt = sizeHalfPt;
    }

    return styles;
}

function deriveParagraphParams(document) {
    const paragraphParams = {};
    const roles = ['title', 'author', 'abstract', 'body', 'heading1', 'references'];

    for (const role of roles) {
        const paragraph = firstTextParagraph(document, role);
        if (!paragraph) continue;

        const values = {};
        if (paragraph.alignment) values.align = paragraph.alignment;
        if (paragraph.spacing?.line !== null && paragraph.spacing?.line !== undefined) {
            values.line = paragraph.spacing.line;
        }
        if (paragraph.spacing?.after !== null && paragraph.spacing?.after !== undefined) {
            values.after = paragraph.spacing.after;
        }

        if (Object.keys(values).length > 0) {
            paragraphParams[role] = values;
        }
    }

    return paragraphParams;
}

function deriveAbstractRange(document) {
    const match = String(document.abstract?.text || '').match(
        /(\d+)\s*(?:to|–|-)\s*(\d+)\s*words/i
    );

    if (match) {
        return { min_words: Number(match[1]), max_words: Number(match[2]) };
    }

    return { min_words: 100, max_words: 200 };
}

function deriveKeywordsRange(document) {
    const count = document.keywords?.count || 0;
    if (count <= 0) return { min: 3, max: 5 };
    return { min: Math.min(3, count), max: count };
}

async function main() {
    const args = process.argv.slice(2);
    const write = args.includes('--write');
    const templatePath = args.find((arg) => !arg.startsWith('--'))
        || process.env.TEMPLATE_INFORMATIK_PATH
        || DEFAULT_TEMPLATE;

    if (!fs.existsSync(templatePath)) {
        console.error(`Template tidak ditemukan: ${templatePath}`);
        process.exit(1);
    }

    const document = await parseDocx(fs.readFileSync(templatePath));
    const bodySection = document.sections[document.bodySectionIndex] || document.sections[0];
    const config = defaultRuleConfig();

    updateRule(config, 'FMT-001', {
        width_twips: bodySection.page.width_twips,
        height_twips: bodySection.page.height_twips,
    });

    updateRule(config, 'FMT-002', {
        top: bodySection.margins.top,
        right: bodySection.margins.right,
        bottom: bodySection.margins.bottom,
        left: bodySection.margins.left,
        scope: 'body',
    });

    updateRule(config, 'FMT-003', {
        body_columns: bodySection.columns.num ?? 1,
    });

    updateRule(config, 'FMT-004', {
        styles: deriveStyleParams(document),
    });

    updateRule(config, 'FMT-005', {
        paragraph: deriveParagraphParams(document),
    });

    updateRule(config, 'FMT-008', {
        abstract: deriveAbstractRange(document),
    });

    updateRule(config, 'FMT-009', {
        keywords: deriveKeywordsRange(document),
    });

    const findings = runRules(document, config);
    const counts = countFindings(findings);
    const output = `${JSON.stringify(config, null, 2)}\n`;

    if (write) {
        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, output);
        console.log(`Default rules ditulis ke ${OUTPUT_PATH}`);
    } else {
        process.stdout.write(output);
    }

    console.log(`\nTemplate: ${templatePath}`);
    console.log(`Body section: ${document.bodySectionIndex}`);
    console.log(`Temuan default: error=${counts.error}, warning=${counts.warning}, info=${counts.info}`);
    for (const finding of findings) {
        console.log(`- [${finding.severity}] ${finding.rule_id}: ${finding.message}`);
    }

    if (counts.error > 0) {
        process.exitCode = 2;
    }
}

main();
