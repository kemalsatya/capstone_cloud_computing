import {
    attr,
    children,
    childrenNamed,
    firstChild,
    localName,
    tagName,
    textOf,
} from './xml.js';
import {
    normalizeStyleKey,
    resolveEffectiveProps,
    styleNameFor,
    styleOutlineLevel,
} from './styles.js';
import { assignSectionIndexes, buildSections } from './sections.js';

const KNOWN_HEADINGS = [
    'introduction',
    'methodology',
    'method',
    'methods',
    'result and discussion',
    'results and discussion',
    'result & discussion',
    'conclusion',
    'conclusions',
    'references',
    'daftar pustaka',
    'bibliography',
    'acknowledgment',
    'acknowledgements',
];

const CAPTION_PATTERN = /^\s*(?:Fig\.?|Figure|TABLE|Table|Gambar|Tabel)\s+(?:[IVXLC]+|\d+)[.:)]?\s+/i;

export function normalizeHeadingText(text) {
    return String(text || '')
        .replace(/^\s*(?:[IVXLCDM]+|\d+(?:\.\d+)*)[.)]?\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function detectHeadingLevel(styleId, styleName, outlineLvl) {
    const name = normalizeStyleKey(styleName);
    const id = normalizeStyleKey(styleId);

    for (let level = 1; level <= 5; level += 1) {
        if (name === `heading${level}` || name === `judul${level}`) return level;
        if (id === `heading${level}` || id === `judul${level}`) return level;
    }

    const nameMatch = name.match(/heading([1-5])/);
    if (nameMatch) return Number(nameMatch[1]);

    if (typeof outlineLvl === 'number' && outlineLvl >= 0 && outlineLvl <= 4) {
        return outlineLvl + 1;
    }

    return null;
}

export function detectManualNumbering(text) {
    const match = String(text || '').match(/^\s*((?:[IVXLCDM]+|\d+(?:\.\d+)*))[.)]\s+/i);
    return match ? { prefix: match[1], raw: match[0].trim() } : null;
}

function looksLikeHeading(paragraph) {
    if (paragraph.isHeading || paragraph.empty) return false;

    const text = paragraph.text.trim();
    if (text.length > 160) return false;
    if (/[.!?]\s*$/.test(text)) return false;

    const normalized = paragraph.normalizedHeading;
    const isKnown = KNOWN_HEADINGS.some(
        (name) => normalized === name || normalized.startsWith(`${name} `) || normalized.startsWith(`${name}:`)
    );
    const hasNumber = /^\s*(?:[IVXLCDM]+|\d+(?:\.\d+)*)[.)]\s+\S/i.test(text);

    return isKnown || hasNumber;
}

function collectRuns(node, styleModel, styleId, pPrNode) {
    const runs = [];

    function visit(current) {
        const local = localName(tagName(current));
        if (!local) return;

        if (local === 'r') {
            const text = textOf(current);
            if (text !== '') {
                const effective = resolveEffectiveProps({
                    styleId,
                    pPrNode,
                    rPrNode: firstChild(current, 'w:rPr'),
                    model: styleModel,
                });
                runs.push({ text, ...effective.rPr, effective });
            }
            return;
        }

        if (local === 'del' || local === 'pPr' || local === 'rPr') return;

        for (const child of children(current)) {
            visit(child);
        }
    }

    visit(node);
    return runs;
}

