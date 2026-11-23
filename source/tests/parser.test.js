import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { parseDocx, validateDocx } from '../src/modules/parser/index.js';
import {
    buildDocx,
    COMPLIANT_KEYWORDS,
    COMPLIANT_SECTION,
} from './fixtures/docx-builder.js';

describe('DOCX parser', () => {
    test('reads page size, margins, columns, abstract, keywords and headings', async () => {
        const document = await parseDocx(await buildDocx());

        assert.equal(document.sections.length, 1);
        assert.deepEqual(document.sections[0].page, {
            width_twips: COMPLIANT_SECTION.page.width_twips,
            height_twips: COMPLIANT_SECTION.page.height_twips,
            orientation: null,
        });
        assert.equal(document.sections[0].margins.top, 1080);
        assert.equal(document.sections[0].margins.right, 907);
        assert.equal(document.sections[0].margins.bottom, 1440);
        assert.equal(document.sections[0].margins.left, 907);
        assert.equal(document.sections[0].columns.num, 2);

        assert.equal(document.abstract.found, true);
        assert.equal(document.abstract.wordCount, 120);
        assert.deepEqual(document.keywords.values, COMPLIANT_KEYWORDS);
        assert.equal(document.title.text, 'Paper Title');
        assert.equal(document.authors.text, 'First Author, Second Author');

        assert.deepEqual(
            document.paragraphs.filter((paragraph) => paragraph.isHeading)
                .map((paragraph) => paragraph.text.trim()),
            ['Introduction', 'Methodology', 'Result and Discussion', 'Conclusion', 'References']
        );
    });

    test('collects abstract text from consecutive rows in the same table column', async () => {
        const document = await parseDocx(await buildDocx());
        const abstractParagraph = document.paragraphs[document.abstract.paragraphIndices[0]];

        assert.equal(abstractParagraph.container, 'table');
        assert.equal(abstractParagraph.cellIndex, 2);
        assert.match(abstractParagraph.text, /^abstractword1/);
    });

    test('resolves font and size through basedOn and docDefaults', async () => {
        const styles = [
            { id: 'Normal', name: 'normal' },
            { id: 'Base', name: 'base', basedOn: 'Normal', rPr: { sizeHalfPt: 24 } },
            { id: 'Derived', name: 'derived', basedOn: 'Base', rPr: { font: 'Arial' } },
        ];
        const body = [
            { type: 'paragraph', text: 'Derived text', style: 'Derived' },
            { type: 'paragraph', text: 'Base text', style: 'Base' },
            { type: 'paragraph', text: 'Normal text', style: 'Normal' },
        ];
        const buffer = await buildDocx({
            body,
            styles,
            docDefaults: { rPr: { font: 'Times New Roman', sizeHalfPt: 20 }, pPr: {} },
        });
        const document = await parseDocx(buffer);

        assert.equal(document.paragraphs[0].effective.rPr.font, 'Arial');
        assert.equal(document.paragraphs[0].effective.rPr.sizeHalfPt, 24);
        assert.equal(document.paragraphs[1].effective.rPr.font, 'Times New Roman');
        assert.equal(document.paragraphs[1].effective.rPr.sizeHalfPt, 24);
        assert.equal(document.paragraphs[2].effective.rPr.font, 'Times New Roman');
        assert.equal(document.paragraphs[2].effective.rPr.sizeHalfPt, 20);
    });

    test('uses paragraph mark run properties when a run has no explicit size', async () => {
        const buffer = await buildDocx({
            body: [{ type: 'paragraph', text: 'Mark properties', markRPr: { sizeHalfPt: 28 } }],
        });
        const document = await parseDocx(buffer);

        assert.equal(document.paragraphs[0].effective.rPr.sizeHalfPt, 28);
    });

    test('detects literal heading numbering without a Word heading style', async () => {
        const buffer = await buildDocx({
            body: [
                { type: 'paragraph', text: '1. Manual Heading', style: 'Body' },
                { type: 'paragraph', text: 'Introduction', style: 'Heading1', align: 'center' },
            ],
        });
        const document = await parseDocx(buffer);
        const manual = document.paragraphs.find((paragraph) => paragraph.text.includes('Manual Heading'));

        assert.equal(manual.isHeading, false);
        assert.equal(manual.looksLikeHeading, true);
        assert.equal(manual.manualNumbering.prefix, '1');
    });

    test('rejects a non-DOCX buffer with INVALID_FILE', async () => {
        await assert.rejects(
            () => parseDocx(Buffer.from('this is not a zip file')),
            (err) => err.code === 'INVALID_FILE'
        );
    });

    test('rejects a DOCX with too many ZIP entries', async () => {
        const zip = new JSZip();
        zip.file('[Content_Types].xml', '<Types/>');
        zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>');

        for (let index = 0; index < 1001; index += 1) {
            zip.file(`dummy-${index}.xml`, '<dummy/>');
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer' });

        await assert.rejects(
            () => parseDocx(buffer),
            (err) => err.code === 'INVALID_FILE'
        );
    });

    test('validateDocx returns the entry count for a valid file', async () => {
        const result = await validateDocx(await buildDocx());
        assert.ok(result.entryCount >= 5);
    });
});
