import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';

export class LocalStorage {
    constructor({ root = env.UPLOAD_DIR } = {}) {
        this.root = path.resolve(process.cwd(), root);
    }

    resolveKey(key) {
        const normalized = path.normalize(String(key || '')).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.resolve(this.root, normalized);

        if (fullPath !== this.root && !fullPath.startsWith(`${this.root}${path.sep}`)) {
            throw new Error('Object key tidak aman.');
        }

        return fullPath;
    }

    async put(key, buffer) {
        const fullPath = this.resolveKey(key);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, buffer);
        return key;
    }

    async get(key) {
        return fs.readFile(this.resolveKey(key));
    }

    async delete(key) {
        await fs.rm(this.resolveKey(key), { force: true });
    }

    async exists(key) {
        try {
            await fs.access(this.resolveKey(key));
            return true;
        } catch {
            return false;
        }
    }
}
