import {
    attr,
    childrenNamed,
    firstChild,
    parseXml,
    rootElement,
} from './xml.js';

function numberAttr(node, name) {
    const value = attr(node, name);
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function onOff(node) {
    if (!node) return undefined;
    const value = attr(node, 'w:val');
    if (value === undefined) return true;
    return !['0', 'false', 'off', 'none'].includes(String(value).toLowerCase());
}

function normalizeAlignment(value) {
    if (!value) return null;
    const normalized = String(value).toLowerCase();
    if (normalized === 'both') return 'justify';
    if (normalized === 'distribute') return 'justify';
    return normalized;
}

export function readRunProps(rPr) {
    if (!rPr) return {};

    const props = {};
    const fonts = firstChild(rPr, 'w:rFonts');

    if (fonts) {
        props.font = attr(fonts, 'w:ascii')
            || attr(fonts, 'w:hAnsi')
            || attr(fonts, 'w:cs')
            || attr(fonts, 'w:eastAsia')
            || null;
        props.fontTheme = attr(fonts, 'w:asciiTheme')
            || attr(fonts, 'w:hAnsiTheme')
            || attr(fonts, 'w:csTheme')
            || attr(fonts, 'w:eastAsiaTheme')
            || null;
    }

    const size = firstChild(rPr, 'w:sz');
    if (size) props.sizeHalfPt = numberAttr(size, 'w:val');

    const bold = firstChild(rPr, 'w:b');
    if (bold) props.bold = onOff(bold);

    const italic = firstChild(rPr, 'w:i');
    if (italic) props.italic = onOff(italic);

    const underline = firstChild(rPr, 'w:u');
    if (underline) {
        const value = String(attr(underline, 'w:val') || 'single').toLowerCase();
        props.underline = value !== 'none';
    }

    const color = firstChild(rPr, 'w:color');
    if (color) props.color = attr(color, 'w:val') || null;

    const vertAlign = firstChild(rPr, 'w:vertAlign');
    if (vertAlign) props.vertAlign = attr(vertAlign, 'w:val') || null;

    return props;
}

export function readParagraphProps(pPr) {
    if (!pPr) return {};

    const props = {};

    const jc = firstChild(pPr, 'w:jc');
    if (jc) props.alignment = normalizeAlignment(attr(jc, 'w:val'));

    const spacing = firstChild(pPr, 'w:spacing');
    if (spacing) {
        const parsed = {
            before: numberAttr(spacing, 'w:before'),
            after: numberAttr(spacing, 'w:after'),
            line: numberAttr(spacing, 'w:line'),
            lineRule: attr(spacing, 'w:lineRule') || null,
        };

        if (Object.values(parsed).some((value) => value !== null)) {
            props.spacing = parsed;
        }
    }

    const outline = firstChild(pPr, 'w:outlineLvl');
    if (outline) {
        const level = numberAttr(outline, 'w:val');
        if (level !== null) props.outlineLvl = level;
    }

    const numPr = firstChild(pPr, 'w:numPr');
    if (numPr) {
        const ilvl = firstChild(numPr, 'w:ilvl');
        const numId = firstChild(numPr, 'w:numId');
        props.numbering = {
            ilvl: ilvl ? numberAttr(ilvl, 'w:val') : null,
            numId: numId ? attr(numId, 'w:val') : null,
        };
    }

    const keepNext = firstChild(pPr, 'w:keepNext');
    if (keepNext) props.keepNext = onOff(keepNext);

    return props;
}

function mergeProps(base, override) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(override || {})) {
        if (value === undefined || value === null) continue;

        if (key === 'spacing' && typeof value === 'object') {
            merged.spacing = { ...(base.spacing || {}), ...value };
        } else {
            merged[key] = value;
        }
    }

    return merged;
}

