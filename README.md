# JournalFit - Capstone Project Cloud Computing

Repositori proyek akhir Cloud Computing: Sistem Manajemen & Pemeriksaan Format Naskah Ilmiah Multi-Tenant (**JournalFit**).
Backend modular monolith menggunakan Express/Node.js dan PostgreSQL.

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

- [Ringkasan capaian dan batas M3](evidence/platform/RINGKASAN_M3_ANGGOTA_2.md)
- [Panduan manifest dan prasyarat deployment](deployment/README.md)
- [Kontrak integrasi dan riwayat penyesuaian](deployment/INTEGRATION_CONTRACT.md)
- [Indeks evidence platform](evidence/platform/README.md)
- [Demo read-only dan rencana screenshot 04](demo/panduan-demo-m3.md)
- [Transkrip presentasi](demo/transkrip-presentasi-m3.md)
- [Roadmap dan status yang belum selesai](roadmap.md)

| Bagian | Versi / Status Terkini |
| :--- | :--- |
| **Dockerfile source** | `node:22-alpine`, `USER node`, `dumb-init`, port `8000` (uji kandidat & runtime non-root). |
| **Artifact K8s teruji** | `registry:5000/journalfit-backend:3bdf305` (runtime UID `10001`). |
| **Konfigurasi kluster** | Context `k3d-capstone`, namespace `default`, `DB_HOST=host.docker.internal` (Docker Desktop Windows). |
| **Observability** | Endpoint `GET /metrics` (Prometheus text format) + Prometheus (`:9090`) + Grafana (`:3000`). |

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
Jalankan backend Express dan database PostgreSQL JournalFit (tabel dan seed otomatis dibuat dari `source/schema.sql`):

1. **Siapkan environment:**
   ```bash
   cp .env.example .env
   ```
2. **Jalankan Aplikasi dan Database:**
   ```bash
   docker compose up -d postgres app
   ```
3. **Cek kesehatan & metrik aplikasi:**
   ```bash
   curl -i http://localhost:8000/health/live
   curl -i http://localhost:8000/health/ready
   curl -i http://localhost:8000/metrics
   ```
4. **Hentikan service jika selesai:**
   ```bash
   docker compose down
   ```

---

### ☸️ Mode 2: Orkestrasi Kubernetes & k3d (Anggota 2 - Platform)
Prasyarat sebelum menerapkan manifest Kustomize ke kluster lokal:
1. Cluster `capstone` (`k3d-capstone`) Ready, node storage berlabel `journalfit-storage=uploads`, Metrics API & Traefik aktif.
2. Database `journalfit` tersedia dengan 6 tabel dari `source/schema.sql`.
3. Secret `journalfit-backend-secret` dengan key `DB_PASSWORD` tersedia di namespace `default` (jangan pernah menyimpan secret nyata di Git).

Langkah eksekusi:
1. **Jalankan Registry lokal:**
   ```bash
   docker compose --profile ci-cd up -d registry
   ```
2. **Buat kluster k3d terintegrasi:**
   ```bash
   bash automation/scripts/create-cluster.sh
   ```
3. **Terapkan seluruh manifest kustomize:**
   ```bash
   kubectl apply --dry-run=server -k deployment/
   kubectl apply -k deployment/
   kubectl -n default get deployment,pods,service,ingress,pvc,hpa
   ```
4. **Akses aplikasi via Ingress:**
   ```bash
   curl -i -H "Host: journalfit.localhost" http://localhost:8088/health/ready
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
├── roadmap.md                       # Checklist status & progres platform
├── architecture/                    # Diagram dan arsitektur sistem
├── source/                          # Kode backend Express.js & Dockerfile
│   ├── src/                         # Modular monolith modules
│   ├── schema.sql                   # DDL skema 6 tabel & seed data (v1 aktif)
│   ├── schema-v2.sql                # Draft DDL skema v2 (persiapan PRD v0.1)
│   ├── tests/                       # Unit & HTTP integration tests
│   └── Dockerfile                   # Node.js 22 Alpine non-root runtime container
├── deployment/                      # Manifest K8s (Deployment, Service, PVC, Ingress, HPA)
│   ├── kustomization.yaml           # Kustomize manifest
│   └── k3d-registries.yaml          # Registri mirror k3d
├── automation/                      # CI/CD, GitOps, & skrip pembantu
│   ├── argocd/                      # Argo CD Application manifest
│   ├── handoff/                     # Dokumentasi & patch integrasi CI
│   └── scripts/                     # doctor, create-cluster, install-argocd, db-backup-restore, e2e-milestone-test
├── evidence/                        # Bukti pengujian platform, security, observability, recovery
│   └── observability/               # Konfigurasi Prometheus & datasource Grafana
├── demo/                            # Naskah & panduan demo
├── decisions/                       # Catatan keputusan arsitektur (ADR)
└── individual-reflections/          # Refleksi individual masing-masing anggota
```

## 🤝 Standar Kolaborasi
- Tidak ada direct commit ke `main` atau `force push`.
- Seluruh perubahan melalui feature branch, Pull Request, dan review anggota tim.
- Jangan menyimpan kredensial nyata (`.env`, password DB, token) di repositori.
