# JournalFit - Capstone Project Cloud Computing

Repositori proyek akhir Cloud Computing: Sistem Manajemen & Pemeriksaan Format Naskah Ilmiah Multi-Tenant (**JournalFit**).
Backend modular monolith menggunakan Express/Node.js, PostgreSQL 17, dan Keycloak OIDC IAM.

## Status Platform & Verifikasi M3 per 2026-11-22

**Baseline M3 telah diverifikasi pada lingkungan lokal:** image backend berjalan pada
dua pod non-root (`UID 10001`), transaksi DOCX berhasil, dan data/file tetap tersedia setelah penggantian
pod serta rolling update. Integrasi Keycloak OIDC telah terpasang via Ingress Traefik.
[Bukti pengujian langsung](evidence/platform/m3-live-20261117/README.md)
dan [pengukuran Tahap 6](evidence/platform/tahap-6/README.md).
Endpoint demo: **http://journalfit.localhost:8088/** dan Keycloak: **http://keycloak.localhost:8088/**.

### Mulai presentasi cepat dengan Compose / Script

Jalankan dari root repository dengan PowerShell:

```powershell
.\start-presentasi.ps1 -UploadFixture -BukaBrowser
```

Script [start-presentasi.ps1](start-presentasi.ps1) menjalankan Compose, menunggu
pesan `[M3 SIAP]`, menampilkan node/workload/PVC dan readiness, mengunggah satu
DOCX QA dari repo, lalu menampilkan laporannya. `-BukaBrowser` membuka
**http://journalfit.localhost:8088/**.

---

## 👥 Pembagian Peran Anggota Kelompok

| Peran | Anggota | Fokus Utama & Direktori Kerja |
| :--- | :--- | :--- |
| **Anggota 1** | Aplikasi & Data | Backend modular monolith (`source/`), PostgreSQL DDL schema (`source/schema.sql`), unit test (`source/tests/`). |
| **Anggota 2** | Platform & Kubernetes | Containerization (`source/Dockerfile`), K8s manifest (`deployment/`), k3d cluster setup, Ingress, HPA, PVC. |
| **Anggota 3** | CI/CD & GitOps | Pipeline delivery & security scanning (`automation/`), Argo CD application (`automation/argocd/application.yaml`). |
| **Anggota 4** | Security, Ops & Recovery | Trivy vulnerability scan, backup & disaster recovery DB, observability Grafana/Prometheus (`evidence/`). |

---

## 📚 Dokumen Referensi & Bukti Platform

1. [Roadmap dan panduan command M3](deployment/PANDUAN_M3.md)
2. [Indeks pemeriksaan dan evidence platform aktif](evidence/platform/README.md)
3. [Peta manifest yang akan ditinjau](deployment/README.md)
4. [Kontrak integrasi M2 ke M3](deployment/INTEGRATION_CONTRACT.md)
5. [Ringkasan capaian dan batas M3](evidence/platform/RINGKASAN_M3_ANGGOTA_2.md)
6. [Asal, status, dan integritas arsip](evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md)

| Bagian | Versi / Status Terkini |
| :--- | :--- |
| **Dockerfile source** | `node:22-alpine`, non-root `10001:10001`, `dumb-init`, port `8000`. |
| **Artifact K8s teruji** | `registry:5000/journalfit-backend:2dc3593` (runtime UID `10001`). |
| **Konfigurasi kluster** | Context `k3d-capstone`, namespace `default`, `DB_HOST=host.docker.internal`. |
| **Keycloak IAM** | `keycloak:8080`, Ingress `keycloak.localhost`, Realm `journalfit`. |
| **Observability** | Endpoint `GET /metrics` + Prometheus (`:9090`) + Grafana (`:3000`). |

---

## 🚀 Panduan Eksekusi di Laptop Anggota

Repositori ini telah dilengkapi dengan infrastruktur mandiri berbasis **Docker Compose** dan skrip otomasi yang dapat dijalankan langsung di masing-masing laptop anggota.

### 0. Diagnosa Kesiapan Laptop & End-to-End Milestone Test
Periksa kesiapan dependensi (`git`, `docker`, `node`, `kubectl`, `k3d`, port) di laptop Anda:
```bash
bash automation/scripts/doctor.sh
```
Untuk menjalankan pengujian **end-to-end seluruh milestone** (aplikasi, database & schema, Docker non-root, sinkronisasi `k3d` & Argo CD, isolasi multi-tenant, observability Prometheus/Grafana & SLO, serta backup/restore):
```bash
bash automation/scripts/e2e-milestone-test.sh
```
Gunakan `--with-trivy` untuk pemindaian kerentanan image Trivy, atau `--skip-k8s` / `--skip-argocd` / `--skip-observability` bila ingin melewati sebagian komponen.

---

### 💻 Mode 1: Pengembangan Lokal Ringan (Local Dev - Anggota 1 & All Devs)
Jalankan backend Express dan database PostgreSQL JournalFit:

1. **Siapkan environment:**
   ```bash
   cp .env.example .env
   ```
2. **Jalankan Aplikasi, Database, dan Keycloak:**
   ```bash
   docker compose up -d postgres keycloak app
   ```
3. **Cek kesehatan & metrik aplikasi:**
   ```bash
   curl -i http://localhost:8000/health/live
   curl -i http://localhost:8000/health/ready
   curl -i http://localhost:8000/metrics
   ```
