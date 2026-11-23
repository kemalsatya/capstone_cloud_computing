#!/usr/bin/env python3
"""
Unified Post-Evidence Milestone Test Runner (01..11, separated from generators).
Usage:
  python automation/scripts/tests/run_milestone_tests.py all
  python automation/scripts/tests/run_milestone_tests.py all --allow-pending
  python automation/scripts/tests/run_milestone_tests.py 03 06 08 10
"""
import os
import subprocess
import sys

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))

MILESTONE_SCRIPTS = {
    "01": "test_milestone_01_business.py",
    "02": "test_milestone_02_architecture.py",
    "03": "test_milestone_03_application_data.py",
    "04": "test_milestone_04_platform_k8s.py",
    "05": "test_milestone_05_cicd_gitops.py",
    "06": "test_milestone_06_security.py",
    "07": "test_milestone_07_observability.py",
    "08": "test_milestone_08_reliability.py",
    "09": "test_milestone_09_capacity_finops.py",
    "10": "test_milestone_10_adr.py",
    "11": "test_milestone_11_demo.py",
}


def main():
    raw_args = sys.argv[1:]
    allow_pending = "--allow-pending" in raw_args
    args = [a for a in raw_args if not a.startswith("--")] or ["all"]
    targets = list(MILESTONE_SCRIPTS.keys()) if "all" in args else [a.zfill(2) for a in args]

    overall_fail = 0
    print("=" * 82)
    print("  JOURNALFIT — POST-EVIDENCE MILESTONE TEST RUNNER (01 s.d. 11) — TEAM 7")
    print("=" * 82)

    for m in targets:
        script = MILESTONE_SCRIPTS.get(m)
        if not script:
            print(f"  [SKIP] Milestone {m}: tidak dikenal (gunakan 01..11 atau all)")
            continue
        cmd = [sys.executable, os.path.join(TESTS_DIR, script)]
        if allow_pending and m == "09":
            cmd.append("--allow-pending")
        res = subprocess.run(cmd, check=False)
        if res.returncode != 0:
            overall_fail += 1
        print("-" * 82)

    print(f"OVERALL RESULT: {'ALL PASSED' if overall_fail == 0 else f'{overall_fail} MILESTONE SUITE(S) FAILED'}")
    sys.exit(1 if overall_fail else 0)


if __name__ == "__main__":
    main()
