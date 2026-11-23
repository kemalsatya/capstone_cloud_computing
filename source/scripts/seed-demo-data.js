import { withTransaction } from '../src/config/database.js';
import { DEFAULT_RULES } from '../src/modules/rules/defaults.js';
import { validateRuleConfig } from '../src/modules/rules/engine.js';

validateRuleConfig(DEFAULT_RULES);

const TENANTS = [
    { id: 'tenant-a', name: 'Jurnal Tenant A', adminId: 'user-a-admin', adminEmail: 'admin@tenant-a.org' },
    { id: 'tenant-b', name: 'Jurnal Tenant B', adminId: 'user-b-admin', adminEmail: 'admin@tenant-b.org' },
];

async function seedTenant(client, tenant, force) {
    await client.query(
        `INSERT INTO tenants (id, name) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [tenant.id, tenant.name]
    );

    await client.query(
        `INSERT INTO users (id, tenant_id, name, email, role)
         VALUES ($1, $2, $3, $4, 'tenant_admin')
         ON CONFLICT (id) DO NOTHING`,
        [tenant.adminId, tenant.id, `Tenant Admin ${tenant.id}`, tenant.adminEmail]
    );

    const active = await client.query(
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
            await client.query(
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
                    tenant.adminId,
                ]
            );
        }
    } else {
        const versionResult = await client.query(
            `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
             FROM format_rule_templates
             WHERE tenant_id = $1`,
            [tenant.id]
        );
        const version = versionResult.rows[0].next_version;
        templateId = `tpl-${tenant.id}-v${version}`;

        await client.query(
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
                tenant.adminId,
            ]
        );
    }

    await client.query(
        `UPDATE manuscripts
         SET rule_template_id = $1
         WHERE tenant_id = $2 AND rule_template_id IS NULL`,
        [templateId, tenant.id]
    );

    return templateId;
}

async function main() {
    const seeded = await withTransaction(async (client) => {
        const result = [];
        const force = process.argv.includes('--force');
        for (const tenant of TENANTS) {
            const templateId = await seedTenant(client, tenant, force);
            result.push({ tenantId: tenant.id, templateId });
        }
        return result;
    });

    for (const item of seeded) {
        console.log(`[seed] ${item.tenantId}: active rule template ${item.templateId}`);
    }
}

main()
    .then(() => {
        console.log('[seed] Selesai.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[seed] Gagal:', err);
        process.exit(1);
    });
