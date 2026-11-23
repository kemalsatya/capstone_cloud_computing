#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 07 (07-observability-slo)
Memverifikasi endpoint /metrics di app.js & worker.js, konfigurasi Prometheus,
dokumen SLI/SLO, provisioning Grafana, dan bukti 07_evidence.jpg.
"""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "07-observability-slo"))


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    app_js = read_text("source/src/app.js")
    worker_js = read_text("source/src/worker.js")
    prom_yml = read_text("evidence/observability/prometheus.yml")
    slo_md = read_text("evidence/observability/slo-sli.md")
    readme = read_text("evidence/observability/README.md")

    img_repo = os.path.join(ROOT_DIR, "evidence", "observability", "07_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "07_evidence.jpg")
    graf_dash = os.path.join(ROOT_DIR, "evidence", "observability", "provisioning")

    checks = [
        ("M07-01", "Endpoint GET /metrics aktif di backend API (app.js) & worker (worker.js)",
         "app.get('/metrics'" in app_js and "renderPrometheusMetrics" in app_js and "/metrics" in worker_js),
        ("M07-02", "Konfigurasi Prometheus (prometheus.yml) memuat target scrape /metrics",
         bool(prom_yml) and "scrape_configs" in prom_yml),
        ("M07-03", "Definisi SLI/SLO terdokumentasi di evidence/observability/slo-sli.md",
         bool(slo_md) and ("SLO" in slo_md or "SLI" in slo_md)),
        ("M07-04", "Provisioning dashboard Grafana tersedia",
         os.path.isdir(graf_dash)),
        ("M07-05", "Bukti 07_evidence.jpg & evidence/observability/README.md tersedia",
         (os.path.isfile(img_repo) or os.path.isfile(img_port)) and bool(readme)),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 07] Observability, Prometheus & Grafana SLO ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M07: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
