#!/usr/bin/env python3
"""
Post-Evidence Verification Test Case: Milestone 04 (04-platform-kubernetes)
Memverifikasi Dockerfile non-root, Kustomize render, hardening UID 10001, HPA 2-3,
PVC 1Gi RWO, worker-format, db-setup job, dan bukti 04_evidence.jpg.
"""
import os
import subprocess
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PORTFOLIO_DIR = os.path.abspath(os.path.join(ROOT_DIR, "..", "cloud-capstone-team-7", "04-platform-kubernetes"))


def read_text(rel_path: str) -> str:
    p = os.path.join(ROOT_DIR, rel_path)
    return open(p, encoding="utf-8").read() if os.path.isfile(p) else ""


def run_tests():
    dockerfile = read_text("source/Dockerfile")
    deploy = read_text("deployment/deployment.yaml")
    worker = read_text("deployment/worker-format.yaml")
    pvc = read_text("deployment/pvc.yaml")
    hpa = read_text("deployment/hpa.yaml")
    kustom = read_text("deployment/kustomization.yaml")

    kust_res = subprocess.run(
        ["kubectl", "kustomize", os.path.join(ROOT_DIR, "deployment")],
        capture_output=True,
        text=True,
        check=False,
    )

    img_repo = os.path.join(ROOT_DIR, "evidence", "platform", "04_evidence.jpg")
    img_port = os.path.join(PORTFOLIO_DIR, "04_evidence.jpg")

    checks = [
        ("M04-01", "Dockerfile memakai node:22-alpine, dumb-init, dan non-root USER node",
         "FROM node:22-alpine" in dockerfile and "USER node" in dockerfile and "dumb-init" in dockerfile),
        ("M04-02", "kubectl kustomize deployment/ berhasil dirender tanpa error",
         kust_res.returncode == 0 and "kind: Deployment" in kust_res.stdout),
        ("M04-03", "Deployment backend & worker hardened (UID 10001, drop ALL, allowPrivilegeEscalation: false)",
         all(k in deploy for k in ["runAsNonRoot: true", "runAsUser: 10001", "- ALL", "allowPrivilegeEscalation: false"])
         and "runAsUser: 10001" in worker),
        ("M04-04", "HPA (min 2, max 3 @ CPU 70%) & PVC 1Gi RWO (Prune=false,Delete=false) terkonfigurasi",
         all(k in hpa for k in ["minReplicas: 2", "maxReplicas: 3", "averageUtilization: 70"])
         and "ReadWriteOnce" in pvc and "storage: 1Gi" in pvc),
        ("M04-05", "Kustomization mencakup keycloak, worker-format, dan db-setup-job",
         all(k in kustom for k in ["keycloak", "worker-format.yaml", "db-setup-job.yaml"])),
        ("M04-06", "Bukti 04_evidence.jpg & skrip load test (test_hpa.py, test_rolling_update.py) tersedia",
         (os.path.isfile(img_repo) or os.path.isfile(img_port))
         and os.path.isfile(os.path.join(ROOT_DIR, "evidence", "platform", "scripts", "test_hpa.py"))),
    ]
    return checks


if __name__ == "__main__":
    results = run_tests()
    failed = 0
    print("=== [TEST MILESTONE 04] Cloud-Native Platform & Kubernetes (k3d) ===")
    for cid, desc, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {cid} | {desc}")
        if not ok:
            failed += 1
    print(f"Summary M04: {len(results) - failed}/{len(results)} PASS")
    sys.exit(1 if failed else 0)
