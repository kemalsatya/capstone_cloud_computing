import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/database.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '..', 'migrations');

const MIGRATIONS = [
    '001_add_keycloak_auth.sql',
    '002_prd_format_foundation.sql',
];

async function main() {
    for (const filename of MIGRATIONS) {
        const filePath = path.join(migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf8');

        console.log(`[migrate] Applying ${filename}`);
        await pool.query(sql);
        console.log(`[migrate] Applied ${filename}`);
    }
}

main()
    .then(async () => {
        await pool.end();
        console.log('[migrate] All migrations applied.');
    })
    .catch(async (err) => {
        console.error('[migrate] Failed:', err.message);
        await pool.end().catch(() => {});
        process.exit(1);
    });
