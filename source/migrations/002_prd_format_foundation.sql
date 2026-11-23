-- =============================================================================
-- JournalFit - PRD format foundation migration
-- Additive migration from schema.sql (v1) + 001_add_keycloak_auth.sql.
--
-- Design notes:
-- - IDs stay VARCHAR to keep existing demo data (tenant-a, ms-001) and Keycloak
--   claims working. The PRD's UUID types are treated as a target, not applied here.
-- - Legacy columns are kept so older code and evidence remain readable.
-- - Run after 001. Safe to re-run: every DDL uses IF NOT EXISTS and backfills
--   are guarded by NULL checks.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS aim_scope TEXT,
    ADD COLUMN IF NOT EXISTS ai_monthly_token_quota INTEGER NOT NULL DEFAULT 100000,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- -----------------------------------------------------------------------------
-- users : last_login_at + reviewer accounts for seeded active rules
-- -----------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

INSERT INTO users (id, tenant_id, name, email, role)
SELECT 'user-a-admin', 'tenant-a', 'Tenant Admin A', 'admin@tenant-a.org', 'tenant_admin'
WHERE EXISTS (SELECT 1 FROM tenants WHERE id = 'tenant-a')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, name, email, role)
SELECT 'user-b-admin', 'tenant-b', 'Tenant Admin B', 'admin@tenant-b.org', 'tenant_admin'
WHERE EXISTS (SELECT 1 FROM tenants WHERE id = 'tenant-b')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- format_rule_templates : versioned, reviewed, activatable rules
-- -----------------------------------------------------------------------------
ALTER TABLE format_rule_templates
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS template_object_key TEXT,
    ADD COLUMN IF NOT EXISTS template_sha256 CHAR(64),
    ADD COLUMN IF NOT EXISTS generated_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS rules JSONB,
    ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(50) REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS activated_by VARCHAR(50) REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH numbered AS (
    SELECT id,
           row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
    FROM format_rule_templates
)
UPDATE format_rule_templates t
SET version = n.rn
FROM numbered n
WHERE t.id = n.id
  AND t.version <> n.rn;

UPDATE format_rule_templates
SET status = 'active',
    generated_rules = CASE
        WHEN generated_rules = '{}'::jsonb THEN COALESCE(rules, '{}'::jsonb)
        ELSE generated_rules
    END,
    activated_at = COALESCE(activated_at, created_at),
    updated_at = COALESCE(updated_at, created_at)
WHERE status = 'draft'
  AND (rules IS NOT NULL OR generated_rules IS NOT NULL);

WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY tenant_id ORDER BY created_at DESC, id DESC) AS rn
    FROM format_rule_templates
    WHERE status = 'active'
)
UPDATE format_rule_templates t
SET status = 'archived', archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_format_rule_templates_tenant_version
    ON format_rule_templates (tenant_id, version);

CREATE UNIQUE INDEX IF NOT EXISTS uq_format_rule_templates_active_per_tenant
    ON format_rule_templates (tenant_id)
    WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- manuscripts : submission metadata + extracted content
-- -----------------------------------------------------------------------------
ALTER TABLE manuscripts
    ADD COLUMN IF NOT EXISTS rule_template_id VARCHAR(50) REFERENCES format_rule_templates(id),
    ADD COLUMN IF NOT EXISTS parent_manuscript_id VARCHAR(50) REFERENCES manuscripts(id),
    ADD COLUMN IF NOT EXISTS revision_no INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS abstract_text TEXT,
    ADD COLUMN IF NOT EXISTS keywords TEXT[],
    ADD COLUMN IF NOT EXISTS object_key TEXT,
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
    ADD COLUMN IF NOT EXISTS sha256 CHAR(64),
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE manuscripts ALTER COLUMN status SET DEFAULT 'queued';

