#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 06 (06-security)
Memverifikasi Keycloak OIDC (AUTH_MODE=jwt), template Secret aman, bebas .env di Git,
log negative authorization tests (401/404/403), Trivy scan, dan 06_evidence.jpg.
"""
import os
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    cfg = read_text("deployment/configmap.yaml")
    sec_readme = read_text("evidence/security/README.md")
    neg_compose = read_text("evidence/security/negative-authorization-test.txt")
    neg_k8s = read_text("evidence/security/negative-authorization-test-k8s.txt")
    trivy_log = read_text("evidence/security/trivy-scan.txt")

    env_tracked = subprocess.run(
        ["git", "ls-files", ".env", "source/.env"],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    ).stdout.strip()

    checks = [
        ("M06-01", "Tidak ada file .env atau source/.env yang ter-track di Git", env_tracked == ""),
        ("M06-02", "Template secret.example.yaml tersedia untuk backend & keycloak",
         os.path.isfile(os.path.join(ROOT_DIR, "deployment", "secret.example.yaml"))
         and os.path.isfile(os.path.join(ROOT_DIR, "deployment", "keycloak", "secret.example.yaml"))),
        ("M06-03", "ConfigMap mengaktifkan AUTH_MODE=jwt dengan KEYCLOAK_ISSUER & KEYCLOAK_JWKS_URI",
         all(k in cfg for k in ["AUTH_MODE: jwt", "KEYCLOAK_ISSUER:", "KEYCLOAK_JWKS_URI:"])),
        ("M06-04", "Bukti negative authorization test (Compose & K8s: 401/404/403) tersedia",
         bool(neg_compose) and bool(neg_k8s) and "401" in neg_compose and "404" in neg_compose and "403" in neg_compose),
        ("M06-05", "Hasil Trivy scan nyata (trivy-scan.txt) & 06_evidence.jpg tersedia",
         len(trivy_log) > 200 and os.path.isfile(os.path.join(ROOT_DIR, "evidence", "security", "06_evidence.jpg"))),
        ("M06-06", "evidence/security/README.md tersedia & mendokumentasikan Keycloak + Trivy",
         bool(sec_readme) and "Keycloak" in sec_readme and "Trivy" in sec_readme),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 06] Security, Keycloak IAM, Secrets & Trivy ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M06: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
