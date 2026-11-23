#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 09 (09-capacity-finops)
Memverifikasi resource requests/limits di seluruh manifest workload (backend, worker, keycloak),
kesiapan skrip capture 09, dan memeriksa status 09_evidence.jpg + live-metrics.txt (Paket C).
"""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "09-capacity-finops"))


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    deploy = read_text("deployment/deployment.yaml")
    worker = read_text("deployment/worker-format.yaml")
    kc = read_text("deployment/keycloak/deployment.yaml")
    readme = read_text("evidence/capacity-finops/README.md")

    live_metrics = os.path.join(ROOT_DIR, "evidence", "capacity-finops", "live-metrics.txt")
    img_repo = os.path.join(ROOT_DIR, "evidence", "capacity-finops", "09_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "09_evidence.jpg")

    checks = [
        ("M09-01", "Resource requests & limits terdefinisi di backend, worker-format, dan keycloak",
         all("requests:" in y and "limits:" in y for y in [deploy, worker, kc])),
        ("M09-02", "Dokumen evidence/capacity-finops/README.md tersedia", bool(readme)),
        ("M09-03", "Skrip capture-evidence-06-08-09-10.sh mendukung modul 09",
         os.path.isfile(os.path.join(ROOT_DIR, "automation", "scripts", "capture-evidence-06-08-09-10.sh"))),
        ("M09-04", "[PAKET C] File live-metrics.txt (kubectl top + docker stats) tersedia",
         os.path.isfile(live_metrics)),
        ("M09-05", "[PAKET C] Gambar 09_evidence.jpg tersedia di repo atau portofolio",
         os.path.isfile(img_repo) or os.path.isfile(img_port)),
    ]
    return checks


if __name__ == "__main__":
    allow_pending = "--allow-pending" in sys.argv
    results = run_tests()
    failed = 0
    pending = 0
    print("=== [TEST MILESTONE 09] Capacity Planning, FinOps & Roadmap ===")
    for cid, desc, ok in results:
        if ok:
            print(f"  [PASS] {cid} | {desc}")
        elif "[PAKET C]" in desc and allow_pending:
            print(f"  [PEND] {cid} | {desc} (menunggu PR Paket C)")
            pending += 1
        else:
            print(f"  [FAIL] {cid} | {desc}")
            failed += 1
    passed = len(results) - failed - pending
    print(f"Summary M09: {passed}/{len(results)} PASS | {pending} PENDING | {failed} FAIL")
    sys.exit(1 if failed else 0)
