#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 08 (08-reliability-recovery)
Memverifikasi skrip backup/restore DB, bukti controlled pod failure (7.1s),
rolling update (0 failed), isolated restore RTO (0.78s), dan 08_evidence.jpg.
"""
import json
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

REQUIRED_9_FIELDS = [
    "Scope", "Owner", "Source / Version", "Timestamp",
    "Method", "Observation", "Interpretation", "Limitation", "Decision Supported",
]


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    readme = read_text("evidence/reliability-recovery/README.md")
    pod_log = read_text("evidence/reliability-recovery/panel1-pod-failure-log.txt")
    restore_log = read_text("evidence/reliability-recovery/restore-proof.txt")
    ru_text = read_text("evidence/platform/rolling-update-result.json")
    ru_ok = False
    if ru_text:
        try:
            ru_data = json.loads(ru_text)
            ru_ok = ru_data.get("failed_requests", 1) == 0 and ru_data.get("requests", 0) >= 500
        except json.JSONDecodeError:
            ru_ok = False

    img_repo = os.path.join(ROOT_DIR, "evidence", "reliability-recovery", "08_evidence.jpg")

    checks = [
        ("M08-01", "Skrip automation/scripts/db-backup-restore.sh tersedia",
         os.path.isfile(os.path.join(ROOT_DIR, "automation", "scripts", "db-backup-restore.sh"))),
        ("M08-02", "evidence/reliability-recovery/README.md memuat 9-field Evidence Standard (§9)",
         bool(readme) and all(f in readme for f in REQUIRED_9_FIELDS)),
        ("M08-03", "Bukti Controlled Pod Failure (panel1-pod-failure-log.txt) & Self-Healing 7,1 detik tercatat",
         bool(pod_log) and "7,1 detik" in readme),
        ("M08-04", "Bukti Isolated Restore DB (restore-proof.txt) & RTO 0,78 detik + 101 tabel Keycloak tercatat",
         bool(restore_log) and "0,78 detik" in readme and "101 tabel" in readme),
        ("M08-05", "Benchmark Rolling Update (rolling-update-result.json) mencatat 0 failed requests", ru_ok),
        ("M08-06", "Gambar 08_evidence.jpg tersedia (> 100 KB)",
         os.path.isfile(img_repo) and os.path.getsize(img_repo) > 100_000),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 08] Reliability, Self-Healing & Disaster Recovery ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M08: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
