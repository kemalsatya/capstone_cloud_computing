#!/usr/bin/env python3
"""
Unified Post-Evidence Milestone Test Runner (Separated from Generators).
Usage:
  python automation/scripts/tests/run_milestone_tests.py all
  python automation/scripts/tests/run_milestone_tests.py 01 02 10 11
"""
import os
import subprocess
import sys

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))

MILESTONE_SCRIPTS = {
    "01": "test_milestone_01_business.py",
    "02": "test_milestone_02_architecture.py",
    "10": "test_milestone_10_adr.py",
    "11": "test_milestone_11_demo.py",
}


def main():
    args = sys.argv[1:] or ["all"]
    targets = list(MILESTONE_SCRIPTS.keys()) if "all" in args else [a.zfill(2) for a in args]

    overall_fail = 0
    print("=" * 78)
    print("  JOURNALFIT — POST-EVIDENCE MILESTONE TEST RUNNER (TEAM 7)")
    print("=" * 78)

    for m in targets:
        script = MILESTONE_SCRIPTS.get(m)
        if not script:
            print(f"  [SKIP] Milestone {m}: belum ada test script khusus di automation/scripts/tests/")
            continue
        script_path = os.path.join(TESTS_DIR, script)
        res = subprocess.run([sys.executable, script_path], check=False)
        if res.returncode != 0:
            overall_fail += 1
        print("-" * 78)

    print(f"OVERALL RESULT: {'ALL PASSED' if overall_fail == 0 else f'{overall_fail} MILESTONE SUITE(S) FAILED'}")
    sys.exit(1 if overall_fail else 0)


if __name__ == "__main__":
    main()
