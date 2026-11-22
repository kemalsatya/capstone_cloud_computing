-- =============================================================================
-- JournalFit - Keycloak authentication migration
-- Additive: safe on both source/schema.sql and source/schema-v2.sql
-- =============================================================================

BEGIN;

-- Keycloak subject (claim `sub`). Multiple NULLs are allowed by PostgreSQL.
ALTER TABLE users ADD COLUMN IF NOT EXISTS keycloak_sub VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_keycloak_sub ON users (keycloak_sub);

-- Reconcile role vocabulary: schema-v2 uses admin_tenant, PRD/JWT uses tenant_admin.
UPDATE users SET role = 'tenant_admin' WHERE role IN ('admin', 'admin_tenant');
UPDATE users SET role = 'author'       WHERE role = 'user';
UPDATE users SET role = 'editor'       WHERE role = 'operator';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('author', 'editor', 'tenant_admin', 'admin_platform'));

-- Link seeded demo users to the deterministic Keycloak IDs from
-- deployment/keycloak/realm-journalfit.json so manuscript ownership still resolves.
UPDATE users SET keycloak_sub = '11111111-1111-4111-8111-000000000001'
 WHERE id = 'user-a-01' AND keycloak_sub IS NULL;

UPDATE users SET keycloak_sub = '22222222-2222-4222-8222-000000000001'
 WHERE id = 'user-b-01' AND keycloak_sub IS NULL;

COMMIT;
