import { AppError } from '../../common/middlewares/errorHandler.js';
import { loadDocx } from './docx-zip.js';
import { buildStyleModel } from './styles.js';
import { extractContent } from './content.js';
import { firstChild, parseXml, rootElement } from './xml.js';

function findDocumentBody(documentXml) {
    const parsed = parseXml(documentXml);
    const documentNode = rootElement(parsed, 'document');
    if (!documentNode) return null;
    return firstChild(documentNode, 'w:body');
}

function bodySectionIndex(content) {
    const introduction = content.paragraphs.find(
        (paragraph) => paragraph.isHeading && paragraph.normalizedHeading === 'introduction'
    );

    if (introduction) return introduction.sectionIndex;

    const firstBodyParagraph = content.paragraphs.find(
        (paragraph) => paragraph.roles?.includes('body')
    );

    if (firstBodyParagraph) return firstBodyParagraph.sectionIndex;

    return content.sections.length > 1 ? 1 : 0;
}

export async function parseDocx(buffer) {
    const { read } = await loadDocx(buffer);
    const documentXml = await read('word/document.xml', { required: true });
    const stylesXml = await read('word/styles.xml');
    const themeXml = (await read('word/theme/theme1.xml'))
        || (await read('word/theme/theme.xml'));

    const body = findDocumentBody(documentXml);
    if (!body) {
        throw new AppError('DOCX tidak memiliki body dokumen.', 400, null, 'INVALID_FILE');
    }

    const styleModel = buildStyleModel(stylesXml, themeXml);
    const content = extractContent(body, styleModel);

    return {
        ...content,
        bodySectionIndex: bodySectionIndex(content),
        styleModel,
        meta: {
            paragraphCount: content.paragraphs.length,
            sectionCount: content.sections.length,
        },
    };
}

export async function validateDocx(buffer) {
    const { zip } = await loadDocx(buffer);
    return {
        entryCount: Object.keys(zip.files).length,
    };
}