4. **Autentikasi Keycloak:** realm `journalfit` diimpor otomatis. Ambil token lalu panggil API:
   ```bash
   TOKEN=$(curl -s -X POST "http://localhost:8081/realms/journalfit/protocol/openid-connect/token" \
     -d "grant_type=password&client_id=journalfit-app&username=author.a&password=author.a&scope=openid profile email" \
     | jq -r .access_token)
   curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me
   ```
   Detail realm, user demo, dan `AUTH_MODE` ada di [`source/AUTH.md`](./source/AUTH.md).
5. **Hentikan service jika selesai:**
   ```bash
   docker compose down
   ```

---

### ☸️ Mode 2: Orkestrasi Kubernetes & k3d (Anggota 2 - Platform)
Prasyarat sebelum menerapkan manifest Kustomize ke kluster lokal:
1. Cluster `capstone` (`k3d-capstone`) Ready, node storage berlabel `journalfit-storage=uploads`, Metrics API & Traefik aktif.
2. Database `journalfit` tersedia dengan 6 tabel dari `source/schema.sql`.
3. Secret `journalfit-backend-secret` dengan key `DB_PASSWORD` tersedia di namespace `default` (jangan pernah menyimpan secret nyata di Git).
4. Database `keycloak` dan Secret Keycloak dibuat lewat `automation/scripts/setup-keycloak.sh`.

Langkah eksekusi:
1. **Jalankan Registry lokal:**
   ```bash
   docker compose --profile ci-cd up -d registry
   ```
2. **Buat kluster k3d terintegrasi:**
   ```bash
   bash automation/scripts/create-cluster.sh
   ```
3. **Siapkan database & Secret Keycloak:**
   ```bash
   bash automation/scripts/setup-keycloak.sh
   ```
4. **Terapkan seluruh manifest kustomize:**
   ```bash
   kubectl apply --dry-run=server -k deployment/
   kubectl apply -k deployment/
   kubectl -n default get deployment,pods,service,ingress,pvc,hpa
   ```
5. **Akses aplikasi dan Keycloak via Ingress:**
   ```bash
   curl -i -H "Host: journalfit.localhost" http://localhost:8088/health/ready
   curl -i -H "Host: keycloak.localhost" http://localhost:8088/realms/journalfit
   ```

---

### 🔄 Mode 3: CI/CD & GitOps Argo CD (Anggota 3 - Delivery)
1. **Jalankan Gitea & Registry lokal:**
   ```bash
   docker compose --profile ci-cd up -d
   ```
2. **Pasang Operator Argo CD ke k3d:**
   ```bash
   bash automation/scripts/install-argocd.sh
   ```
3. **Build, Tag SHA7, & Update Desired State:**
   ```bash
   bash automation/scripts/build-and-tag.sh
   bash automation/scripts/prepare-image-update.sh <7-char-sha>
   ```
4. **Simulasi Rollback:**
   ```bash
   bash automation/scripts/simulate-rollback.sh
   ```

---

### 🛡️ Mode 4: Backup, Disaster Recovery & Observability (Anggota 4 - Ops)
1. **Jalankan Prometheus & Grafana:**
   ```bash
   docker compose --profile observability up -d
   ```
   * Prometheus: `http://localhost:9090`
   * Grafana: `http://localhost:3000` (User: `admin`, Pass: `admin`)

2. **Backup Database:**
   ```bash
   bash automation/scripts/db-backup-restore.sh backup
   ```

3. **Uji Disaster Recovery (Restore):**
   ```bash
   bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/<nama_file_backup>.sql
   ```

---

## 📁 Struktur Repositori (Mematuhi Section 15 Capstone Guideline)
```text
capstone_cloud_computing/
├── .env.example                     # Template konfigurasi environment
├── .gitignore                       # Guard artifact lokal, node_modules, dan .env
├── docker-compose.yml               # Stack multi-profile mandiri
├── README.md                        # Panduan terpadu proyek
├── architecture/                    # Diagram dan arsitektur sistem
├── source/                          # Kode backend Express.js & Dockerfile
│   ├── src/                         # Modular monolith modules
│   ├── schema.sql                   # DDL skema 6 tabel & seed data (v1 aktif)
│   ├── schema-v2.sql                # Draft DDL skema v2 (persiapan PRD v0.1)
│   ├── tests/                       # Unit & HTTP integration tests
│   └── Dockerfile                   # Node.js 22 Alpine non-root runtime container
├── deployment/                      # Manifest K8s (Deployment, Service, PVC, Ingress, HPA, Keycloak)
│   ├── kustomization.yaml           # Kustomize manifest
│   ├── keycloak/                    # Manifest deployment & ingress Keycloak
│   └── k3d-registries.yaml          # Registri mirror k3d
├── automation/                      # CI/CD, GitOps, & skrip pembantu
│   ├── argocd/                      # Argo CD Application manifest
│   ├── handoff/                     # Dokumentasi & patch integrasi CI
│   └── scripts/                     # doctor, create-cluster, install-argocd, db-backup-restore, e2e-milestone-test
├── evidence/                        # Bukti pengujian platform, security, observability, recovery
│   └── observability/               # Konfigurasi Prometheus & datasource Grafana
├── decisions/                       # Catatan keputusan arsitektur (ADR-001 s.d. ADR-009)
└── individual-reflections/          # Refleksi individual masing-masing anggota
```

## 🤝 Standar Kolaborasi
- Tidak ada direct commit ke `main` atau `force push`.
- Seluruh perubahan melalui feature branch, Pull Request, dan review anggota tim.
- Jangan menyimpan kredensial nyata (`.env`, password DB, token) di repositori.
