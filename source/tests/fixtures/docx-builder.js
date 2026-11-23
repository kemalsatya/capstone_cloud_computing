import JSZip from 'jszip';

const W_NS = [
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
].join(' ');

function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function rPrXml(props = {}) {
    const parts = [];

    if (props.font) {
        parts.push(
            `<w:rFonts w:ascii="${esc(props.font)}" w:hAnsi="${esc(props.font)}" w:cs="${esc(props.font)}" w:eastAsia="${esc(props.font)}"/>`
        );
    }
    if (props.sizeHalfPt !== undefined && props.sizeHalfPt !== null) {
        parts.push(`<w:sz w:val="${props.sizeHalfPt}"/><w:szCs w:val="${props.sizeHalfPt}"/>`);
    }
    if (props.bold !== undefined) {
        parts.push(`<w:b w:val="${props.bold ? 1 : 0}"/>`);
    }
    if (props.italic !== undefined) {
        parts.push(`<w:i w:val="${props.italic ? 1 : 0}"/>`);
    }

    return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
}

function pPrXml(props = {}) {
    const parts = [];

    if (props.style) parts.push(`<w:pStyle w:val="${esc(props.style)}"/>`);
    if (props.align) parts.push(`<w:jc w:val="${esc(props.align)}"/>`);

    if (props.spacing) {
        const attrs = [];
        if (props.spacing.before !== undefined && props.spacing.before !== null) attrs.push(`w:before="${props.spacing.before}"`);
        if (props.spacing.after !== undefined && props.spacing.after !== null) attrs.push(`w:after="${props.spacing.after}"`);
        if (props.spacing.line !== undefined && props.spacing.line !== null) attrs.push(`w:line="${props.spacing.line}"`);
        if (props.spacing.lineRule) attrs.push(`w:lineRule="${esc(props.spacing.lineRule)}"`);
        if (attrs.length) parts.push(`<w:spacing ${attrs.join(' ')}/>`);
    }

    if (props.outlineLvl !== undefined) {
        parts.push(`<w:outlineLvl w:val="${props.outlineLvl}"/>`);
    }

    if (props.numbering) {
        parts.push(
            `<w:numPr><w:ilvl w:val="${props.numbering.ilvl ?? 0}"/><w:numId w:val="${props.numbering.numId}"/></w:numPr>`
        );
    }

    if (props.markRPr) parts.push(rPrXml(props.markRPr));

    return parts.length ? `<w:pPr>${parts.join('')}</w:pPr>` : '';
}

function paragraphXml(paragraph) {
    const runs = paragraph.runs || [{ text: paragraph.text ?? '' }];
    const runsXml = runs.map((run) => {
        const props = { ...(paragraph.runProps || {}), ...(run.props || {}) };
        return `<w:r>${rPrXml(props)}<w:t xml:space="preserve">${esc(run.text ?? '')}</w:t></w:r>`;
    }).join('');

    return `<w:p>${pPrXml({
        style: paragraph.style,
        align: paragraph.align,
        spacing: paragraph.spacing,
        outlineLvl: paragraph.outlineLvl,
        numbering: paragraph.numbering,
        markRPr: paragraph.markRPr,
    })}${runsXml}</w:p>`;
}

function tableXml(rows) {
    const rowsXml = rows.map((cells) => {
        const cellsXml = cells.map((cellParagraphs) => {
            const content = (cellParagraphs || []).map((paragraph) => (
                typeof paragraph === 'string'
                    ? paragraphXml({ text: paragraph })
                    : paragraphXml(paragraph)
            )).join('');

            return `<w:tc><w:tcPr/>${content}</w:tc>`;
        }).join('');

        return `<w:tr>${cellsXml}</w:tr>`;
    }).join('');

    return `<w:tbl><w:tblPr/>${rowsXml}</w:tbl>`;
}

