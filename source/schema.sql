-- =============================================================================
-- Capstone Cloud Computing - JournalFit Database Schema
-- Multi-Tenant Journal Manuscript Pre-Submission Checker
-- =============================================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Format Rule Templates Table
CREATE TABLE IF NOT EXISTS format_rule_templates (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    min_words INT DEFAULT 3000,
    max_words INT DEFAULT 8000,
    require_abstract BOOLEAN DEFAULT TRUE,
    require_keywords BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Manuscripts Table
CREATE TABLE IF NOT EXISTS manuscripts (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id VARCHAR(50) REFERENCES tenants(id) ON DELETE CASCADE,
    author_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Check Results Table
CREATE TABLE IF NOT EXISTS check_results (
    id VARCHAR(50) PRIMARY KEY,
    manuscript_id VARCHAR(50) REFERENCES manuscripts(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL,
    format_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Findings Table
CREATE TABLE IF NOT EXISTS findings (
    id VARCHAR(50) PRIMARY KEY,
    check_result_id VARCHAR(50) REFERENCES check_results(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Seed Initial Data for Testing & Verification
-- Sesuai skenario pengujian Anggota 1 & Anggota 4 (Tenant Isolation Test)
-- =============================================================================

-- Seed Tenants
INSERT INTO tenants (id, name) VALUES
    ('tenant-a', 'Journal Fitra Journal (Tenant A)'),
    ('tenant-b', 'Journal Sains Bina (Tenant B)')
ON CONFLICT (id) DO NOTHING;

-- Seed Users
INSERT INTO users (id, tenant_id, name, email, role) VALUES
    ('user-a-01', 'tenant-a', 'Author Alpha', 'author@tenant-a.org', 'author'),
    ('user-b-01', 'tenant-b', 'Author Beta', 'author@tenant-b.org', 'author')
ON CONFLICT (id) DO NOTHING;

-- Seed Default Format Rule Templates
INSERT INTO format_rule_templates (id, tenant_id, template_name, min_words, max_words, require_abstract, require_keywords) VALUES
    ('tpl-a-default', 'tenant-a', 'Standard IEEE Template', 3000, 8000, TRUE, TRUE),
    ('tpl-b-default', 'tenant-b', 'Standard ACM Template', 2500, 7000, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Sample Manuscript (ms-001) for Tenant Isolation Verification:
-- GET /api/manuscripts/ms-001/report with X-Tenant-ID: tenant-a -> 200 OK
-- GET /api/manuscripts/ms-001/report with X-Tenant-ID: tenant-b -> 403 Forbidden
INSERT INTO manuscripts (id, tenant_id, author_id, title, file_path) VALUES
    ('ms-001', 'tenant-a', 'user-a-01', 'Cloud Native Performance Study', '/uploads/ms-001.docx')
ON CONFLICT (id) DO NOTHING;

INSERT INTO check_results (id, manuscript_id, status, format_score) VALUES
    ('cr-001', 'ms-001', 'COMPLETED', 85)
ON CONFLICT (id) DO NOTHING;

INSERT INTO findings (id, check_result_id, rule_type, severity, message) VALUES
    ('f-001', 'cr-001', 'WORD_COUNT', 'INFO', 'Total word count is 4500 words (compliant: 3000-8000 words).'),
    ('f-002', 'cr-001', 'ABSTRACT_CHECK', 'INFO', 'Abstract section is present.')
ON CONFLICT (id) DO NOTHING;
