#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 01 (01-business)
Memverifikasi kelengkapan evidence, 9-field Evidence Standard (Guideline 2 §9),
keberadaan gambar 01_evidence.jpg, dan kejujuran scope v1 vs Roadmap v2.
"""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "01-business"))

REQUIRED_9_FIELDS = [
    "Scope", "Owner", "Source / Version", "Timestamp",
    "Method", "Observation", "Interpretation", "Limitation", "Decision Supported",
]


def run_tests():
    readme_path = os.path.join(ROOT_DIR, "evidence", "business", "README.md")
    img_repo = os.path.join(ROOT_DIR, "evidence", "business", "01_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "01_evidence.jpg")
    svg_path = os.path.join(ROOT_DIR, "evidence", "business", "business-archimate.svg")

    readme = open(readme_path, encoding="utf-8").read() if os.path.isfile(readme_path) else ""
    svg = open(svg_path, encoding="utf-8").read() if os.path.isfile(svg_path) else ""

    checks = [
        ("M01-01", "File evidence/business/README.md tersedia", bool(readme)),
        ("M01-02", "9-field Evidence Standard (§9) lengkap di README", all(f in readme for f in REQUIRED_9_FIELDS)),
        ("M01-03", "Gambar 01_evidence.jpg ter-render (> 50 KB) di repo & portofolio",
         os.path.isfile(img_repo) and os.path.getsize(img_repo) > 50_000 and os.path.isfile(img_port) and os.path.getsize(img_port) > 50_000),
        ("M01-04", "ArchiMate 3.2 Motivation/Business/Strategy SVG tersedia",
         "MOTIVATION LAYER" in svg and "BUSINESS LAYER" in svg and "STRATEGY LAYER" in svg),
        ("M01-05", "Menjelaskan 5 Pilar Cloud-Native & Alternatif Ditolak",
         "Rapid Elasticity" in svg and "Alternatif yang Ditolak" in svg),
        ("M01-06", "Kejujuran Scope (§14.2): Groq AI & Garage S3 dicatat di Roadmap v2",
         "Roadmap" in svg and "Groq" in svg and "Garage" in svg),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 01] Business Case & Cloud Rationale ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M01: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