function sectPrXml(section = {}) {
    const page = section.page || {};
    const margins = section.margins || {};
    const columns = section.columns || {};
    const orient = page.orientation ? ` w:orient="${page.orientation}"` : '';

    return `<w:sectPr>
        <w:pgSz w:w="${page.width_twips ?? 11906}" w:h="${page.height_twips ?? 16838}"${orient}/>
        <w:pgMar w:top="${margins.top ?? 1080}" w:right="${margins.right ?? 907}" w:bottom="${margins.bottom ?? 1440}" w:left="${margins.left ?? 907}" w:header="720" w:footer="720" w:gutter="0"/>
        <w:cols w:num="${columns.num ?? 2}" w:space="708"/>
    </w:sectPr>`;
}

function stylesXml(styles, docDefaults = {}) {
    const defaults = `<w:docDefaults>
        <w:rPrDefault>${rPrXml(docDefaults.rPr || {})}</w:rPrDefault>
        <w:pPrDefault>${pPrXml(docDefaults.pPr || {})}</w:pPrDefault>
    </w:docDefaults>`;

    const stylesX = styles.map((style) => {
        const basedOn = style.basedOn ? `<w:basedOn w:val="${esc(style.basedOn)}"/>` : '';
        return `<w:style w:type="paragraph" w:styleId="${esc(style.id)}">
            <w:name w:val="${esc(style.name || style.id)}"/>
            ${basedOn}
            ${rPrXml(style.rPr || {})}
            ${pPrXml(style.pPr || {})}
        </w:style>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:styles ${W_NS}>${defaults}${stylesX}</w:styles>`;
}

function themeXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
            <a:themeElements>
                <a:fontScheme name="Office">
                    <a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont>
                    <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
                </a:fontScheme>
            </a:themeElements>
        </a:theme>`;
}

function settingsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:settings ${W_NS}><w:defaultTabStop w:val="720"/></w:settings>`;
}

function contentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
            <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
            <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
            <Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
        </Types>`;
}

function packageRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
        </Relationships>`;
}

function documentRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
            <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
        </Relationships>`;
}

export const COMPLIANT_STYLES = [
    { id: 'Normal', name: 'normal', rPr: { font: 'Times New Roman', sizeHalfPt: 20 } },
    {
        id: 'Title',
        name: 'title',
        basedOn: 'Normal',
        rPr: { font: 'Times New Roman', sizeHalfPt: 48 },
        pPr: { align: 'center', spacing: { after: 280, line: 240, lineRule: 'auto' } },
    },
    {
        id: 'Author',
        name: 'author',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 24 },
        pPr: { align: 'center', spacing: { after: 120, lineRule: 'auto' } },
    },
    {
        id: 'Abstract',
        name: 'abstract',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 18 },
        pPr: { align: 'justify' },
    },
    {
        id: 'Keywords',
        name: 'keywords',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 18 },
    },
    {
        id: 'Body',
        name: 'body',
        basedOn: 'Normal',
        rPr: { font: 'Times New Roman', sizeHalfPt: 20 },
        pPr: { align: 'justify', spacing: { after: 120, line: 228, lineRule: 'auto' } },
    },
    {
        id: 'Heading1',
        name: 'heading 1',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 20, bold: true },
        pPr: { outlineLvl: 0, align: 'center', spacing: { after: 80, lineRule: 'auto' } },
    },
    {
        id: 'Heading2',
        name: 'heading 2',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 20, bold: true },
        pPr: { outlineLvl: 1, align: 'center', spacing: { after: 80, lineRule: 'auto' } },
    },
    {
        id: 'Heading3',
        name: 'heading 3',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 20, bold: true },
        pPr: { outlineLvl: 2, spacing: { after: 80, lineRule: 'auto' } },
    },
    {
        id: 'Heading4',
        name: 'heading 4',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 20, bold: true },
        pPr: { outlineLvl: 3, spacing: { after: 80, lineRule: 'auto' } },
    },
    {
        id: 'Heading5',
        name: 'heading 5',
        basedOn: 'Normal',
        rPr: { font: 'Calibri', sizeHalfPt: 20, bold: true },
        pPr: { outlineLvl: 4, spacing: { after: 80, lineRule: 'auto' } },
    },
];

export const COMPLIANT_SECTION = {
    page: { width_twips: 11906, height_twips: 16838 },
    margins: { top: 1080, right: 907, bottom: 1440, left: 907 },
    columns: { num: 2 },
};

export function abstractText(words = 120) {
    return Array.from({ length: words }, (_, index) => `abstractword${index + 1}`).join(' ');
}

export const COMPLIANT_KEYWORDS = [
    'cloud computing',
    'kubernetes',
    'gitops',
    'observability',
    'reliability',
];

export function compliantBody({ words = 120, keywords = COMPLIANT_KEYWORDS } = {}) {
    return [
        {
            type: 'paragraph',
            text: 'Paper Title',
            style: 'Title',
            align: 'center',
            spacing: { after: 280, line: 240, lineRule: 'auto' },
        },
        {
            type: 'paragraph',
            text: 'First Author, Second Author',
            style: 'Author',
            align: 'center',
            spacing: { after: 120, lineRule: 'auto' },
        },
        {
            type: 'table',
            rows: [
                [
                    [{ text: 'Article Info' }],
                    [{ text: '' }],
                    [{ text: 'ABSTRACT (10 PT)' }],
                ],
                [
                    [{ text: 'Article history: Received 2025' }],
                    [{ text: '' }],
                    [{ text: abstractText(words), style: 'Abstract', align: 'justify' }],
                ],
                [
                    [
                        { text: 'Keywords:' },
                        ...keywords.map((keyword) => ({ text: keyword, style: 'Keywords' })),
                    ],
                    [{ text: '' }],
                    [{ text: '' }],
                ],
            ],
        },
        { type: 'paragraph', text: 'Introduction', style: 'Heading1', align: 'center', spacing: { after: 80 } },
        { type: 'paragraph', text: 'Body text for the introduction.', style: 'Body' },
        { type: 'paragraph', text: 'Methodology', style: 'Heading1', align: 'center', spacing: { after: 80 } },
        { type: 'paragraph', text: 'Body text for the methodology.', style: 'Body' },
        { type: 'paragraph', text: 'Result and Discussion', style: 'Heading1', align: 'center', spacing: { after: 80 } },
        { type: 'paragraph', text: 'Body text for the results.', style: 'Body' },
        { type: 'paragraph', text: 'Conclusion', style: 'Heading1', align: 'center', spacing: { after: 80 } },
        { type: 'paragraph', text: 'Body text for the conclusion.', style: 'Body' },
        { type: 'paragraph', text: 'References', style: 'Heading5', align: 'center', spacing: { after: 80 } },
        { type: 'paragraph', text: '[1] A reference entry.', style: 'Body' },
    ];
}

export async function buildDocx({
    body = compliantBody(),
    styles = COMPLIANT_STYLES,
    section = COMPLIANT_SECTION,
    docDefaults = { rPr: { font: 'Times New Roman', sizeHalfPt: 20 }, pPr: { align: 'justify' } },
} = {}) {
    const bodyXml = body.map((item) => (
        item.type === 'table' ? tableXml(item.rows) : paragraphXml(item)
    )).join('');

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <w:document ${W_NS}><w:body>${bodyXml}${sectPrXml(section)}</w:body></w:document>`;

    const zip = new JSZip();
    zip.file('[Content_Types].xml', contentTypesXml());
    zip.file('_rels/.rels', packageRelsXml());
    zip.file('word/document.xml', documentXml);
    zip.file('word/styles.xml', stylesXml(styles, docDefaults));
    zip.file('word/settings.xml', settingsXml());
    zip.file('word/theme/theme1.xml', themeXml());
    zip.file('word/_rels/document.xml.rels', documentRelsXml());

    return zip.generateAsync({ type: 'nodebuffer' });
}
