import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultRuleConfig } from './catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultsPath = path.join(here, 'default-rules.json');

function loadDefaultRules() {
    try {
        return JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
    } catch {
        return defaultRuleConfig();
    }
}

export const DEFAULT_RULES = loadDefaultRules();
