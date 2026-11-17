-- =============================================================================
-- JournalFit - Database Schema (revisi)
-- Multi-Tenant Journal Manuscript Pre-Submission Checker
-- =============================================================================

-- 1. TENANTS (satu tenant = satu jurnal)
CREATE TABLE IF NOT EXISTS tenants (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    aim_scope   TEXT,                        -- diisi admin tenant saat onboarding; dibaca scope worker
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS
-- tenant_id NULL hanya untuk admin_platform
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(50)  PRIMARY KEY,
    tenant_id   VARCHAR(50)  REFERENCES tenants(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL,
    role        VARCHAR(30)  NOT NULL
                CHECK (role IN ('author','editor','admin_tenant','admin_platform')),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, email)
);

-- 3. FORMAT RULE TEMPLATES
-- generated_rules : output mentah suggester, tidak pernah diubah (bukti review wajib)
-- rules           : hasil review admin tenant; satu-satunya yang dibaca rule engine
CREATE TABLE IF NOT EXISTS format_rule_templates (
    id                VARCHAR(50)  PRIMARY KEY,
    tenant_id         VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_name     VARCHAR(100) NOT NULL,
    version           INT          NOT NULL DEFAULT 1,
    status            VARCHAR(20)  NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','active','archived')),
    source_file_path  VARCHAR(255),
    generated_rules   JSONB        NOT NULL,
    rules             JSONB,
    reviewed_by       VARCHAR(50)  REFERENCES users(id) ON DELETE SET NULL,
    activated_at      TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, template_name, version),
    -- rule tidak boleh aktif sebelum direview
    CHECK (status <> 'active' OR (rules IS NOT NULL AND reviewed_by IS NOT NULL AND activated_at IS NOT NULL))
);

-- 4. MANUSCRIPTS
-- Revisi/unggah ulang: manuscript baru menunjuk ke versi sebelumnya lewat previous_id
CREATE TABLE IF NOT EXISTS manuscripts (
    id            VARCHAR(50)  PRIMARY KEY,
    tenant_id     VARCHAR(50)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    author_id     VARCHAR(50)  REFERENCES users(id) ON DELETE SET NULL,
    previous_id   VARCHAR(50)  REFERENCES manuscripts(id) ON DELETE SET NULL,
    revision_no   INT          NOT NULL DEFAULT 1,
    title         VARCHAR(255) NOT NULL,
    file_path     VARCHAR(255) NOT NULL,
    abstract_text TEXT,                      -- hasil ekstraksi; satu-satunya teks yang dikirim ke AI
    keywords      TEXT[],
    upload_time   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manuscripts_tenant ON manuscripts (tenant_id);

-- 5. CHECK RESULTS
-- Format dan scope punya status terpisah: kegagalan AI tidak menggagalkan laporan format
CREATE TABLE IF NOT EXISTS check_results (
    id                  VARCHAR(50) PRIMARY KEY,
    manuscript_id       VARCHAR(50) NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    rule_template_id    VARCHAR(50) REFERENCES format_rule_templates(id) ON DELETE SET NULL,
    rule_version        INT,                 -- snapshot versi rule yang dipakai saat pemeriksaan
    format_status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (format_status IN ('pending','completed','failed')),
    format_score        INT,
    scope_status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (scope_status IN ('pending','completed','failed')),
    scope_summary       TEXT,                -- saran kecocokan topik dari AI
    ai_tokens_in        INT,                 -- FinOps: dicatat per naskah, diagregasi per tenant
    ai_tokens_out       INT,
    ai_cost_estimate    NUMERIC(10,6),
    created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_check_results_manuscript ON check_results (manuscript_id);

-- 6. FINDINGS
CREATE TABLE IF NOT EXISTS findings (
    id               VARCHAR(50) PRIMARY KEY,
    check_result_id  VARCHAR(50) NOT NULL REFERENCES check_results(id) ON DELETE CASCADE,
    category         VARCHAR(10) NOT NULL DEFAULT 'format'
                     CHECK (category IN ('format','scope')),
    rule_key         VARCHAR(50) NOT NULL,   -- mis. ABSTRACT_LENGTH, PAGE_SIZE, HEADING_STYLE
    check_level      VARCHAR(10) NOT NULL DEFAULT 'auto'
                     CHECK (check_level IN ('auto','advisory','manual')),
    severity         VARCHAR(20) NOT NULL
                     CHECK (severity IN ('INFO','WARNING','ERROR')),
    message          TEXT        NOT NULL,
    details          JSONB,                  -- nilai ditemukan vs diharapkan, lokasi, dll.
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_findings_check_result ON findings (check_result_id);

-- =============================================================================
-- SEED untuk pengujian isolasi tenant (Anggota 1 & 4)
-- =============================================================================
INSERT INTO tenants (id, name, aim_scope) VALUES
    ('tenant-a', 'Jurnal Tenant A', 'Contoh aim and scope: ilmu komputer, sistem informasi, dan cloud computing.'),
    ('tenant-b', 'Jurnal Tenant B', 'Contoh aim and scope: sains dan teknologi terapan.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, name, email, role) VALUES
    ('user-a-01',  'tenant-a', 'Author Alpha', 'author@tenant-a.org', 'author'),
    ('user-a-02',  'tenant-a', 'Admin Alpha',  'admin@tenant-a.org',  'admin_tenant'),
    ('user-b-01',  'tenant-b', 'Author Beta',  'author@tenant-b.org', 'author'),
    ('user-plat-1', NULL, 'Platform Admin', 'root@journalfit.local', 'admin_platform')
ON CONFLICT (id) DO NOTHING;

INSERT INTO format_rule_templates
    (id, tenant_id, template_name, version, status, generated_rules, rules, reviewed_by, activated_at)
VALUES
    ('tpl-a-v1', 'tenant-a', 'Template Informatik', 1, 'active',
     '{"pageSize":"A4","bodyColumns":1}'::jsonb,
     '{"pageSize":"A4","bodyColumns":2,"abstract":{"minWords":100,"maxWords":200,"required":true},"keywords":{"required":true}}'::jsonb,
     'user-a-02', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Manuscript contoh untuk tes isolasi:
INSERT INTO manuscripts (id, tenant_id, author_id, title, file_path, abstract_text, keywords) VALUES
    ('ms-001', 'tenant-a', 'user-a-01', 'Cloud Native Performance Study', '/uploads/ms-001.docx',
     'Contoh abstrak.', ARRAY['cloud','performance'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO findings (id, check_result_id, category, rule_key, check_level, severity, message) VALUES
    ('f-001', 'cr-001', 'format', 'ABSTRACT_LENGTH', 'auto', 'INFO', 'Panjang abstrak sesuai (100-200 kata).'),
    ('f-002', 'cr-001', 'format', 'KEYWORDS_PRESENT', 'auto', 'INFO', 'Keywords tersedia.')
ON CONFLICT (id) DO NOTHING;