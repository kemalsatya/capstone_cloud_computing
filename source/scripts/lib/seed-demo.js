import { withTransaction } from '../../src/config/database.js';
import { DEFAULT_RULES } from '../../src/modules/rules/defaults.js';
import { validateRuleConfig } from '../../src/modules/rules/engine.js';

validateRuleConfig(DEFAULT_RULES);

export const DEMO_TENANTS = [
    { id: 'tenant-a', name: 'Jurnal Tenant A' },
    { id: 'tenant-b', name: 'Jurnal Tenant B' },
];

export const DEMO_USERS = [
    {
        id: 'user-a-01',
        tenantId: 'tenant-a',
        name: 'Author Tenant A',
        email: 'author.a@tenant-a.test',
        role: 'author',
        keycloakSub: '11111111-1111-4111-8111-000000000001',
    },
    {
        id: 'user-a-editor',
        tenantId: 'tenant-a',
        name: 'Editor Tenant A',
        email: 'editor.a@tenant-a.test',
        role: 'editor',
        keycloakSub: '11111111-1111-4111-8111-000000000002',
    },
    {
        id: 'user-a-admin',
        tenantId: 'tenant-a',
        name: 'Tenant Admin A',
        email: 'tenant_admin.a@tenant-a.test',
        role: 'tenant_admin',
        keycloakSub: '11111111-1111-4111-8111-000000000003',
    },
    {
        id: 'user-b-01',
        tenantId: 'tenant-b',
        name: 'Author Tenant B',
        email: 'author.b@tenant-b.test',
        role: 'author',
        keycloakSub: '22222222-2222-4222-8222-000000000001',
    },
    {
        id: 'user-b-editor',
        tenantId: 'tenant-b',
        name: 'Editor Tenant B',
        email: 'editor.b@tenant-b.test',
        role: 'editor',
        keycloakSub: '22222222-2222-4222-8222-000000000002',
    },
    {
        id: 'user-b-admin',
        tenantId: 'tenant-b',
        name: 'Tenant Admin B',
        email: 'tenant_admin.b@tenant-b.test',
        role: 'tenant_admin',
        keycloakSub: '22222222-2222-4222-8222-000000000003',
    },
];

async function seedTenant(db, tenant, force) {
    await db.query(
        `INSERT INTO tenants (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [tenant.id, tenant.name]
    );

    for (const user of DEMO_USERS.filter((item) => item.tenantId === tenant.id)) {
        await db.query(
            `INSERT INTO users (id, tenant_id, name, email, role, keycloak_sub)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE
                SET tenant_id = EXCLUDED.tenant_id,
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    keycloak_sub = EXCLUDED.keycloak_sub`,
            [user.id, user.tenantId, user.name, user.email, user.role, user.keycloakSub]
        );
    }

    const active = await db.query(
        `SELECT * FROM format_rule_templates
         WHERE tenant_id = $1 AND status = 'active'
         ORDER BY version DESC
         LIMIT 1`,
        [tenant.id]
    );

    let templateId;

    if (active.rows[0]) {
        templateId = active.rows[0].id;
        const currentRules = active.rows[0].rules;
        const hasRules = currentRules
            && typeof currentRules === 'object'
            && Object.keys(currentRules).length > 0;

        if (!hasRules || force) {
            await db.query(
                `UPDATE format_rule_templates
                 SET generated_rules = $2::jsonb,
                     rules = $3::jsonb,
                     reviewed_by = $4,
                     activated_by = $4,
                     activated_at = COALESCE(activated_at, CURRENT_TIMESTAMP),
                     template_sha256 = COALESCE(template_sha256, repeat('0', 64)),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [
                    templateId,
                    JSON.stringify(DEFAULT_RULES),
                    JSON.stringify(DEFAULT_RULES),
                    tenant.id === 'tenant-a' ? 'user-a-admin' : 'user-b-admin',
                ]
            );
        }
    } else {
        const versionResult = await db.query(
            `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
             FROM format_rule_templates
             WHERE tenant_id = $1`,
            [tenant.id]
        );
        const version = versionResult.rows[0].next_version;
        templateId = `tpl-${tenant.id}-v${version}`;
        const adminId = tenant.id === 'tenant-a' ? 'user-a-admin' : 'user-b-admin';

        await db.query(
            `INSERT INTO format_rule_templates (
                id, tenant_id, template_name, version, status,
                generated_rules, rules, reviewed_by, activated_by, activated_at,
                template_sha256
             ) VALUES ($1,$2,$3,$4,'active',$5::jsonb,$6::jsonb,$7,$7,CURRENT_TIMESTAMP,repeat('0',64))`,
            [
                templateId,
                tenant.id,
                'Default Informatik Template',
                version,
                JSON.stringify(DEFAULT_RULES),
                JSON.stringify(DEFAULT_RULES),
                adminId,
            ]
        );
    }

    await db.query(
        `UPDATE manuscripts
         SET rule_template_id = $1
         WHERE tenant_id = $2 AND rule_template_id IS NULL`,
        [templateId, tenant.id]
    );

    return templateId;
}

export async function seedDemoData({ client = null, force = false } = {}) {
    const run = async (db) => {
        const result = [];

        for (const tenant of DEMO_TENANTS) {
            const templateId = await seedTenant(db, tenant, force);
            result.push({ tenantId: tenant.id, templateId });
        }

        return result;
    };

    if (client) return run(client);
    return withTransaction(run);
}