UPDATE manuscripts
SET created_at = COALESCE(created_at, upload_time, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

ALTER TABLE manuscripts ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE manuscripts ALTER COLUMN created_at SET NOT NULL;

UPDATE manuscripts
SET object_key = COALESCE(object_key, file_path),
    original_filename = COALESCE(original_filename, title),
    size_bytes = COALESCE(size_bytes, 0),
    sha256 = COALESCE(sha256, repeat('0', 64)),
    updated_at = COALESCE(updated_at, upload_time)
WHERE object_key IS NULL
   OR original_filename IS NULL
   OR size_bytes IS NULL
   OR sha256 IS NULL
   OR updated_at IS NULL;

UPDATE manuscripts m
SET rule_template_id = (
    SELECT t.id
    FROM format_rule_templates t
    WHERE t.tenant_id = m.tenant_id
      AND t.status = 'active'
    ORDER BY t.version DESC
    LIMIT 1
)
WHERE m.rule_template_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_manuscripts_tenant_created
    ON manuscripts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manuscripts_tenant_author_created
    ON manuscripts (tenant_id, author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manuscripts_tenant_status
    ON manuscripts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_manuscripts_parent
    ON manuscripts (parent_manuscript_id);

-- -----------------------------------------------------------------------------
-- check_results : one row per (manuscript, check_type)
-- -----------------------------------------------------------------------------
ALTER TABLE check_results
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50) REFERENCES tenants(id),
    ADD COLUMN IF NOT EXISTS check_type TEXT NOT NULL DEFAULT 'format',
    ADD COLUMN IF NOT EXISTS rule_template_id VARCHAR(50) REFERENCES format_rule_templates(id),
    ADD COLUMN IF NOT EXISTS rule_version INTEGER,
    ADD COLUMN IF NOT EXISTS outcome TEXT,
    ADD COLUMN IF NOT EXISTS summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS ai_provider TEXT,
    ADD COLUMN IF NOT EXISTS ai_model TEXT,
    ADD COLUMN IF NOT EXISTS tokens_in INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tokens_out INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS est_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_code TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE check_results cr
SET tenant_id = m.tenant_id,
    rule_template_id = COALESCE(cr.rule_template_id, m.rule_template_id),
    rule_version = COALESCE(cr.rule_version, t.version),
    status = lower(cr.status),
    outcome = COALESCE(
        cr.outcome,
        CASE
            WHEN lower(cr.status) = 'completed' AND COALESCE(cr.format_score, 0) >= 60 THEN 'passed'
            WHEN lower(cr.status) = 'completed' THEN 'failed'
            ELSE NULL
        END
    ),
    finished_at = COALESCE(cr.finished_at, cr.completed_at, cr.created_at)
FROM manuscripts m
LEFT JOIN format_rule_templates t ON t.id = m.rule_template_id
WHERE cr.manuscript_id = m.id;

UPDATE check_results
SET tenant_id = m.tenant_id
FROM manuscripts m
WHERE check_results.manuscript_id = m.id
  AND check_results.tenant_id IS NULL;

UPDATE check_results
SET outcome = CASE
        WHEN status = 'completed' AND COALESCE(format_score, 0) >= 60 THEN 'passed'
        WHEN status = 'completed' THEN 'failed'
        ELSE outcome
    END
WHERE outcome IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_check_results_manuscript_type
    ON check_results (manuscript_id, check_type);

CREATE INDEX IF NOT EXISTS idx_check_results_tenant_type_finished
    ON check_results (tenant_id, check_type, finished_at);

-- -----------------------------------------------------------------------------
-- findings : PRD-shaped rule findings
-- -----------------------------------------------------------------------------
ALTER TABLE findings
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50) REFERENCES tenants(id),
    ADD COLUMN IF NOT EXISTS rule_id TEXT,
    ADD COLUMN IF NOT EXISTS location JSONB,
    ADD COLUMN IF NOT EXISTS expected JSONB,
    ADD COLUMN IF NOT EXISTS actual JSONB;

UPDATE findings f
SET rule_id = COALESCE(f.rule_id, f.rule_type),
    tenant_id = COALESCE(f.tenant_id, cr.tenant_id),
    severity = lower(f.severity)
FROM check_results cr
WHERE f.check_result_id = cr.id;

UPDATE findings SET severity = lower(severity);

ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_severity_check;
ALTER TABLE findings
    ADD CONSTRAINT findings_severity_check
    CHECK (severity IN ('error', 'warning', 'info'));

CREATE INDEX IF NOT EXISTS idx_findings_tenant_rule
    ON findings (tenant_id, rule_id);

-- Backfill summary counts for legacy check results that have findings.
UPDATE check_results cr
SET summary = jsonb_build_object(
        'counts',
        jsonb_build_object(
            'error', COALESCE(f.error_count, 0),
            'warning', COALESCE(f.warning_count, 0),
            'info', COALESCE(f.info_count, 0)
        )
    )
FROM (
    SELECT check_result_id,
           COUNT(*) FILTER (WHERE severity = 'error') AS error_count,
           COUNT(*) FILTER (WHERE severity = 'warning') AS warning_count,
           COUNT(*) FILTER (WHERE severity = 'info') AS info_count
    FROM findings
    GROUP BY check_result_id
) f
WHERE cr.id = f.check_result_id
  AND cr.summary = '{}'::jsonb;

COMMIT;
