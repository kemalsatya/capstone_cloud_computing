function roleParagraphs(document, role) {
    return (document.roles?.[role] || [])
        .map((index) => document.paragraphs[index])
        .filter(Boolean);
}

function firstTextParagraph(paragraphs) {
    return paragraphs.find((paragraph) => !paragraph.empty) || paragraphs[0] || null;
}

function sectionLocation(section) {
    return { section: section.index + 1 };
}

function paragraphLocation(paragraph) {
    return {
        paragraph: paragraph.index + 1,
        section: paragraph.sectionIndex + 1,
    };
}

const SECTION_ALIASES = {
    introduction: ['introduction', 'pendahuluan'],
    methodology: ['methodology', 'method', 'methods', 'metodologi'],
    'result and discussion': [
        'result and discussion',
        'results and discussion',
        'result & discussion',
        'hasil dan pembahasan',
    ],
    conclusion: ['conclusion', 'conclusions', 'kesimpulan'],
    references: ['references', 'daftar pustaka', 'bibliography', 'referensi'],
};

function matchesSectionName(normalizedHeading, names) {
    return names.some(
        (name) => normalizedHeading === name
            || normalizedHeading.startsWith(`${name} `)
            || normalizedHeading.startsWith(`${name}:`)
    );
}

export const RULES = {
    'FMT-001': {
        id: 'FMT-001',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: { width_twips: 11906, height_twips: 16838 },
        evaluate(document, params) {
            const findings = [];

            for (const section of document.sections) {
                const actual = {
                    width_twips: section.page.width_twips,
                    height_twips: section.page.height_twips,
                };

                if (actual.width_twips !== params.width_twips
                    || actual.height_twips !== params.height_twips) {
                    findings.push({
                        message: `Ukuran kertas section ${section.index + 1} tidak sesuai ketentuan.`,
                        location: sectionLocation(section),
                        expected: {
                            width_twips: params.width_twips,
                            height_twips: params.height_twips,
                        },
                        actual,
                    });
                }
            }

            return findings;
        },
    },

    'FMT-002': {
        id: 'FMT-002',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: {
            top: 1080,
            right: 907,
            bottom: 1440,
            left: 907,
            scope: 'body',
        },
        evaluate(document, params) {
            const findings = [];
            const labels = { top: 'atas', right: 'kanan', bottom: 'bawah', left: 'kiri' };
            const keys = ['top', 'right', 'bottom', 'left'];
            const sections = params.scope === 'all'
                ? document.sections
                : [document.sections[document.bodySectionIndex]].filter(Boolean);

            for (const section of sections) {
                for (const key of keys) {
                    if (params[key] === undefined || params[key] === null) continue;

                    const actualValue = section.margins[key];
                    if (actualValue !== params[key]) {
                        findings.push({
                            message: `Margin ${labels[key]} tidak sesuai ketentuan.`,
                            location: sectionLocation(section),
                            expected: { [key]: params[key] },
                            actual: { [key]: actualValue },
                        });
                    }
                }
            }

            return findings;
        },
    },

    'FMT-003': {
        id: 'FMT-003',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: { body_columns: 2 },
        evaluate(document, params) {
            const section = document.sections[document.bodySectionIndex] || document.sections[0];
            if (!section) return [];

            const actual = section.columns.num ?? 1;
            if (actual === params.body_columns) return [];

            return [{
                message: 'Jumlah kolom body tidak sesuai ketentuan.',
                location: sectionLocation(section),
                expected: { body_columns: params.body_columns },
                actual: { body_columns: actual },
            }];
        },
    },

    'FMT-004': {
        id: 'FMT-004',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: { styles: {} },
        evaluate(document, params) {
            const findings = [];
            const styles = params.styles || {};

            for (const [role, expected] of Object.entries(styles)) {
                const paragraph = firstTextParagraph(roleParagraphs(document, role));
                if (!paragraph) continue;

                const actual = {
                    font: paragraph.effective?.rPr?.font ?? null,
                    size_halfpt: paragraph.effective?.rPr?.sizeHalfPt ?? null,
                };

                const fontMismatch = Boolean(expected.font)
                    && Boolean(actual.font)
                    && String(expected.font).toLowerCase() !== String(actual.font).toLowerCase();
                const sizeMismatch = expected.size_halfpt !== undefined
                    && expected.size_halfpt !== null
                    && actual.size_halfpt !== expected.size_halfpt;

                if (!fontMismatch && !sizeMismatch) continue;

                const parts = [];
                if (fontMismatch) parts.push('font');
                if (sizeMismatch) parts.push('ukuran font');

                findings.push({
                    message: `Peran "${role}" memakai ${parts.join(' dan ')} yang tidak sesuai ketentuan.`,
                    location: paragraphLocation(paragraph),
                    expected: { ...expected },
                    actual,
                });
            }

            return findings;
        },
    },

    'FMT-005': {
        id: 'FMT-005',
        tier: 1,
        defaultSeverity: 'warning',
        defaultParams: { paragraph: {} },
        evaluate(document, params) {
            const findings = [];
            const paragraphParams = params.paragraph || {};

            for (const [role, expected] of Object.entries(paragraphParams)) {
                const paragraph = firstTextParagraph(roleParagraphs(document, role));
                if (!paragraph) continue;

                const actual = {
                    align: paragraph.alignment ?? null,
                    line: paragraph.spacing?.line ?? null,
                    after: paragraph.spacing?.after ?? null,
                };

                const mismatches = [];
                if (expected.align !== undefined && expected.align !== null
                    && actual.align !== expected.align) {
                    mismatches.push('alignment');
                }
                if (expected.line !== undefined && expected.line !== null
                    && actual.line !== expected.line) {
                    mismatches.push('spasi baris');
                }
                if (expected.after !== undefined && expected.after !== null
                    && actual.after !== expected.after) {
                    mismatches.push('spasi setelah paragraf');
                }

                if (mismatches.length === 0) continue;

                findings.push({
                    message: `Peran "${role}" memiliki ${mismatches.join(', ')} yang tidak sesuai ketentuan.`,
                    location: paragraphLocation(paragraph),
                    expected: { ...expected },
                    actual,
                });
            }

            return findings;
        },
    },

    'FMT-006': {
        id: 'FMT-006',
        tier: 1,
        defaultSeverity: 'warning',
        defaultParams: { heading_style_required: true },
        evaluate(document, params) {
            if (!params.heading_style_required) return [];

            return document.paragraphs
                .filter((paragraph) => paragraph.looksLikeHeading && !paragraph.isHeading)
                .filter((paragraph) => !paragraph.roles?.includes('references'))
                .map((paragraph) => ({
                    message: `Heading "${paragraph.text.trim()}" tidak memakai style Word Heading 1–5.`,
                    location: paragraphLocation(paragraph),
                    expected: { heading_style: 'Heading 1–5' },
                    actual: { style: paragraph.styleName || paragraph.styleId || '(tidak ada)' },
                }));
        },
    },

    'FMT-007': {
        id: 'FMT-007',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: {
            required_sections: [
                'introduction',
                'methodology',
                'result and discussion',
                'conclusion',
                'references',
            ],
        },
        evaluate(document, params) {
            const findings = [];
            const headings = document.paragraphs.filter((paragraph) => paragraph.isHeading);
            const positions = [];

            for (const required of params.required_sections || []) {
                const names = SECTION_ALIASES[required] || [required];
                const heading = headings.find(
                    (paragraph) => matchesSectionName(paragraph.normalizedHeading, names)
                );

                if (!heading) {
                    findings.push({
                        message: `Section wajib "${required}" tidak ditemukan.`,
                        location: {},
                        expected: { section: required },
                        actual: null,
                    });
                    continue;
                }

                positions.push({ required, index: heading.index, text: heading.text.trim() });
            }

            let previousIndex = -1;
            for (const position of positions) {
                if (position.index < previousIndex) {
                    findings.push({
                        message: `Urutan section tidak sesuai: "${position.required}" muncul terlalu awal.`,
                        location: { paragraph: position.index + 1 },
                        expected: { order: params.required_sections },
                        actual: { section: position.required },
                    });
                }
                previousIndex = position.index;
            }

            return findings;
        },
    },

    'FMT-008': {
        id: 'FMT-008',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: { abstract: { min_words: 100, max_words: 200 } },
        evaluate(document, params) {
            const range = params.abstract || params;

            if (!document.abstract?.found) {
                return [{
                    message: 'Abstrak tidak ditemukan.',
                    location: {},
                    expected: { min_words: range.min_words, max_words: range.max_words },
                    actual: { found: false },
                }];
            }

            const wordCount = document.abstract.wordCount;

            if (wordCount < range.min_words || wordCount > range.max_words) {
                return [{
                    message: `Jumlah kata abstrak (${wordCount}) di luar rentang ${range.min_words}–${range.max_words} kata.`,
                    location: { paragraph: (document.abstract.paragraphIndex ?? 0) + 1 },
                    expected: { min_words: range.min_words, max_words: range.max_words },
                    actual: { word_count: wordCount },
                }];
            }

            return [];
        },
    },

    'FMT-009': {
        id: 'FMT-009',
        tier: 1,
        defaultSeverity: 'error',
        defaultParams: { keywords: { min: 3, max: 5 } },
        evaluate(document, params) {
            const range = params.keywords || params;

            if (!document.keywords?.found) {
                return [{
                    message: 'Kata kunci tidak ditemukan.',
                    location: {},
                    expected: { min: range.min, max: range.max },
                    actual: { found: false },
                }];
            }

            const count = document.keywords.count;

            if (count < range.min || count > range.max) {
                return [{
                    message: `Jumlah kata kunci (${count}) di luar rentang ${range.min}–${range.max}.`,
                    location: { paragraph: (document.keywords.paragraphIndex ?? 0) + 1 },
                    expected: { min: range.min, max: range.max },
                    actual: { count },
                }];
            }

            return [];
        },
    },
};

export const RULE_IDS = Object.keys(RULES);

export function defaultRuleConfig() {
    return {
        schema_version: 1,
        rules: RULE_IDS.map((id) => ({
            id,
            enabled: true,
            severity: RULES[id].defaultSeverity,
            params: structuredClone(RULES[id].defaultParams),
        })),
    };
}
