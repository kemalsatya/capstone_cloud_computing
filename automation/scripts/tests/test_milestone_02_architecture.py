#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 02 (02-architecture)
Memverifikasi 02_evidence.jpg, XML valid native Archi (.archimate) dengan 4 views,
9-field Evidence Standard, Trust/Failure Boundaries, dan sinkronisasi stack main (7e8607b).
"""
import os
import sys
import xml.etree.ElementTree as ET

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "02-architecture"))

REQUIRED_9_FIELDS = [
    "Scope", "Owner", "Source / Version", "Timestamp",
    "Method", "Observation", "Interpretation", "Limitation", "Decision Supported",
]


def run_tests():
    readme_path = os.path.join(ROOT_DIR, "evidence", "architecture", "README.md")
    img_repo = os.path.join(ROOT_DIR, "evidence", "architecture", "02_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "02_evidence.jpg")
    archi_path = os.path.join(ROOT_DIR, "architecture", "journalfit-architecture.archimate")
    img_dir = os.path.join(ROOT_DIR, "architecture", "images")

    readme = open(readme_path, encoding="utf-8").read() if os.path.isfile(readme_path) else ""
    archi_text = open(archi_path, encoding="utf-8").read() if os.path.isfile(archi_path) else ""

    archi_valid = False
    view_count = 0
    if archi_text:
        try:
            root = ET.fromstring(archi_text)
            view_count = len([el for el in root.iter() if el.attrib.get("{http://www.w3.org/2001/XMLSchema-instance}type") == "archimate:ArchimateDiagramModel"])
            archi_valid = root.tag.endswith("model") and "DiagramModelNote" not in archi_text
        except ET.ParseError:
            archi_valid = False

    view_pngs = [
        "01-motivation-view.png",
        "02-layered-view.png",
        "03-application-cooperation-view.png",
        "04-technology-trust-boundaries.png",
    ]
    all_pngs_exist = all(os.path.isfile(os.path.join(img_dir, fn)) for fn in view_pngs)
    no_html_left = not os.path.exists(os.path.join(ROOT_DIR, "architecture", "archimate-diagram.html"))

    checks = [
        ("M02-01", "File evidence/architecture/README.md lengkap 9-field Evidence Standard (§9)",
         bool(readme) and all(f in readme for f in REQUIRED_9_FIELDS)),
        ("M02-02", "Gambar 02_evidence.jpg (pure Archi captures) ter-render (> 100 KB) di repo & portofolio",
         os.path.isfile(img_repo) and os.path.getsize(img_repo) > 100_000 and os.path.isfile(img_port) and os.path.getsize(img_port) > 100_000),
        ("M02-03", "File native Archi (.archimate) valid XML EMF dengan 4 views + 4 PNG capture murni Archi (tanpa HTML)",
         archi_valid and view_count == 4 and all_pngs_exist and no_html_left),
        ("M02-04", "Model ArchiMate sinkron dengan stack terbaru (Keycloak 26.8.2, pg-boss, jszip, tag 0c2cf92)",
         all(k in archi_text for k in ["26.8.2", "pg-boss", "jszip", "0c2cf92", "worker-format"])),
        ("M02-05", "Trust Boundaries (TB-1..TB-4) & Failure Boundaries (FB-1..FB-3) terdokumentasi di model",
         all(k in archi_text for k in ["TB-1", "TB-4", "FB-2", "FB-3"])),
        ("M02-06", "Angka realisasi 08_evidence sinkron (Self-Healing 7.1s & Restore RTO 0.78s)",
         "7.1" in archi_text and "0.78" in archi_text),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 02] System Architecture & ArchiMate 3.2 ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M02: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
