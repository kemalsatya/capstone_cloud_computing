import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, query } from '../src/config/database.js';

const ZERO_SHA = '0'.repeat(64);

async function main() {
    const backupDir = path.resolve(
        process.argv[2] || process.env.BACKUP_DIR || 'garage-backup'
    );
    const manifest = JSON.parse(
        await fs.readFile(path.join(backupDir, 'manifest.json'), 'utf8')
    );
    const objects = new Map(
        (manifest.objects || []).map((object) => [object.key, object.sha256])
    );

    const counts = await query(
        `SELECT
            (SELECT COUNT(*) FROM tenants)::int AS tenants,
            (SELECT COUNT(*) FROM users)::int AS users,
            (SELECT COUNT(*) FROM format_rule_templates)::int AS rule_templates,
            (SELECT COUNT(*) FROM manuscripts)::int AS manuscripts,
            (SELECT COUNT(*) FROM check_results)::int AS check_results,
            (SELECT COUNT(*) FROM findings)::int AS findings`
    );

    const manuscripts = await query(
        `SELECT id, tenant_id, sha256 FROM manuscripts ORDER BY id`
    );
    const templates = await query(
        `SELECT id, tenant_id, template_sha256 FROM format_rule_templates ORDER BY id`
    );

    const mismatches = [];
    let compared = 0;

    for (const row of manuscripts.rows) {
        const key = `tenants/${row.tenant_id}/manuscripts/${row.id}.docx`;
        if (!objects.has(key)) continue;

        compared += 1;
        if (objects.get(key) !== row.sha256) {
            mismatches.push({ key, expected: row.sha256, actual: objects.get(key) });
        }
    }

    for (const row of templates.rows) {
        if (!row.template_sha256 || row.template_sha256 === ZERO_SHA) continue;

        const key = `tenants/${row.tenant_id}/templates/${row.id}.docx`;
        if (!objects.has(key)) continue;

        compared += 1;
        if (objects.get(key) !== row.template_sha256) {
            mismatches.push({
                key,
                expected: row.template_sha256,
                actual: objects.get(key),
            });
        }
    }

    const summary = {
        backup_dir: backupDir,
        bucket: manifest.bucket,
        counts: counts.rows[0],
        objects_in_manifest: objects.size,
        objects_compared: compared,
        mismatches,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (mismatches.length > 0) {
        process.exitCode = 1;
    }
}

main()
    .catch((err) => {
        console.error('[verify-restore] Gagal:', err.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end().catch(() => {});
    });
