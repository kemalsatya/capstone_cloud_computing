# JournalFit — Capstone Project Cloud Computing

Repositori proyek akhir Cloud Computing: **JournalFit**, sistem manajemen dan pemeriksaan format naskah ilmiah (`.docx`) berbasis **Multi-Tenant Modular Monolith** dengan pemrosesan asinkron (`pg-boss`), autentikasi OIDC/JWT (**Keycloak 26.8.2**), orkestrasi **Kubernetes (`k3d`)**, **GitOps (Argo CD)**, dan observability (**Prometheus + Grafana**).

---

## Ringkasan Stack & Status Terkini

| Komponen | Spesifikasi / Status Terverifikasi |
| :--- | :--- |
| **Backend & Worker** | Node.js 22 (`node:22-alpine`, non-root `USER node`, `dumb-init`), Express `5.3.0`, OpenAPI/Swagger UI (`/docs`, `/openapi.yaml`), pod `worker-format` + `worker-scope` |
| **Async Job & OOXML Engine** | `pg-boss` (`format-check` + `scope-check` + DLQ), parser native `jszip` + `fast-xml-parser` untuk Tier-1 rules `FMT-001..009`, scope AI Groq/mock dengan validasi JSON dan pencatatan token/biaya |
| **Auth & Multi-Tenant** | Keycloak `26.8.2` (OIDC RS256 JWKS, `jose`), isolasi tenant & RBAC terverifikasi (`404` cross-tenant, `403` RBAC, `63/64` tests PASS + 1 skipped golden; `64/64` dengan template lokal) |
| **Artifact K8s Teruji** | `registry:5000/journalfit-backend:0c2cf92` (non-root runtime, Kustomize + `db-setup` Job) |
| **Kluster & Delivery** | `k3d-capstone`, namespace `default`, Traefik Ingress (`:8088`), HPA (`2->3->2`, `19.865 req / 0 fail`), Argo CD GitOps (`automation/argocd/application.yaml`) |
| **Observability & Recovery** | `GET /metrics` + Prometheus (`:9090`) + Grafana (`:3000`); Pod self-healing `7.1s`, DB Restore RTO `0.78s`, Rolling Update `777 req / 0 fail / p95 26.73ms` |
| **Scope Boundary (v1 vs v2)** | Pemeriksaan format deterministik (`FMT-001..009`) aktif penuh; scope checker Groq/mock, API tenant admin, list/detail/history naskah, dan Garage S3 single-node sudah ada; Garage multi-node/multi-AZ tetap **Roadmap v2** |

---

## Indeks Artefak & Evidence (`01`–`11`)

| No | Domain | Lokasi Utama |
| :--- | :--- | :--- |
| `01` | Business & Strategy | [`evidence/business/`](evidence/business/) |
| `02` | Architecture (ArchiMate 3.2) | [`architecture/journalfit-architecture.archimate`](architecture/journalfit-architecture.archimate) & [`evidence/architecture/`](evidence/architecture/) |
| `03` | Application & Data | [`source/`](source/) & [`evidence/application-data/`](evidence/application-data/) |
| `04` | Platform & Kubernetes | [`deployment/`](deployment/) & [`evidence/platform/README.md`](evidence/platform/README.md) |
| `05` | CI/CD & GitOps Delivery | [`automation/argocd/`](automation/argocd/) & [`evidence/delivery/`](evidence/delivery/) |
| `06` | Security & Multi-Tenant Isolation | [`source/AUTH.md`](source/AUTH.md) & [`evidence/security/`](evidence/security/) |
| `07` | Observability & SLO | [`evidence/observability/`](evidence/observability/) |
| `08` | Reliability & Recovery | [`evidence/reliability-recovery/README.md`](evidence/reliability-recovery/README.md) |
| `09` | Capacity & FinOps | [`evidence/capacity-finops/`](evidence/capacity-finops/) |
| `10` | Architecture Decisions (ADR) | [`decisions/README.md`](decisions/README.md) |
| `11` | Demo & Defense | [`demo/README.md`](demo/README.md) |

Dokumen pendukung:
- [Setup lokal Docker Compose (`docs/SETUP-LOCAL.md`)](docs/SETUP-LOCAL.md)
- [Setup Kubernetes k3d (`docs/SETUP-K8S.md`)](docs/SETUP-K8S.md)
- [Panduan Otomasi & Verifikasi (`automation/README.md`)](automation/README.md)
- [Panduan Manifest & Deployment (`deployment/README.md`)](deployment/README.md)
- [Kontrak Integrasi (`deployment/INTEGRATION_CONTRACT.md`)](deployment/INTEGRATION_CONTRACT.md)
- [Roadmap & Batasan Ruang Lingkup (`roadmap.md`)](roadmap.md)