function paragraphFromNode(pNode, context) {
    const { styleModel, bodyPosition, container } = context;
    const pPrNode = firstChild(pNode, 'w:pPr');
    const styleId = attr(firstChild(pPrNode, 'w:pStyle'), 'w:val') || null;
    const styleName = styleNameFor(styleId, styleModel);
    const runs = collectRuns(pNode, styleModel, styleId, pPrNode);
    const text = runs.length ? runs.map((run) => run.text).join('') : textOf(pNode);
    const effective = runs.length
        ? runs[0].effective
        : resolveEffectiveProps({ styleId, pPrNode, rPrNode: null, model: styleModel });
    const outlineLvl = effective.pPr.outlineLvl ?? styleOutlineLevel(styleId, styleModel);
    const headingLevel = detectHeadingLevel(styleId, styleName, outlineLvl);
    const paragraph = {
        index: -1,
        bodyPosition,
        container,
        cellId: context.cellId || null,
        tableId: context.tableId ?? null,
        rowIndex: context.rowIndex ?? null,
        cellIndex: context.cellIndex ?? null,
        styleId,
        styleName,
        headingLevel,
        isHeading: headingLevel !== null,
        numbering: effective.pPr.numbering || null,
        manualNumbering: detectManualNumbering(text),
        normalizedHeading: normalizeHeadingText(text),
        looksLikeHeading: false,
        alignment: effective.pPr.alignment || null,
        spacing: effective.pPr.spacing || {},
        runs,
        effective,
        text,
        empty: text.trim() === '',
        sectionIndex: 0,
        roles: [],
    };

    paragraph.looksLikeHeading = looksLikeHeading(paragraph);
    return paragraph;
}

function flattenTable(tblNode, context, flow, state) {
    const tableId = state.nextTableId;
    state.nextTableId += 1;

    const rows = childrenNamed(tblNode, 'w:tr');

    rows.forEach((row, rowIndex) => {
        const cells = childrenNamed(row, 'w:tc');

        cells.forEach((cell, cellIndex) => {
            const cellId = `${tableId}:${rowIndex}:${cellIndex}`;
            const cellContext = {
                ...context,
                container: 'table',
                cellId,
                tableId,
                rowIndex,
                cellIndex,
            };

            for (const child of children(cell)) {
                const local = localName(tagName(child));

                if (local === 'p') {
                    flow.push(paragraphFromNode(child, cellContext));
                } else if (local === 'tbl') {
                    flattenTable(child, cellContext, flow, state);
                } else if (local === 'sdt') {
                    const content = firstChild(child, 'w:sdtContent');
                    if (!content) continue;

                    for (const inner of children(content)) {
                        const innerLocal = localName(tagName(inner));
                        if (innerLocal === 'p') {
                            flow.push(paragraphFromNode(inner, cellContext));
                        } else if (innerLocal === 'tbl') {
                            flattenTable(inner, cellContext, flow, state);
                        }
                    }
                }
            }
        });
    });
}

function createRoles() {
    return {
        title: [],
        author: [],
        abstract: [],
        body: [],
        heading1: [],
        heading2: [],
        heading3: [],
        heading4: [],
        heading5: [],
        caption: [],
        references: [],
    };
}

function findTitleAndAuthors(paragraphs) {
    const bodyParagraphs = paragraphs.filter(
        (paragraph) => paragraph.container === 'body' && !paragraph.empty
    );
    const titleParagraph = bodyParagraphs[0] || null;
    const authorParagraph = bodyParagraphs
        .slice(1)
        .find((paragraph) => !paragraph.isHeading && paragraph.tableId === null) || null;

    return {
        title: titleParagraph
            ? { text: titleParagraph.text.trim(), paragraphIndex: titleParagraph.index }
            : { text: null, paragraphIndex: null },
        authors: authorParagraph
            ? { text: authorParagraph.text.trim(), paragraphIndex: authorParagraph.index }
            : { text: null, paragraphIndex: null },
    };
}

function isStopLabel(text) {
    return /^\s*(?:keywords?|kata\s+kunci|copyright|corresponding\s+author|article\s+info|article\s+history)\b/i.test(text);
}

function isInLabelArea(label, paragraph) {
    if (label.tableId !== null && label.tableId !== undefined
        && label.cellIndex !== null && label.cellIndex !== undefined) {
        return paragraph.tableId === label.tableId && paragraph.cellIndex === label.cellIndex;
    }

    if (label.cellId) {
        return paragraph.cellId === label.cellId;
    }

    return true;
}

