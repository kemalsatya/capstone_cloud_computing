import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '..', '..');
const uploadDir = path.join(os.tmpdir(), `journalfit-test-uploads-${process.pid}`);

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export function applyTestEnv() {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.AUTH_MODE = 'mock';
    process.env.NODE_ENV = 'test';
    process.env.UPLOAD_DIR = uploadDir;
}

async function readSql(filePath) {
    return fs.readFile(filePath, 'utf8');
}

async function seedManuscript(pool, {
    id,
    tenantId,
    authorId,
    templateId,
    title,
}) {
    const objectKey = `tenants/${tenantId}/manuscripts/${id}.docx`;

    await pool.query(
        `INSERT INTO manuscripts (
            id, tenant_id, author_id, rule_template_id, revision_no, title,
            file_path, object_key, original_filename, size_bytes, sha256, status,
            created_at, updated_at
         ) VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,100,repeat('a',64),'completed',now(),now())
         ON CONFLICT (id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
                author_id = EXCLUDED.author_id,
                rule_template_id = EXCLUDED.rule_template_id,
                title = EXCLUDED.title,
                status = EXCLUDED.status,
                updated_at = now()`,
        [id, tenantId, authorId, templateId, title, objectKey, objectKey, `${id}.docx`]
    );

    await pool.query(
        `INSERT INTO check_results (
            id, tenant_id, manuscript_id, check_type, status, rule_template_id,
            summary, attempt_count, outcome, finished_at, created_at
         ) VALUES ($1,$2,$3,'format','completed',$4,'{}'::jsonb,0,'passed',now(),now())
         ON CONFLICT (manuscript_id, check_type) DO UPDATE
            SET status = 'completed', outcome = 'passed'`,
        [`cr-${id}-format`, tenantId, id, templateId]
    );

    await pool.query(
        `INSERT INTO check_results (
            id, tenant_id, manuscript_id, check_type, status, summary,
            attempt_count, outcome, finished_at, created_at
         ) VALUES ($1,$2,$3,'scope','completed','{}'::jsonb,0,'high',now(),now())
         ON CONFLICT (manuscript_id, check_type) DO UPDATE
            SET status = 'completed', outcome = 'high'`,
        [`cr-${id}-scope`, tenantId, id]
    );
}

export async function bootstrapDatabase() {
    applyTestEnv();

    const { pool } = await import('../../src/config/database.js');

    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('DROP SCHEMA IF EXISTS pgboss CASCADE');

    await pool.query(await readSql(path.join(sourceRoot, 'schema.sql')));

    const migrationsDir = path.join(sourceRoot, 'migrations');
    const migrations = (await fs.readdir(migrationsDir))
        .filter((file) => file.endsWith('.sql'))
        .sort();

    for (const migration of migrations) {
        await pool.query(await readSql(path.join(migrationsDir, migration)));
    }

    const { seedDemoData } = await import('../../scripts/lib/seed-demo.js');
    const seeded = await seedDemoData({ client: pool, force: true });
    const templateIds = Object.fromEntries(
        seeded.map((item) => [item.tenantId, item.templateId])
    );

    await pool.query(
        `INSERT INTO users (id, tenant_id, name, email, role, keycloak_sub)
         VALUES ('user-a-99', 'tenant-a', 'Other Author', 'other.a@tenant-a.test',
                 'author', '99999999-9999-4999-8999-000000000099')
         ON CONFLICT (id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                keycloak_sub = EXCLUDED.keycloak_sub`
    );

    await seedManuscript(pool, {
        id: 'ms-a-1',
        tenantId: 'tenant-a',
        authorId: 'user-a-01',
        templateId: templateIds['tenant-a'],
        title: 'Paper A',
    });

    await seedManuscript(pool, {
        id: 'ms-a-other',
        tenantId: 'tenant-a',
        authorId: 'user-a-99',
        templateId: templateIds['tenant-a'],
        title: 'Other Paper A',
    });

    await seedManuscript(pool, {
        id: 'ms-b-1',
        tenantId: 'tenant-b',
        authorId: 'user-b-01',
        templateId: templateIds['tenant-b'],
        title: 'Paper B',
    });

    return { pool, templateIds, uploadDir };
}

export async function countFiles(directory) {
    try {
        const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
        return entries.filter((entry) => entry.isFile()).length;
    } catch {
        return 0;
    }
}

export async function cleanupUploads() {
    await fs.rm(uploadDir, { recursive: true, force: true });
}

export function mockToken({
    sub = 'user-a-01',
    tenant = 'tenant-a',
    roles = ['author'],
} = {}) {
    const role = roles.includes('tenant_admin')
        ? 'tenant_admin'
        : roles.includes('editor')
            ? 'editor'
            : roles[0];

    const payload = {
        sub,
        role,
        realm_access: { roles },
        preferred_username: sub,
        name: sub,
        email: `${sub}@test.local`,
    };

    if (tenant !== null) {
        payload.tenant_id = tenant;
    }

    return `mock.jwt.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}