function parseThemeFonts(themeXml) {
    if (!themeXml) return { major: null, minor: null };

    const theme = rootElement(parseXml(themeXml), 'theme');
    if (!theme) return { major: null, minor: null };

    const themeElements = firstChild(theme, 'a:themeElements') || firstChild(theme, 'w:themeElements');
    const fontScheme = themeElements
        ? firstChild(themeElements, 'a:fontScheme') || firstChild(themeElements, 'w:fontScheme')
        : null;

    if (!fontScheme) return { major: null, minor: null };

    const minorFont = firstChild(fontScheme, 'a:minorFont');
    const majorFont = firstChild(fontScheme, 'a:majorFont');
    const minorLatin = minorFont ? firstChild(minorFont, 'a:latin') : null;
    const majorLatin = majorFont ? firstChild(majorFont, 'a:latin') : null;

    return {
        major: majorLatin ? attr(majorLatin, 'typeface') || null : null,
        minor: minorLatin ? attr(minorLatin, 'typeface') || null : null,
    };
}

function resolveThemeFont(themeFont, themeFonts) {
    if (!themeFont) return null;
    const value = String(themeFont).toLowerCase();

    if (value.startsWith('minor')) return themeFonts.minor || null;
    if (value.startsWith('major')) return themeFonts.major || null;
    return null;
}

function resolveFont(rPr, themeFonts) {
    if (rPr.font) return rPr.font;
    const themeFont = resolveThemeFont(rPr.fontTheme, themeFonts);
    if (themeFont) return themeFont;
    return themeFonts.minor || null;
}

export function buildStyleModel(stylesXml, themeXml) {
    const model = {
        styles: new Map(),
        docDefaults: { rPr: {}, pPr: {} },
        themeFonts: parseThemeFonts(themeXml),
    };

    if (!stylesXml) return model;

    const root = rootElement(parseXml(stylesXml), 'styles');
    if (!root) return model;

    const defaults = firstChild(root, 'w:docDefaults');
    if (defaults) {
        const rPrDefault = firstChild(defaults, 'w:rPrDefault');
        const pPrDefault = firstChild(defaults, 'w:pPrDefault');
        model.docDefaults.rPr = readRunProps(rPrDefault ? firstChild(rPrDefault, 'w:rPr') : null);
        model.docDefaults.pPr = readParagraphProps(pPrDefault ? firstChild(pPrDefault, 'w:pPr') : null);
    }

    for (const styleNode of childrenNamed(root, 'w:style')) {
        const id = attr(styleNode, 'w:styleId');
        if (!id) continue;

        const nameNode = firstChild(styleNode, 'w:name');
        const basedOnNode = firstChild(styleNode, 'w:basedOn');

        model.styles.set(id, {
            id,
            type: attr(styleNode, 'w:type') || 'paragraph',
            default: attr(styleNode, 'w:default') === '1',
            name: nameNode ? attr(nameNode, 'w:val') || '' : '',
            basedOn: basedOnNode ? attr(basedOnNode, 'w:val') || null : null,
            rPr: readRunProps(firstChild(styleNode, 'w:rPr')),
            pPr: readParagraphProps(firstChild(styleNode, 'w:pPr')),
        });
    }

    return model;
}

export function resolveStyleChain(styleId, model) {
    const chain = [];
    const seen = new Set();
    let current = styleId ? model.styles.get(styleId) : null;

    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.unshift(current);
        current = current.basedOn ? model.styles.get(current.basedOn) : null;
    }

    return chain;
}

export function resolveEffectiveProps({ styleId, pPrNode, rPrNode, model }) {
    let rPr = { ...model.docDefaults.rPr };
    let pPr = { ...model.docDefaults.pPr };

    for (const style of resolveStyleChain(styleId, model)) {
        rPr = mergeProps(rPr, style.rPr);
        pPr = mergeProps(pPr, style.pPr);
    }

    const paragraphMarkRPr = pPrNode ? firstChild(pPrNode, 'w:rPr') : null;

    pPr = mergeProps(pPr, readParagraphProps(pPrNode));
    rPr = mergeProps(rPr, readRunProps(paragraphMarkRPr));
    rPr = mergeProps(rPr, readRunProps(rPrNode));

    return {
        rPr: { ...rPr, font: resolveFont(rPr, model.themeFonts) },
        pPr,
    };
}

export function styleNameFor(styleId, model) {
    return styleId ? model.styles.get(styleId)?.name || '' : '';
}

export function normalizeStyleKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

export function styleOutlineLevel(styleId, model) {
    for (const style of resolveStyleChain(styleId, model)) {
        if (typeof style.pPr?.outlineLvl === 'number') return style.pPr.outlineLvl;
    }
    return null;
}
