-- =============================================================================
-- JournalFit - tenant admin rule template metadata
-- Additive migration after 001 + 002. Safe to re-run.
-- =============================================================================

BEGIN;

ALTER TABLE format_rule_templates
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS template_original_filename TEXT,
    ADD COLUMN IF NOT EXISTS template_size_bytes INTEGER;

CREATE INDEX IF NOT EXISTS idx_format_rule_templates_tenant_status
    ON format_rule_templates (tenant_id, status);

COMMIT;
