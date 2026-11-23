#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 05 (05-ci-cd-gitops)
Memverifikasi pipeline CI (GitHub Actions & Gitea) Node 22 + Trivy,
Argo CD GitOps Application (main, selfHeal, ignoreDifferences HPA),
tag immutable SHA-7 di kustomization.yaml, dan 05_evidence.jpg.
"""
import os
import re
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "05-ci-cd-gitops"))


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    gh_ci = read_text(".github/workflows/ci.yaml")
    gitea_ci = read_text(".gitea/workflows/ci.yml")
    argo = read_text("automation/argocd/application.yaml")
    kustom = read_text("deployment/kustomization.yaml")
    readme = read_text("evidence/delivery/README.md")

    img_repo = os.path.join(ROOT_DIR, "evidence", "delivery", "05_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "05_evidence.jpg")

    checks = [
        ("M05-01", "GitHub Actions CI & Gitea CI memuat test suite + Trivy scan gate",
         "trivy" in gh_ci.lower() and "trivy" in gitea_ci.lower() and "npm test" in gh_ci),
        ("M05-02", "Argo CD Application valid (targetRevision: main, path: deployment, selfHeal: true, ignoreDifferences HPA)",
         all(k in argo for k in ["targetRevision: main", "path: deployment", "selfHeal: true", "/spec/replicas"])),
        ("M05-03", "deployment/kustomization.yaml menggunakan immutable SHA-7 newTag (bukan :latest)",
         re.search(r"newTag:\s*[0-9a-f]{7}\b", kustom) is not None and "newTag: latest" not in kustom),
        ("M05-04", "Skrip delivery (build-and-tag.sh, install-argocd.sh, simulate-rollback.sh) tersedia",
         all(os.path.isfile(os.path.join(ROOT_DIR, "automation", "scripts", s))
             for s in ["build-and-tag.sh", "install-argocd.sh", "simulate-rollback.sh"])),
        ("M05-05", "Bukti 05_evidence.jpg & evidence/delivery/README.md tersedia",
         (os.path.isfile(img_repo) or os.path.isfile(img_port)) and bool(readme)),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 05] CI/CD, Immutable Artifact & GitOps (Argo CD) ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M05: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
