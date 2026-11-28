import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoData } from '../scripts/lib/seed-demo.js';

function createFakeClient() {
    const calls = [];

    return {
        calls,
        client: {
            async query(text, values = []) {
                calls.push({ text, values });
                const normalized = text.replace(/\s+/g, ' ');

                if (
                    normalized.includes('FROM format_rule_templates')
                    && normalized.includes("status = 'active'")
                ) {
                    return { rows: [] };
                }

                if (normalized.includes('COALESCE(MAX(version)')) {
                    return { rows: [{ next_version: 1 }] };
                }

                return { rows: [] };
            },
        },
    };
}

describe('Demo seed', () => {
    test('upserts two tenants, six users, and one active rule per tenant', async () => {
        const { client, calls } = createFakeClient();
        const seeded = await seedDemoData({ client });

        assert.deepEqual(seeded.map((item) => item.tenantId), ['tenant-a', 'tenant-b']);
        assert.equal(seeded[0].templateId, 'tpl-tenant-a-v1');
        assert.equal(seeded[1].templateId, 'tpl-tenant-b-v1');

        const tenantInserts = calls.filter((call) => call.text.includes('INSERT INTO tenants'));
        const userInserts = calls.filter((call) => call.text.includes('INSERT INTO users'));
        const ruleInserts = calls.filter(
            (call) => call.text.includes('INSERT INTO format_rule_templates')
        );

        assert.equal(tenantInserts.length, 2);
        assert.equal(userInserts.length, 6);
        assert.equal(ruleInserts.length, 2);

        for (const call of userInserts) {
            assert.match(call.text, /ON CONFLICT \(id\) DO UPDATE/);
        }

        const editorInsert = userInserts.find((call) => call.values[0] === 'user-a-editor');
        assert.ok(editorInsert);
        assert.equal(editorInsert.values[4], 'editor');
        assert.equal(editorInsert.values[5], '11111111-1111-4111-8111-000000000002');

        const adminInsert = userInserts.find((call) => call.values[0] === 'user-b-admin');
        assert.ok(adminInsert);
        assert.equal(adminInsert.values[4], 'tenant_admin');
    });

    test('is safe to run repeatedly at the SQL level', async () => {
        const { client, calls } = createFakeClient();

        await seedDemoData({ client });
        await seedDemoData({ client });

        const userInserts = calls.filter((call) => call.text.includes('INSERT INTO users'));
        assert.equal(userInserts.length, 12);
        assert.ok(userInserts.every((call) => /ON CONFLICT \(id\) DO UPDATE/.test(call.text)));
    });
});
