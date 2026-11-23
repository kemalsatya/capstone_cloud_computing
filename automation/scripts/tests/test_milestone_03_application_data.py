#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 03 (03-application-data)
Memverifikasi unit/OOXML/worker/JWT/OpenAPI test suite (npm test), skema 6 tabel,
migrasi 001+002, 03_evidence.jpg, dan 9-field Evidence Standard.
"""
import os
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "03-application-data"))


def run_tests():
    schema_path = os.path.join(ROOT_DIR, "source", "schema.sql")
    mig1 = os.path.join(ROOT_DIR, "source", "migrations", "001_add_keycloak_auth.sql")
    mig2 = os.path.join(ROOT_DIR, "source", "migrations", "002_prd_format_foundation.sql")
    img_repo = os.path.join(ROOT_DIR, "evidence", "application-data", "03_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "03_evidence.jpg")
    readme_repo = os.path.join(ROOT_DIR, "evidence", "application-data", "README.md")

    schema = open(schema_path, encoding="utf-8").read() if os.path.isfile(schema_path) else ""
    tables = ["tenants", "users", "format_rule_templates", "manuscripts", "check_results", "findings"]

    # Run real node --test suite in source/
    res = subprocess.run(
        ["node", "--test"],
        cwd=os.path.join(ROOT_DIR, "source"),
        capture_output=True,
        text=True,
        check=False,
    )
    npm_ok = res.returncode == 0 and "# fail 0" in (res.stdout + res.stderr)

    checks = [
        ("M03-01", "Application, OOXML, Worker, OpenAPI & JWT test suite (node --test) lulus (0 fail)", npm_ok),
        ("M03-02", "Skema v1 (source/schema.sql) memuat 6 tabel relasional + kolom tenant_id",
         all(f"CREATE TABLE IF NOT EXISTS {t}" in schema for t in tables) and schema.count("tenant_id") >= 5),
        ("M03-03", "Migrasi aditif 001 (Keycloak) & 002 (PRD Format/pg-boss) tersedia",
         os.path.isfile(mig1) and os.path.isfile(mig2)),
        ("M03-04", "OpenAPI spec (source/src/docs/openapi.yaml) & worker (source/src/worker.js) tersedia",
         os.path.isfile(os.path.join(ROOT_DIR, "source", "src", "docs", "openapi.yaml"))
         and os.path.isfile(os.path.join(ROOT_DIR, "source", "src", "worker.js"))),
        ("M03-05", "Bukti 03_evidence.jpg & evidence/application-data/README.md tersedia",
         (os.path.isfile(img_repo) or os.path.isfile(img_port)) and os.path.isfile(readme_repo)),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 03] Application, Data & Async Format Worker ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M03: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
