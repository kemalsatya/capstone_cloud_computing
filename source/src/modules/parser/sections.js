import { attr, firstChild } from './xml.js';

function numberAttr(node, name) {
    if (!node) return null;
    const value = attr(node, name);
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function readSectionProperties(sectPr) {
    const page = { width_twips: null, height_twips: null, orientation: null };
    const margins = {
        top: null,
        right: null,
        bottom: null,
        left: null,
        header: null,
        footer: null,
        gutter: null,
    };
    const columns = { num: 1, space: null, equalWidth: null, separator: null };

    if (!sectPr) {
        return { page, margins, columns, hasProperties: false };
    }

    const pgSz = firstChild(sectPr, 'w:pgSz');
    if (pgSz) {
        page.width_twips = numberAttr(pgSz, 'w:w');
        page.height_twips = numberAttr(pgSz, 'w:h');
        page.orientation = attr(pgSz, 'w:orient') || null;
    }

    const pgMar = firstChild(sectPr, 'w:pgMar');
    if (pgMar) {
        margins.top = numberAttr(pgMar, 'w:top');
        margins.right = numberAttr(pgMar, 'w:right');
        margins.bottom = numberAttr(pgMar, 'w:bottom');
        margins.left = numberAttr(pgMar, 'w:left');
        margins.header = numberAttr(pgMar, 'w:header');
        margins.footer = numberAttr(pgMar, 'w:footer');
        margins.gutter = numberAttr(pgMar, 'w:gutter');
    }

    const cols = firstChild(sectPr, 'w:cols');
    if (cols) {
        columns.num = numberAttr(cols, 'w:num') ?? 1;
        columns.space = numberAttr(cols, 'w:space');
        columns.equalWidth = attr(cols, 'w:equalWidth') === undefined
            ? null
            : attr(cols, 'w:equalWidth') !== '0';
        columns.separator = attr(cols, 'w:sep') === undefined
            ? null
            : attr(cols, 'w:sep') !== '0';
    }

    return { page, margins, columns, hasProperties: true };
}

export function buildSections(breaks, bodyLength) {
    if (!breaks.length) {
        return [{
            index: 0,
            startBodyPosition: 0,
            endBodyPosition: Math.max(0, bodyLength - 1),
            ...readSectionProperties(null),
        }];
    }

    const sorted = [...breaks].sort((a, b) => a.bodyPosition - b.bodyPosition);
    const sections = [];
    let previousEnd = -1;

    for (const item of sorted) {
        const start = previousEnd + 1;
        const end = Math.max(item.bodyPosition, start);
        const props = readSectionProperties(item.sectPr);

        sections.push({
            index: sections.length,
            startBodyPosition: start,
            endBodyPosition: end,
            ...props,
        });

        previousEnd = end;
    }

    if (previousEnd < bodyLength - 1) {
        const last = sections.at(-1);
        sections.push({
            index: sections.length,
            startBodyPosition: previousEnd + 1,
            endBodyPosition: Math.max(previousEnd + 1, bodyLength - 1),
            page: { ...last.page },
            margins: { ...last.margins },
            columns: { ...last.columns },
            hasProperties: last.hasProperties,
        });
    }

    return sections;
}

export function assignSectionIndexes(paragraphs, sections) {
    for (const paragraph of paragraphs) {
        let match = sections.find(
            (section) => paragraph.bodyPosition >= section.startBodyPosition
                && paragraph.bodyPosition <= section.endBodyPosition
        );

        if (!match) match = sections.at(-1);
        paragraph.sectionIndex = match ? match.index : 0;
    }

    return paragraphs;
}

export function sectionForParagraph(paragraph, sections) {
    return sections[paragraph.sectionIndex] || sections[0] || null;
}
