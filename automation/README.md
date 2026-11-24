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
| `fix-k3d-host-alias.sh` | Pastikan `host.k3d.internal` resolve ke gateway host di CoreDNS (cluster existing) | `bash automation/scripts/fix-k3d-host-alias.sh` |
| `setup-keycloak.sh` | Siapkan database `keycloak` & Kubernetes Secret Keycloak | `bash automation/scripts/setup-keycloak.sh` |
| `install-argocd.sh` | Pasang Argo CD di namespace `argocd` dan terapkan `automation/argocd/application.yaml` | `bash automation/scripts/install-argocd.sh` |
| `build-and-tag.sh` | Build image `journalfit-backend:<sha7>` dan push ke registry host (`localhost:5001`); pod menarik dari alias cluster `registry:5000` | `bash automation/scripts/build-and-tag.sh` |
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

## 2. Pengujian Operasional & Verifikasi Modular Per Milestone (`automation/scripts/tests/*.sh`)

Setiap skrip di `automation/scripts/tests/` berbentuk **Bash (`.sh`)** yang langsung **menjalankan perintah operasional live di terminal** (`npm test`, `curl`, `psql`, `kubectl get/top`, `docker stats`, `db-backup-restore.sh`, Keycloak JWT/RBAC/cross-tenant, Trivy) lalu mencetak hasil verifikasi `[PASS]`/`[FAIL]`/`[SKIP]`/`[PEND]` di bagian akhir.

### Jalankan Semua Milestone Sekaligus
```bash
# Mode standar (strict: seluruh 01–11 wajib PASS)
bash automation/scripts/tests/run-milestone-tests.sh all

# Izinkan milestone yang masih PENDING (mis. 09 sebelum paket Capacity/FinOps selesai)
bash automation/scripts/tests/run-milestone-tests.sh all --allow-pending

# Jalankan subset milestone tertentu (+ Trivy di M06, 10.000-req load test di M04, Argo CD self-heal di M05)
bash automation/scripts/tests/run-milestone-tests.sh 04 05 06 --with-load-test --with-drift-test --with-trivy
```

### Jalankan Per Milestone Secara Mandiri
| Milestone | Domain & Proses Live yang Dijalankan | Perintah |
| :--- | :--- | :--- |
| `01` | Business & Strategy (inspeksi artefak + 9-field) | `bash automation/scripts/tests/test-milestone-01-business.sh` |
| `02` | Architecture (ArchiMate 3.2 views, PNG captures, boundaries) | `bash automation/scripts/tests/test-milestone-02-architecture.sh` |
| `03` | Application & Data (`npm test`, live `/health`, `psql \dt` 6 tabel) | `bash automation/scripts/tests/test-milestone-03-application-data.sh` |
| `04` | Platform & Kubernetes (`kustomize`, `kubectl get all`, live Ingress `:8088`, opsional `--with-load-test` 10.000 req) | `bash automation/scripts/tests/test-milestone-04-platform-k8s.sh --with-load-test` |
| `05` | CI/CD & GitOps (`newTag` SHA-7, live registry `:5001`, live Argo CD status, opsional `--with-drift-test` self-heal) | `bash automation/scripts/tests/test-milestone-05-cicd-gitops.sh --with-drift-test` |
| `06` | Security (live Keycloak JWT, `401`/`404` cross-tenant/`403` RBAC, `--with-trivy`) | `bash automation/scripts/tests/test-milestone-06-security.sh` |
| `07` | Observability (live `/metrics`, 10-req SLO probe, Prometheus `:9090` & Grafana `:3000`) | `bash automation/scripts/tests/test-milestone-07-observability.sh` |
| `08` | Reliability & Recovery (live `pg_dump` backup + isolated DB restore drill + K8s pods) | `bash automation/scripts/tests/test-milestone-08-reliability.sh` |
| `09` | Capacity & FinOps (live `docker stats`, `kubectl top pods`, requests/limits) | `bash automation/scripts/tests/test-milestone-09-capacity-finops.sh` |
| `10` | Architecture Decisions (`ADR-001..009` conformance check terhadap codebase & manifest) | `bash automation/scripts/tests/test-milestone-10-adr.sh` |
| `11` | Demo & Defense (live `doctor.sh`, ping semua endpoint demo, 12 Q&A §13.1) | `bash automation/scripts/tests/test-milestone-11-demo.sh` |

---

> **M06 di K8s:** set `APP_URL=http://journalfit.localhost:8088` dan `KEYCLOAK_URL=http://keycloak.localhost:8088` sebelum menjalankan `test-milestone-06-security.sh`.

## 3. Generator Diagram & Evidence (`automation/scripts/generators/`)

Membutuhkan Python 3 + Pillow (`pip install pillow`).

| Skrip | Output Utama | Perintah |
| :--- | :--- | :--- |
| `generate_business_archimate.py` | `evidence/business/business-archimate.svg` & `01_evidence.jpg` | `python automation/scripts/generators/generate_business_archimate.py` |
| `generate_archimate_file.py` | `architecture/journalfit-architecture.archimate` (Archi 5.0 EMF valid, 4 views) | `python automation/scripts/generators/generate_archimate_file.py` |
| `generate_adr_diagram.py` | `decisions/10_evidence.jpg` (peta keputusan ADR-001..009) | `python automation/scripts/generators/generate_adr_diagram.py` |
| `render_evidence_images.py` | Render ulang komposit image evidence (`02_evidence.jpg`, `11_evidence.jpg`, dll.) | `python automation/scripts/generators/render_evidence_images.py` |

> **Catatan:** Untuk mengubah `architecture/journalfit-architecture.archimate` menjadi PNG view di `architecture/images/`, buka file `.archimate` menggunakan aplikasi **Archi 5.x** dan export 4 view (`01-motivation-view.png` s.d. `04-technology-trust-boundaries.png`).