---

## Panduan Cepat Menjalankan Sistem

Detail lengkap seluruh skrip operasional, pengujian per milestone, dan generator tersedia di [`automation/README.md`](automation/README.md).

### 0. Cek Kesiapan Environment & E2E Test
```bash
# Cek prasyarat tools & port
bash automation/scripts/doctor.sh

# Jalankan full live E2E test seluruh milestone (+ Trivy scan)
bash automation/scripts/e2e-milestone-test.sh --with-trivy

# Jalankan pengujian operasional & verifikasi modular per milestone (01–11)
bash automation/scripts/tests/run-milestone-tests.sh all --allow-pending
```

### 1. Mode Local Development (Docker Compose)
```bash
cp .env.example .env
docker compose up -d postgres keycloak app

# Cek health & metrics
curl -i http://localhost:8000/health/live
curl -i http://localhost:8000/health/ready
curl -i http://localhost:8000/metrics
```
Autentikasi Keycloak (realm `journalfit` otomatis terimpor):
```bash
TOKEN=$(curl -s -X POST "http://localhost:8081/realms/journalfit/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=journalfit-app&username=author.a&password=author.a&scope=openid profile email" \
  | jq -r .access_token)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me
```
Detail user demo, role, dan `AUTH_MODE` ada di [`source/AUTH.md`](source/AUTH.md). Hentikan stack dengan `docker compose down`.

### 2. Mode Kubernetes & `k3d`
```bash
docker compose --profile ci-cd up -d registry
bash automation/scripts/create-cluster.sh
bash automation/scripts/setup-keycloak.sh

kubectl apply --dry-run=server -k deployment/
kubectl apply -k deployment/
kubectl -n default get deployment,pods,service,ingress,pvc,hpa

# Akses melalui Traefik Ingress (:8088)
curl -i -H "Host: journalfit.localhost" http://localhost:8088/health/ready
curl -i -H "Host: keycloak.localhost" http://localhost:8088/realms/journalfit
```

### 3. Mode CI/CD & GitOps (Argo CD)
```bash
docker compose --profile ci-cd up -d
bash automation/scripts/install-argocd.sh

bash automation/scripts/build-and-tag.sh
bash automation/scripts/prepare-image-update.sh <7-char-sha>
bash automation/scripts/simulate-rollback.sh
```

### 4. Mode Observability & Disaster Recovery
```bash
# Prometheus (:9090) & Grafana (:3000, default admin/admin)
docker compose --profile observability up -d

# Backup & uji restore PostgreSQL
bash automation/scripts/db-backup-restore.sh backup
bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/<nama_file_backup>.sql
```

---

## Struktur Repositori

```text
capstone_cloud_computing/
├── .env.example                     # Template konfigurasi environment
├── .gitignore                       # Guard artifact lokal, node_modules, dan .env
├── docker-compose.yml               # Stack multi-profile mandiri
├── README.md                        # Panduan utama proyek
├── roadmap.md                       # Checklist status & batasan ruang lingkup
├── architecture/                    # Model ArchiMate 3.2 (.archimate) & PNG views
├── source/                          # Backend Express.js, pg-boss worker, OOXML engine & Dockerfile
│   ├── src/                         # Modular monolith modules
│   ├── schema.sql                   # DDL skema 6 tabel & seed data
│   ├── tests/                       # Unit & HTTP integration tests (node --test)
│   └── Dockerfile                   # Node.js 22 Alpine non-root runtime container
├── deployment/                      # Manifest K8s (Deployment, Worker, Job, Service, PVC, Ingress, HPA)
├── automation/                      # CI/CD, Argo CD, skrip E2E, milestone tests & generators
│   ├── README.md                    # Panduan lengkap eksekusi otomasi
│   ├── argocd/                      # Argo CD Application manifest
│   └── scripts/                     # Operational *.sh, tests/ (01–11), dan generators/
├── evidence/                        # Bukti verifikasi 01–09
├── decisions/                       # Architecture Decision Records (ADR-001..009)
├── demo/                            # Panduan Demo 11, E2E log & 12 Q&A defense
└── individual-reflections/          # Refleksi individual anggota
```

---

## Standar Kolaborasi
- Tidak ada direct commit ke `main` atau `force push`.
- Seluruh perubahan melalui feature branch, Pull Request, dan review.
- Jangan menyimpan kredensial nyata (`.env`, password DB, token) di repositori.