function collectFollowingParagraphs(paragraphs, labelIndex) {
    const label = paragraphs[labelIndex];
    const collected = [];
    const indices = [];
    const limit = Math.min(paragraphs.length, labelIndex + 60);

    for (let i = labelIndex + 1; i < limit && collected.length < 20; i += 1) {
        const paragraph = paragraphs[i];

        if (!isInLabelArea(label, paragraph)) continue;

        if (paragraph.empty) {
            if (collected.length > 0) break;
            continue;
        }

        if (paragraph.isHeading || isStopLabel(paragraph.text)) break;

        collected.push(paragraph.text.trim());
        indices.push(paragraph.index);
    }

    return { collected, indices };
}

function extractAbstract(paragraphs) {
    let labelIndex = paragraphs.findIndex((paragraph) => {
        const text = paragraph.text.trim();
        return /^abstract\b/i.test(text) && text.length < 220;
    });

    if (labelIndex === -1) {
        labelIndex = paragraphs.findIndex(
            (paragraph) => normalizeStyleKey(paragraph.styleName) === 'abstract'
        );
    }

    if (labelIndex === -1) {
        return { found: false, text: '', wordCount: 0, paragraphIndex: null, paragraphIndices: [] };
    }

    const label = paragraphs[labelIndex];
    const match = label.text.match(/^\s*abstract\b\s*(?:\([^)]*\))?\s*[:\-–—]?\s*(.*)$/is);
    const remainder = (match?.[1] || '')
        .replace(/^\s*\([^)]*\)\s*/, '')
        .trim();
    const { collected, indices } = collectFollowingParagraphs(paragraphs, labelIndex);
    const parts = [remainder, ...collected].filter(Boolean);
    const text = parts.join('\n').trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

    return {
        found: text.length > 0,
        text,
        wordCount,
        paragraphIndex: label.index,
        paragraphIndices: indices,
    };
}

function extractKeywords(paragraphs) {
    const labelIndex = paragraphs.findIndex((paragraph) => {
        const text = paragraph.text.trim();
        return /^\s*(?:keywords?|kata\s+kunci)\b/i.test(text) && text.length < 220;
    });

    if (labelIndex === -1) {
        return { found: false, values: [], count: 0, paragraphIndex: null, paragraphIndices: [] };
    }

    const label = paragraphs[labelIndex];
    const match = label.text.match(/^\s*(?:keywords?|kata\s+kunci)\b\s*[:\-–—]?\s*(.*)$/is);
    const remainder = (match?.[1] || '').trim();
    const { collected, indices } = collectFollowingParagraphs(paragraphs, labelIndex);
    const combined = [remainder, ...collected].filter(Boolean).join('\n');

    const values = combined
        .split(/\n|;|,/)
        .map((value) => value.replace(/^\s*(?:keywords?|kata\s+kunci)\s*[:\-–—]?\s*/i, '').trim())
        .map((value) => value.replace(/[.;]+$/, '').trim())
        .filter(Boolean);

    return {
        found: values.length > 0,
        values,
        count: values.length,
        paragraphIndex: label.index,
        paragraphIndices: indices,
    };
}

