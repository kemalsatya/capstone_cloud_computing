import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/modules/parser/index.js';
import { deriveTemplateRules } from '../src/modules/suggester/index.js';
import { countFindings, runRules } from '../src/modules/rules/engine.js';

const DEFAULT_TEMPLATE = 'Copy of Template Journal Informatik.docx';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/modules/rules/default-rules.json');

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
    const config = deriveTemplateRules(document);

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
