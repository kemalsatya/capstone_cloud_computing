#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 11 (11-demo-defense)
Memverifikasi kesiapan live demo (§13), 12 Bank Pertanyaan (§13.1) sinkron Keycloak,
kelengkapan 9-field Evidence Standard, dan skrip e2e-milestone-test.sh.
"""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_README = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "11-demo-defense", "README.md"))

REQUIRED_9_FIELDS = [
    "Scope", "Owner", "Source / Version", "Timestamp",
    "Method", "Observation", "Interpretation", "Limitation", "Decision Supported",
]


def run_tests():
    readme = open(PORTFOLIO_README, encoding="utf-8").read() if os.path.isfile(PORTFOLIO_README) else ""
    e2e_path = os.path.join(ROOT_DIR, "automation", "scripts", "e2e-milestone-test.sh")
    e2e_text = open(e2e_path, encoding="utf-8").read() if os.path.isfile(e2e_path) else ""

    checks = [
        ("M11-01", "11-demo-defense/README.md tersedia & memuat 9-field Evidence Standard (§9)",
         bool(readme) and all(f in readme for f in REQUIRED_9_FIELDS)),
        ("M11-02", "12 Bank Pertanyaan Sidang (§13.1) lengkap di README",
         all(f"**{i}." in readme for i in range(1, 13))),
        ("M11-03", "Tidak ada klaim lama 'mock JWT' yang bertentangan dengan Keycloak OIDC",
         "mock JWT" not in readme and "404 NOT_FOUND" in readme and "403 FORBIDDEN" in readme),
        ("M11-04", "Skrip automation/scripts/e2e-milestone-test.sh tersedia & memuat uji Keycloak JWT",
         bool(e2e_text) and "fetch_kc_token" in e2e_text and "404" in e2e_text),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 11] Demo & Technical Defense Readiness ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M11: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
