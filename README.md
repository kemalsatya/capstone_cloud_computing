# JournalFit - Capstone Project Cloud Computing

Repositori proyek akhir Cloud Computing: Sistem Manajemen & Pemeriksaan Format Naskah Ilmiah Multi-Tenant (**JournalFit**).

---

## 👥 Pembagian Peran Anggota Kelompok

| Peran | Anggota | Fokus Utama & Direktori Kerja |
| :--- | :--- | :--- |
| **Anggota 1** | Aplikasi & Data | Backend modular monolith (`source/`), PostgreSQL DDL schema (`source/schema.sql`), unit test (`source/tests/`). |
| **Anggota 2** | Platform & Kubernetes | Containerization (`source/Dockerfile`), K8s manifest (`deployment/`), k3d cluster setup, Ingress, HPA, PVC. |
| **Anggota 3** | CI/CD & GitOps | Pipeline delivery & security scanning (`automation/`), Argo CD application (`automation/argocd/application.yaml`). |
| **Anggota 4** | Security, Ops & Recovery | Trivy vulnerability scan, backup & disaster recovery DB, observability Grafana/Prometheus (`evidence/`). |

---

## 🚀 Panduan Eksekusi di Laptop Anggota

Repositori ini telah dilengkapi dengan infrastruktur mandiri berbasis **Docker Compose** dan skrip otomasi yang dapat dijalankan langsung di masing-masing laptop anggota.

### 0. Diagnosa Kesiapan Laptop (Semua Anggota)
Sebelum memulai, periksa kesiapan dependensi (Docker, Node, k3d, port) di laptop Anda:
```bash
bash automation/scripts/doctor.sh
```

---

### 💻 Mode 1: Pengembangan Lokal Ringan (Local Dev - Anggota 1 & All Devs)
Cukup jalankan backend Express dan database PostgreSQL JournalFit (tabel otomatis dibuat):

1. **Siapkan environment:**
   ```bash
   cp .env.example .env
   ```
2. **Jalankan Aplikasi dan Database:**
   ```bash
   docker compose up -d postgres app
   ```
3. **Cek kesehatan aplikasi:**
   ```bash
   curl -i http://localhost:8000/health/live
   curl -i http://localhost:8000/health/ready
   ```
4. **Hentikan service jika selesai:**
   ```bash
   docker compose down
   ```

---

### ☸️ Mode 2: Orkestrasi Kubernetes & k3d (Anggota 2 - Platform)
Untuk menjalankan manifest di kluster K8s lokal:

1. **Jalankan Registry lokal (opsional jika build lokal):**
   ```bash
   docker compose --profile ci-cd up -d registry
   ```
2. **Buat kluster k3d terintegrasi:**
   ```bash
   bash automation/scripts/create-cluster.sh
   ```
3. **Terapkan seluruh manifest kustomize:**
   ```bash
   kubectl apply -k deployment/
   kubectl get pods -o wide
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
3. **Simulasi Rollback:**
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
├── docker-compose.yml               # Stack multi-profile mandiri
├── README.md                        # Panduan terpadu proyek
├── architecture/                    # Diagram dan arsitektur sistem
├── source/                          # Kode backend Express.js & Dockerfile
│   ├── src/                         # Modular monolith modules
│   ├── schema.sql                   # DDL skema 6 tabel & seed data
│   └── Dockerfile                   # Node.js 24 runtime container
├── deployment/                      # Manifest K8s (Deployment, Service, PVC, Ingress, HPA)
│   ├── kustomization.yaml           # Kustomize manifest
│   └── k3d-registries.yaml          # Registri mirror k3d
├── automation/                      # CI/CD, GitOps, & skrip pembantu
│   ├── argocd/                      # Argo CD Application manifest
│   └── scripts/                     # doctor, create-cluster, install-argocd, db-backup-restore
├── evidence/                        # Bukti pengujian platform, security, observability, recovery
│   └── observability/               # Konfigurasi Prometheus & datasource Grafana
├── decisions/                       # Catatan keputusan arsitektur (ADR)
└── individual-reflections/          # Refleksi individual masing-masing anggota
```
