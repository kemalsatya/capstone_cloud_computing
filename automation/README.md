# Automation & Verification Suite — JournalFit

Direktori ini berisi seluruh skrip otomasi operasional (cluster, CI/CD, Keycloak, backup/restore, E2E live test), pengujian modular per milestone (`01`–`11`), generator diagram/artefak, dan manifest GitOps Argo CD.

---

## Struktur Direktori

```text
automation/
├── README.md                          # Dokumen ini
├── argocd/
│   └── application.yaml               # Argo CD Application manifest (GitOps -> deployment/)
├── handoff/                           # Catatan & patch integrasi CI
└── scripts/
    ├── *.sh                           # Skrip operasional live & E2E runner
    ├── tests/                         # Post-evidence verifier modular per milestone (01–11)
    └── generators/                    # Generator ArchiMate, ADR diagram, & image evidence
```

---

## 1. Skrip Operasional & Live E2E (`automation/scripts/*.sh`)

Jalankan seluruh perintah dari root repositori (`capstone_cloud_computing/`) menggunakan **Git Bash** (Windows) atau **Bash** (Linux/macOS).

| Skrip | Fungsi | Perintah |
| :--- | :--- | :--- |
| `doctor.sh` | Cek prasyarat tools (`git`, `docker`, `node`, `kubectl`, `k3d`, `jq`, port) | `bash automation/scripts/doctor.sh` |
| `create-cluster.sh` | Buat kluster `k3d-capstone` terintegrasi registry lokal & Traefik Ingress (`:8088`) | `bash automation/scripts/create-cluster.sh` |
| `setup-keycloak.sh` | Siapkan database `keycloak` & Kubernetes Secret Keycloak | `bash automation/scripts/setup-keycloak.sh` |
| `install-argocd.sh` | Pasang Argo CD di namespace `argocd` dan terapkan `automation/argocd/application.yaml` | `bash automation/scripts/install-argocd.sh` |
| `build-and-tag.sh` | Build image `journalfit-backend:<sha7>` dan push ke registry lokal (`localhost:5000`) | `bash automation/scripts/build-and-tag.sh` |
| `prepare-image-update.sh` | Update tag image immutable (`SHA7`) pada `deployment/kustomization.yaml` | `bash automation/scripts/prepare-image-update.sh <7-char-sha>` |
| `simulate-rollback.sh` | Simulasi rollback GitOps / Kubernetes Deployment ke revisi stabil sebelumnya | `bash automation/scripts/simulate-rollback.sh` |
| `db-backup-restore.sh` | Backup `pg_dump` & uji restore Disaster Recovery PostgreSQL (`journalfit` + `keycloak`) | `bash automation/scripts/db-backup-restore.sh backup` / `restore <file.sql>` |
| `capture-evidence-06-08-09-10.sh` | Capture bukti live untuk Security (`06`), Reliability (`08`), Capacity (`09`), & ADR (`10`) | `bash automation/scripts/capture-evidence-06-08-09-10.sh` |
| `e2e-milestone-test.sh` | **Master E2E Live Test** seluruh stack (App, DB, Docker non-root, K8s/Argo CD, Security/Cross-Tenant, Observability, Backup/Restore, Trivy) | `bash automation/scripts/e2e-milestone-test.sh --with-trivy` |

### Opsi Flag `e2e-milestone-test.sh`
```bash
# Full live E2E + Trivy image vulnerability scan
bash automation/scripts/e2e-milestone-test.sh --with-trivy

# Lewati komponen tertentu bila hanya ingin menguji sebagian stack
bash automation/scripts/e2e-milestone-test.sh --skip-k8s --skip-argocd
bash automation/scripts/e2e-milestone-test.sh --skip-observability
```

---

## 2. Pengujian Modular Per Milestone (`automation/scripts/tests/`)

Digunakan untuk memverifikasi kelengkapan evidence, kontrak 9-field Evidence Standard, manifest K8s, ADR conformance, serta menjalankan unit/integration test aplikasi (`source/tests/` via `npm test`) secara terpisah per milestone.

### Jalankan Semua Milestone Sekaligus
```bash
# Mode standar (strict: seluruh 01–11 wajib PASS)
python automation/scripts/tests/run_milestone_tests.py all

# Izinkan milestone yang masih PENDING (mis. 09 sebelum paket Capacity/FinOps selesai)
python automation/scripts/tests/run_milestone_tests.py all --allow-pending

# Jalankan subset milestone tertentu
python automation/scripts/tests/run_milestone_tests.py 01 02 06 10 11
```

### Jalankan Per Milestone Secara Mandiri
| Milestone | Domain | Perintah |
| :--- | :--- | :--- |
| `01` | Business & Strategy | `python automation/scripts/tests/test_milestone_01_business.py` |
| `02` | Architecture (ArchiMate 3.2) | `python automation/scripts/tests/test_milestone_02_architecture.py` |
| `03` | Application & Data (`npm test` + schema + OOXML/worker) | `python automation/scripts/tests/test_milestone_03_application_data.py` |
| `04` | Platform & Kubernetes | `python automation/scripts/tests/test_milestone_04_platform_k8s.py` |
| `05` | CI/CD & GitOps Delivery | `python automation/scripts/tests/test_milestone_05_cicd_gitops.py` |
| `06` | Security, Keycloak JWT & Cross-Tenant Isolation | `python automation/scripts/tests/test_milestone_06_security.py` |
| `07` | Observability & SLO | `python automation/scripts/tests/test_milestone_07_observability.py` |
| `08` | Reliability & Recovery (RTO/RPO) | `python automation/scripts/tests/test_milestone_08_reliability.py` |
| `09` | Capacity & FinOps | `python automation/scripts/tests/test_milestone_09_capacity_finops.py` |
| `10` | Architecture Decisions (ADR Conformance) | `python automation/scripts/tests/test_milestone_10_adr.py` |
| `11` | Demo & Defense | `python automation/scripts/tests/test_milestone_11_demo.py` |

---

## 3. Generator Diagram & Evidence (`automation/scripts/generators/`)

Membutuhkan Python 3 + Pillow (`pip install pillow`).

| Skrip | Output Utama | Perintah |
| :--- | :--- | :--- |
| `generate_business_archimate.py` | `evidence/business/business-archimate.svg` & `01_evidence.jpg` | `python automation/scripts/generators/generate_business_archimate.py` |
| `generate_archimate_file.py` | `architecture/journalfit-architecture.archimate` (Archi 5.0 EMF valid, 4 views) | `python automation/scripts/generators/generate_archimate_file.py` |
| `generate_adr_diagram.py` | `decisions/10_evidence.jpg` (peta keputusan ADR-001..009) | `python automation/scripts/generators/generate_adr_diagram.py` |
| `render_evidence_images.py` | Render ulang komposit image evidence (`02_evidence.jpg`, `11_evidence.jpg`, dll.) | `python automation/scripts/generators/render_evidence_images.py` |

> **Catatan:** Untuk mengubah `architecture/journalfit-architecture.archimate` menjadi PNG view di `architecture/images/`, buka file `.archimate` menggunakan aplikasi **Archi 5.x** dan export 4 view (`01-motivation-view.png` s.d. `04-technology-trust-boundaries.png`).