function assignRoles(paragraphs, { title, authors, abstract, keywords }) {
    const roles = createRoles();

    if (title.paragraphIndex !== null) roles.title.push(title.paragraphIndex);
    if (authors.paragraphIndex !== null) roles.author.push(authors.paragraphIndex);

    for (const index of abstract.paragraphIndices) {
        if (!roles.abstract.includes(index)) roles.abstract.push(index);
    }

    for (const paragraph of paragraphs) {
        if (paragraph.headingLevel) {
            roles[`heading${paragraph.headingLevel}`]?.push(paragraph.index);
        }

        if (CAPTION_PATTERN.test(paragraph.text) || /caption/i.test(paragraph.styleName)) {
            roles.caption.push(paragraph.index);
        }
    }

    const introduction = paragraphs.find(
        (paragraph) => paragraph.isHeading && paragraph.normalizedHeading === 'introduction'
    );
    const referencesHeading = paragraphs.find(
        (paragraph) => paragraph.isHeading
            && ['references', 'daftar pustaka', 'bibliography'].includes(paragraph.normalizedHeading)
    );

    const referencesStart = referencesHeading ? referencesHeading.index : Number.POSITIVE_INFINITY;

    if (referencesHeading) {
        for (const paragraph of paragraphs) {
            if (paragraph.index <= referencesHeading.index) continue;
            if (paragraph.container !== 'body' || paragraph.empty || paragraph.isHeading) continue;
            roles.references.push(paragraph.index);
        }
    }

    const bodyStart = introduction ? introduction.index + 1 : 0;
    const excluded = new Set([
        ...roles.title,
        ...roles.author,
        ...roles.abstract,
        ...roles.caption,
        ...roles.references,
        ...roles.heading1,
        ...roles.heading2,
        ...roles.heading3,
        ...roles.heading4,
        ...roles.heading5,
    ]);

    for (const paragraph of paragraphs) {
        if (paragraph.container !== 'body') continue;
        if (paragraph.index < bodyStart || paragraph.index >= referencesStart) continue;
        if (paragraph.empty || paragraph.isHeading || excluded.has(paragraph.index)) continue;
        if (CAPTION_PATTERN.test(paragraph.text) || /caption/i.test(paragraph.styleName)) continue;
        roles.body.push(paragraph.index);
    }

    for (const paragraph of paragraphs) {
        paragraph.roles = Object.entries(roles)
            .filter(([, indices]) => indices.includes(paragraph.index))
            .map(([role]) => role);
    }

    return roles;
}

export function extractContent(bodyNode, styleModel) {
    const bodyChildren = children(bodyNode);
    const bodyLength = bodyChildren.length;
    const flow = [];
    const breaks = [];
    const state = { nextTableId: 1 };

    function visitBodyNode(node, bodyPosition) {
        const local = localName(tagName(node));

        if (local === 'p') {
            flow.push(paragraphFromNode(node, {
                styleModel,
                bodyPosition,
                container: 'body',
            }));

            const pPr = firstChild(node, 'w:pPr');
            const sectPr = pPr ? firstChild(pPr, 'w:sectPr') : null;
            if (sectPr) breaks.push({ bodyPosition, sectPr });
            return;
        }

        if (local === 'tbl') {
            flattenTable(node, { styleModel, bodyPosition, container: 'body' }, flow, state);
            return;
        }

        if (local === 'sdt') {
            const content = firstChild(node, 'w:sdtContent');
            if (content) {
                for (const inner of children(content)) visitBodyNode(inner, bodyPosition);
            }
            return;
        }

        if (local === 'sectPr') {
            breaks.push({ bodyPosition: Math.max(0, bodyLength - 1), sectPr: node });
        }
    }

    bodyChildren.forEach((child, bodyPosition) => visitBodyNode(child, bodyPosition));

    const sections = buildSections(breaks, bodyLength);
    flow.forEach((paragraph, index) => {
        paragraph.index = index;
    });
    assignSectionIndexes(flow, sections);

    const titleAndAuthors = findTitleAndAuthors(flow);
    const abstract = extractAbstract(flow);
    const keywords = extractKeywords(flow);
    const roles = assignRoles(flow, {
        title: titleAndAuthors.title,
        authors: titleAndAuthors.authors,
        abstract,
        keywords,
    });

    return {
        bodyLength,
        sections,
        paragraphs: flow,
        roles,
        title: titleAndAuthors.title,
        authors: titleAndAuthors.authors,
        abstract,
        keywords,
    };
}
