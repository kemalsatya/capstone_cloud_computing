import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
});

export function parseXml(xml) {
    return parser.parse(xml);
}

export function isTextNode(node) {
    return Boolean(node && typeof node === 'object' && '#text' in node);
}

export function elementTag(node) {
    if (!node || typeof node !== 'object') return null;

    for (const key of Object.keys(node)) {
        if (key !== ':@' && key !== '#text') return key;
    }

    return null;
}

export function tagName(node) {
    return isTextNode(node) ? '#text' : elementTag(node);
}

export function localName(name) {
    return name ? String(name).split(':').pop() : name;
}

export function attributes(node) {
    return node?.[':@'] || {};
}

function normalizedAttributeName(name) {
    return localName(String(name).replace(/^@_/, ''));
}

export function attr(node, name) {
    if (!node) return undefined;
    const attrs = attributes(node);
    if (name in attrs) return attrs[name];

    const wanted = normalizedAttributeName(name);
    for (const [key, value] of Object.entries(attrs)) {
        if (normalizedAttributeName(key) === wanted) return value;
    }

    return undefined;
}

export function children(node) {
    const tag = elementTag(node);
    return tag ? node[tag] || [] : [];
}

export function childrenNamed(node, name) {
    const wanted = localName(name);
    return children(node).filter((child) => localName(tagName(child)) === wanted);
}

export function firstChild(node, name) {
    return childrenNamed(node, name)[0] || null;
}

export function descendants(node, name, acc = []) {
    const wanted = localName(name);

    for (const child of children(node)) {
        if (localName(tagName(child)) === wanted) acc.push(child);
        descendants(child, name, acc);
    }

    return acc;
}

export function rootElement(parsed, name) {
    const wanted = localName(name);
    return (parsed || []).find((node) => localName(elementTag(node)) === wanted) || null;
}

export function textOf(node) {
    if (!node) return '';
    if (isTextNode(node)) return String(node['#text'] ?? '');

    const tag = elementTag(node);
    if (!tag) return '';

    const local = localName(tag);
    if (local === 'tab') return '\t';
    if (local === 'br' || local === 'cr') return '\n';
    if (local === 'noBreakHyphen') return '-';

    let text = '';
    for (const child of node[tag] || []) {
        text += textOf(child);
    }
    return text;
}
