import JSZip from 'jszip';
import { AppError } from '../../common/middlewares/errorHandler.js';

const MAX_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const REQUIRED_ENTRIES = ['[Content_Types].xml', 'word/document.xml'];

function invalidFile(message) {
    return new AppError(message, 400, null, 'INVALID_FILE');
}

export async function loadDocx(buffer) {
    if (
        !Buffer.isBuffer(buffer)
        || buffer.length < 4
        || buffer[0] !== 0x50
        || buffer[1] !== 0x4b
        || buffer[2] !== 0x03
        || buffer[3] !== 0x04
    ) {
        throw invalidFile('Berkas bukan DOCX/ZIP yang valid.');
    }

    let zip;
    try {
        zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
    } catch {
        throw invalidFile('Berkas DOCX tidak dapat dibaca.');
    }

    const entries = Object.entries(zip.files).filter(([, file]) => !file.dir);

    if (entries.length > MAX_ENTRIES) {
        throw invalidFile('Jumlah entri di dalam DOCX melebihi batas aman.');
    }

    let totalUncompressed = 0;
    for (const [name, file] of entries) {
        if (name.includes('..') || name.startsWith('/')) {
            throw invalidFile('Struktur path di dalam DOCX tidak aman.');
        }

        totalUncompressed += Number(file?._data?.uncompressedSize) || 0;
    }

    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
        throw invalidFile('Ukuran dekompresi DOCX melebihi batas aman.');
    }

    for (const required of REQUIRED_ENTRIES) {
        if (!zip.file(required)) {
            throw invalidFile(`DOCX tidak memiliki entry wajib: ${required}.`);
        }
    }

    const contentTypes = await zip.file('[Content_Types].xml').async('string');
    if (!/wordprocessingml\.document/.test(contentTypes)) {
        throw invalidFile('Berkas ZIP bukan dokumen WordprocessingML (.docx).');
    }

    return {
        zip,
        async read(name, { required = false } = {}) {
            const file = zip.file(name);
            if (!file) {
                if (required) {
                    throw invalidFile(`DOCX tidak memiliki entry wajib: ${name}.`);
                }
                return null;
            }
            return file.async('string');
        },
    };
}
