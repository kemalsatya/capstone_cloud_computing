# 09 - Capacity Planning, FinOps & Roadmap

**Milestone:** M8 — Capacity & FinOps (Bobot Rubrik: 5%)  
**Penanggung Jawab Utama (Lead):** Anggota 4  
**Pendukung Teknis:** Anggota 2 (Resource Requests/Limits & HPA k3d Baseline)  
**Berkas Bukti Target:** `09_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Analisis alokasi sumber daya komputasi (`requests`/`limits`, HPA, PVC) terhadap kapasitas host kluster, estimasi pemetaan biaya cloud IaaS, kalkulasi unit-cost per transaksi/naskah, dan *backlog* risiko sisa. |
| **Owner** | Anggota 4 (Model biaya FinOps, unit-cost, residual risks & roadmap), Anggota 2 (Baseline resource pod, kapasitas host k3d, parameter HPA). |
| **Source / Version** | `deployment/deployment.yaml`, `deployment/hpa.yaml`, `deployment/pvc.yaml`, `docker-compose.yml`, `roadmap.md`. |
| **Timestamp** | Disusun: 2026-11-18 |
| **Method** | Inspeksi deklaratif manifest Kubernetes (`requests`/`limits`, HPA min 2 max 3), pengukuran kapasitas Docker Engine (`12 CPU, 7.4 GiB RAM`), dan pemetaan ekuivalensi harga referensi Cloud IaaS + AI Token FinOps. |
| **Observation** | Total reservasi baseline 2 pod backend hanya menggunakan `200m CPU` (~1.6% CPU host) dan `256 MiB RAM` (~3.4% RAM host), sedangkan batas puncak saat HPA scale-out ke 3 pod adalah `750m CPU` / `768 MiB RAM`. Evaluasi format v1 memakan biaya AI eksternal `$0` karena memakai *rule-engine* deterministik lokal. |
| **Interpretation** | Kapasitas sangat memadai dengan *headroom* besar untuk lingkungan laptop, dan pendekatan *deterministic pre-check* mengoptimalkan unit-cost sebelum mengaktifkan fitur AI pada v2 tanpa menurunkan kontrol keamanan (`non-root`) ataupun keandalan (min 2 replika). |
| **Limitation** | Estimasi harga IaaS didasarkan pada kalkulasi daftar harga referensi standar (on-demand estimate) bukan tagihan faktual cloud provider, serta metrik utilisasi riil baru berasal dari beban uji sintetis (3 req/s). |
| **Decision Supported** | Mendukung **ADR-001** (Modular Monolith hemat RAM), **ADR-003** (`node:22-alpine`), dan **ADR-008** (Rule-Engine pre-filter sebelum LLM). |

---

## 2. Pembagian Tugas Anggota & Checklist Eksekusi

| Sub-Tugas | Pemilik | Deskripsi & Output |
| :--- | :--- | :--- |
| **9.1 Capacity & Headroom Worksheet** | Anggota 2 & Anggota 4 | Membandingkan kapasitas host Docker (`12 vCPU / 7.4 GiB RAM`) dengan reservasi K8s `requests`/`limits`, HPA (`min:2, max:3, CPU 70%`), serta container pendukung (Postgres, Prometheus, Grafana, Registry). |
| **9.2 Cloud IaaS Mapping & Unit-Cost FinOps** | Anggota 4 | Memetakan kebutuhan lokal ke VM Cloud IaaS/CloudStack + Managed DB + Storage, serta menghitung *unit cost* per 1.000 pemeriksaan naskah (termasuk proyeksi AI Token v2). |
| **9.3 Residual Risk & Prioritized Roadmap** | Anggota 4 | Mendokumentasikan keterbatasan sistem saat ini (minimal 2 risiko sisa nyata) beserta rencana mitigasi jangka pendek dan jangka menengah. |

---

## 3. Capacity Worksheet & Headroom Analysis

### A. Inventaris Sumber Daya Aktual (Kapasitas Host Lab: 12 CPU, 7.4 GiB RAM, 48.7 GiB Disk Bebas)

| Komponen Workload | Replika | CPU Request (Total) | CPU Limit (Total) | RAM Request (Total) | RAM Limit (Total) | Storage / PVC |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **JournalFit Backend (Baseline)** | 2 pod | `100m` (`200m`) | `250m` (`500m`) | `128 MiB` (`256 MiB`) | `256 MiB` (`512 MiB`) | `1 GiB` PVC (`RWO`, shared) |
| **JournalFit Backend (HPA Peak)** | 3 pod | `100m` (`300m`) | `250m` (`750m`) | `128 MiB` (`384 MiB`) | `256 MiB` (`768 MiB`) | `1 GiB` PVC (`RWO`, shared) |
| **PostgreSQL 17 Alpine (Docker)** | 1 | - | ~0.5 vCPU est. | ~64 MiB aktual | Uncapped (host) | Volume Docker `postgres_data` |
| **Prometheus + Grafana + Registry** | 3 | - | ~0.5 vCPU est. | ~350 MiB total | Uncapped (host) | Volume TSDB (retensi `3d`) |
| **Kluster k3s/k3d Control Plane + Traefik** | 1 | - | ~1.0 vCPU est. | ~650 MiB total | Uncapped (host) | Disk ephemeral containerd |

* **Analisis Headroom Host:** Pada skenario puncak (`3 pod backend` + seluruh stack pendukung menyala bersamaan), konsumsi memori reservasi + stack inti sekitar `~1.8 GiB` dari `7.4 GiB` yang tersedia (~**75% headroom tersisa**), sementara permintaan CPU puncak `750m` (< 1 core) dari 12 core host (**> 85% CPU headroom**).
* **Penilaian Sizing (Over/Under-Provisioned):**
  - *CPU Backend:* Saat idle/uji normal (`3 req/s`), utilisasi HPA berada pada **1% / 70%** (`04_evidence.png`). Batas `requests: 100m` dapat diturunkan ke `50m` jika ingin memadatkan lebih banyak pod, namun sengaja dipertahankan pada `100m` sebagai *burst buffer* saat proses parsing file `.docx` berbarengan.
  - *TSDB Prometheus:* Retensi dibatasi `--storage.tsdb.retention.time=3d` (`docker-compose.yml`) agar disk lokal tidak membengkak.

---

## 4. Cloud IaaS Mapping & Model FinOps Unit-Cost

### A. Pemetaan Lingkungan Lokal -> Cloud IaaS / Private Cloud (CloudStack / AWS / GCP Equivalent)

| Komponen Lokal (`k3d` / Docker) | Padanan Infrastruktur Cloud (Small Production) | Spesifikasi Sizing | Estimasi Biaya / Bulan (USD Asumsi) |
| :--- | :--- | :--- | :---: |
| Node kluster `k3d` + Backend 2–3 pod | 2x Worker VM (`e2-medium` / `t3.small` / CloudStack 2vCPU-2GB) | 2 vCPU, 2–4 GB RAM per node | `$30.00` (2 x ~$15) |
| Container `journalfit-postgres` | 1x Managed PostgreSQL (`db.t3.micro` / Dedicated DB VM) + Auto-Backup | 2 vCPU, 1–2 GB RAM, 20 GB SSD | `$15.00` |
| PVC `local-path` 1Gi (`/app/uploads`) | Managed Object Storage (S3 / MinIO / Cloud Storage) 50 GB | Multi-AZ Object Storage | `$1.25` |
| Traefik Ingress & Monitoring | Cloud Load Balancer / Ingress VM + Self-hosted Prometheus | Termasuk di node / LB | `$10.00` |
| **Total Estimasi Infrastruktur / Bulan** | | | **`~$56.25 / bulan`** |

### B. FinOps Unit-Cost Analysis (Periksa Naskah & Strategi Optimasi AI)

1. **Unit-Cost Infrastruktur v1 (Saat Ini — Rule-Engine Deterministik):**
   - Pada v1 (`source/src/modules/manuscripts/services/manuscript.service.js`), pemeriksaan naskah dilakukan lokal menggunakan parser `mammoth` dan evaluasi aturan deterministik (`WORD_COUNT`, `ABSTRACT_CHECK`, `KEYWORDS_CHECK`).
   - Latensi rata-rata `< 50 ms`, kapasitas konservatif 2 replika mampu melayani ~50.000 pemeriksaan/bulan (hanya ~1.100 req/hari).
   - Biaya Infrastruktur per Pemeriksaan (asumsi 50.000 cek/bulan): `$56.25 / 50.000 = $0.001125 / cek` (**Rp ~18 / naskah**), dengan **biaya API AI eksternal = $0**.
2. **Proyeksi Biaya & Optimasi FinOps v2 (Jika Integrasi LLM API Diaktifkan):**
   - *Tanpa Optimasi (Kirim Full-Text DOCX ke GPT-4o):* 1 naskah (6.000 kata ≈ 8.000 token input + 1.000 token output) memakan biaya ~$0.03–$0.05/cek (50.000 cek = `$1.500–$2.500/bulan`).
   - *Dengan Optimasi FinOps (Strategi JournalFit v2):*
     1. **Pre-filter Deterministik (ADR-008):** Cek jumlah kata/abstrak/kata kunci diselesaikan gratis di Node.js v1 sebelum memanggil LLM.
     2. **Context Trimming (Abstract-Only Boundary):** Hanya mengirim bagian *Abstract + Title* (~600 token input + ~300 token output) menggunakan model cepat hemat biaya (mis. Groq Llama-3.1-8B / Gemini Flash: `~$0.0001 - $0.0004 / cek`).
     3. **Hash Deduplication:** Menyimpan hash SHA-256 berkas agar unggahan ulang naskah identik mengembalikan hasil cache dari PostgreSQL tanpa memanggil API LLM lagi.

### C. Optimization Without Harming Controls
- Menggunakan image dasar `node:22-alpine` (~276 MB vs ~1.1 GB full Debian) dan `npm ci --omit=dev` menurunkan penggunaan disk registry & waktu cold-start pod tanpa melepas security context `UID 10001` ataupun readiness probe.
- Mengatur HPA `minReplicas: 2, maxReplicas: 3` menghemat biaya komputasi dengan menjaga skala kecil saat lalu lintas rendah, namun tetap menjaga ketersediaan tinggi minimal 2 pod untuk *rolling update* (`maxUnavailable: 0`).

---

## 5. Residual Risks & Prioritized Improvement Roadmap

| Prioritas | Risiko Sisa (Residual Risk) | Dampak | Rencana Perbaikan (Improvement Roadmap) |
| :---: | :--- | :--- | :--- |
| **R1 (Tinggi)** | **PVC `ReadWriteOnce` terikat pada 1 node (`local-path`)** | Semua replika backend terkunci pada `k3d-capstone-agent-0` (*single node SPOF*). Tidak mendukung auto-scaling lintas-node di cloud. | Migrasi penyimpanan unggahan `.docx` dari disk PVC lokal ke Object Storage S3-compatible (**MinIO / Garage / S3**) pada rilis `v2`. |
| **R2 (Tinggi)** | **Mock JWT (`/api/auth/token`) & Header `X-Tenant-ID` belum terverifikasi OIDC** | Isolasi tenant sudah jalan di DB & service, namun produksi butuh verifikasi signature JWT dari IdP resmi dan Row-Level Security (RLS). | Integrasi **Keycloak (OIDC/JWKS verification)** + pengaktifan **PostgreSQL Row-Level Security (RLS)** agar tenant isolation terlindungi di 2 lapis. |
| **R3 (Sedang)** | **Database host lokal via `host.docker.internal` & backup manual** | Ketergantungan pada Docker Compose host dan belum ada off-site backup terenkripsi otomatis. | Pindah ke StatefulSet / Managed PostgreSQL + Kubernetes `CronJob` untuk backup otomatis harian ke bucket S3 dengan verifikasi checksum. |
| **R4 (Rendah)** | **Registry lokal (`localhost:5001`) tanpa authentication & TLS** | Hanya layak untuk development/k3d laptop. | Migrasi artefak OCI ke GitHub Container Registry (`ghcr.io`) / Harbor privat pada target CloudStack / Public Cloud. |

---

## 6. Panduan Pengambilan Screenshot `09_evidence.jpg` (Tugas Anggota 4 & Anggota 2)

Jalankan perintah berikut di Git Bash / WSL pada root repositori `capstone_cloud_computing`:
```bash
bash automation/scripts/capture-evidence-06-08-09-10.sh 09
```
**Susun menjadi 3 panel pada `09_evidence.jpg`:**
1. **Panel 1 (Capacity & Headroom):** Output terminal tabel `kubectl top` / resource requests & limits serta tabel headroom vs kapasitas host k3d.
2. **Panel 2 (FinOps Cost & Unit-Cost):** Output terminal tabel pemetaan IaaS Cloud + perhitungan unit-cost per naskah & perbandingan penghematan AI Token FinOps.
3. **Panel 3 (Residual Risk & Roadmap):** Ringkasan 4 risiko sisa & roadmap prioritas v2.
