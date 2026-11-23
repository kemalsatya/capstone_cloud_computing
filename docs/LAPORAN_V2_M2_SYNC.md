# Perancangan dan Implementasi Sistem Informasi *Cloud-Native Multi-Tenant* untuk Validasi Format Naskah Jurnal Secara Asinkron (JournalFit)

**Dosen Pengampu:** I Wayan Widi Pradnyana, M.TI  
**Mata Kuliah:** Cloud Computing — Kelas A  
**Status Sinkronisasi:** Milestone 2 Verified Baseline (`main` commit `7e8607b` / image tag `0c2cf92`, tersinkronisasi dengan Evidence `01`–`08` & `10`; bagian `09` menunggu finalisasi Paket C)

**Disusun Oleh (Tim 7):**

| Nama | NIM |
| :--- | :--- |
| Liaurentino | 2410512107 |
| Kemal Satya Wibowo | 2410512056 |
| Rafael Ananta Razid | 2410512082 |
| Muhammad Rafi Agastya | 2410512188 |

**PROGRAM STUDI S1 SISTEM INFORMASI**  
**FAKULTAS ILMU KOMPUTER**  
**UNIVERSITAS PEMBANGUNAN NASIONAL "VETERAN" JAKARTA**  
**TAHUN 2026**

---

## Bab I — Pendahuluan dan Masalah

### 1.1 Latar Belakang dan Konteks Bisnis

Publikasi ilmiah merupakan indikator kinerja utama perguruan tinggi dan syarat kelulusan mahasiswa yang dikelola oleh puluhan jurnal independen di tiap fakultas atau program studi, masing-masing dengan standar tata letak (*template*) yang spesifik. Namun, proses penyaringan awal naskah (*desk evaluation*) di sebagian besar jurnal masih dilakukan secara manual. Editor harus mengunduh dokumen `.docx`, memeriksa kepatuhan ukuran kertas, margin, jenis huruf, struktur bab, abstrak, serta kata kunci satu per satu, sehingga menyita waktu produktif sebelum naskah dapat masuk ke tahap peninjauan substansi (*peer-review*).

Karena membangun infrastruktur terpisah untuk setiap jurnal memboroskan sumber daya dan beban pemeliharaan, dikembangkan **JournalFit — Platform Otomasi Pemeriksaan Format Naskah Jurnal Berbasis *Cloud-Native Multi-Tenant***. Melalui model *Software-as-a-Service* (SaaS) internal ini, satu kluster Kubernetes terpusat melayani banyak unit jurnal sekaligus dengan aturan pemeriksaan dan ruang data yang terisolasi penuh secara kriptografis untuk masing-masing *tenant*.

### 1.2 Identifikasi Masalah dan Estimasi Beban Kerja

Urgensi bisnis dan teknis proyek ini didasarkan pada kalkulasi skenario operasional pengelolaan jurnal akademik:

- **Inefisiensi Biaya Waktu pada Pemeriksaan Manual:** Pemeriksaan teknis dasar pada berkas naskah (ukuran kertas A4, margin, kolom, jenis dan ukuran huruf, kelengkapan bab, jumlah kata abstrak, dan jumlah kata kunci) membutuhkan rata-rata **10–15 menit per naskah** (hingga 20–40 menit pada naskah panjang). Untuk **100 naskah** dalam satu periode terbitan, editor menghabiskan **16–25 jam kerja** hanya untuk validasi format repetitif.
- **Tingginya Laju Pengembalian Awal (*Desk Rejection Rate*):** Tanpa alat periksa mandiri (*self-check*) sebelum *submit*, kesalahan tata letak memicu siklus revisi administratif **2–3 kali per naskah**, memperpanjang waktu tunggu publikasi (*time-to-publish*).
- **Ketimpangan Beban Trafik Musiman (*Spiky Workload*):** Pada minggu reguler, unggahan rendah (< 5–10 naskah/hari). Menjelang tenggat yudisium atau penutupan edisi (*call for papers*), volume unggahan melonjak hingga **10x (ratusan naskah bersamaan)**. Infrastruktur statis berisiko *bottleneck* saat puncak beban atau boros biaya saat sepi.

### 1.3 Nilai Tambah Solusi (*Business Value Proposition*)

Pada baseline Milestone 2 (v1), JournalFit diimplementasikan sebagai layanan pemeriksaan format naskah *multi-tenant* berbasis antrean asinkron (`pg-boss`) dan *rule engine* deterministik OOXML (`jszip` + `fast-xml-parser`), dengan integrasi AI *scope checker* diposisikan secara transparan pada **Roadmap v2**:

- **Efisiensi Operasional Editor:** Memangkas waktu *screening* format awal dari belasan menit menjadi pemrosesan asinkron otomatis dengan laporan temuan terstruktur (`FMT-001` s.d. `FMT-009`, latensi API report p95 < 50 ms).
- **Efisiensi Infrastruktur melalui Multi-Tenancy:** Satu kluster bersama melayani banyak jurnal (`tenant-a`, `tenant-b`, dst.) dengan isolasi klaim JWT Keycloak (`tenant_id`) dan filter query PostgreSQL.
- **Pengendalian Biaya Berbasis Konsumsi (*FinOps*):** Pada v1, evaluasi format 100% deterministik tanpa biaya token LLM (**$0 biaya AI**). Pada Roadmap v2, pemrosesan AI dibatasi hanya pada abstrak dan kata kunci agar biaya token tetap terkendali dan draf penuh tetap rahasia.

### 1.4 Tujuan, Target Sukses Terukur, dan Realisasi Aktual (v1)

| Aspek Penilaian | Target Awal | Realisasi Terukur (Baseline `7e8607b`) | Bukti Pendukung |
| :--- | :--- | :--- | :--- |
| **Kecepatan Layanan (*Performance*)** | Format selesai < 30 detik (P95) | API report **p95 < 50 ms**; rolling update **p95 26,73 ms** (777 req, 0 gagal); pipeline asinkron `pg-boss` + OOXML deterministik | `04_evidence.jpg`, `07_evidence.jpg`, `08_evidence.jpg` |
| **Isolasi Keamanan (*Multi-Tenant Security*)** | 0 kebocoran data lintas-*tenant* | **100% lulus di Compose & K8s:** tanpa/bad token → **`401`**, lintas-tenant → **`404 NOT_FOUND`** (*anti-enumeration*), salah role RBAC → **`403 FORBIDDEN`**, `X-Tenant-ID` palsu diabaikan | `06_evidence.jpg`, `ADR-009` |
| **Ketahanan Layanan (*Resilience*)** | Pod pulih otomatis & tanpa hilang data | Controlled pod deletion **self-healing 7,1 detik**, `/health/ready` tetap **200 OK**, checksum SHA-256 PVC 100% identik; `pg-boss` mendukung retry + DLQ | `08_evidence.jpg`, `ADR-005` |
| **Keandalan Pemulihan (*Recovery*)** | RTO < 30 menit (SLO < 5 menit) | Restore terisolasi `journalfit` selesai dalam **RTO 0,78 detik** (6 tabel 100% cocok) + backup/restore `keycloak` (**101 tabel** identik) | `08_evidence.jpg`, `ADR-008` |
| **Kapasitas & Efisiensi Biaya (*FinOps*)** | Biaya terukur & headroom terkendali | $0 biaya AI pada v1 (rule-engine deterministik); **[Angka live metrics & unit-cost final pasca-Keycloak/worker menunggu Paket C — `09_evidence.jpg`]** | `09_evidence.jpg` *(pending)* |

---

## Bab II — Stakeholder, Scope, dan Motivation View

### 2.1 Daftar Stakeholder dan Kepentingannya

- **Penulis / Mahasiswa (`author`):** Mengunggah naskah `.docx` sebelum pengiriman resmi untuk memperoleh skor kesiapan dan daftar kesalahan format (`FMT-001`..`FMT-009`) secara cepat.
- **Editor Jurnal (`editor`):** Meninjau laporan naskah yang sudah tersaring di dalam *tenant*-nya dan mengelola *template* aturan format jurnal.
- **Admin Tenant (`tenant_admin`):** Menetapkan konfigurasi aturan format jurnal serta memastikan kerahasiaan dan isolasi naskah milik institusinya.
- **Admin Platform / DevOps:** Mengawasi kesehatan kluster Kubernetes (`k3d-capstone`), GitOps Argo CD, keamanan container (Trivy), observability SLO, backup/restore, serta efisiensi biaya (*FinOps*).

### 2.2 Scope (Ruang Lingkup Implementasi v1 vs Roadmap v2)

**In-Scope (Terbukti Berjalan pada Milestone 2 / v1):**
- Autentikasi OIDC/JWT berbasis **Keycloak 26.8.2** (realm `journalfit`, RS256 JWKS) dengan klaim `tenant_id` dan peran (`author`, `editor`, `tenant_admin`).
- Unggah naskah `.docx` via `POST /api/manuscripts` (HTTP `202 Accepted`, plus alias legacy `/api/manuscripts/upload`) dan pemrosesan asinkron melalui antrean **`pg-boss`** (`format-check` + `format-check-dlq`).
- Pemeriksaan format deterministik OOXML (**`jszip` + `fast-xml-parser`**) pada **`worker-format`** untuk 9 aturan Tier-1: `FMT-001` (A4 twips), `FMT-002` (margin), `FMT-003` (kolom), `FMT-004` (font & ukuran), `FMT-005` (alignment & spasi), `FMT-006` (heading style), `FMT-007` (section wajib & urutan), `FMT-008` (abstrak 100–200 kata), dan `FMT-009` (keywords 3–5).
- Laporan terstruktur `GET /api/manuscripts/{id}/report` serta dokumentasi **OpenAPI 3 / Swagger UI** (`/docs`, `/openapi.yaml`).
- Skema relasional 6 tabel utama (`tenants`, `users`, `format_rule_templates`, `manuscripts`, `check_results`, `findings`) + tabel antrean `pg-boss` dan migrasi idempoten (`001` + `002`) melalui K8s Job `journalfit-db-setup`.

**Roadmap v2 (Tercatat Jujur di Luar Baseline Terbukti v1):**
- **Worker Scope AI (Groq / LLM Adapter):** Saat ini baris `check_results` untuk `scope` dibuat dengan status `queued`, namun worker pemanggil AI belum dijalankan di v1.
- **Object Storage Multi-AZ (Garage / MinIO S3):** Saat ini berkas `.docx` disimpan pada PVC `1Gi local-path` (`ReadWriteOnce`).
- **Web UI Frontend terpisah:** Saat ini antarmuka interaksi menggunakan REST API + OpenAPI/Swagger UI.

**Out-of-Scope:**
- Pengecekan plagiasi, deteksi tulisan AI, penilaian substansi ilmiah, dukungan berkas PDF, sistem pembayaran, dan alur *peer-review* penuh.

### 2.3 Alur Utama Sistem (v1 Aktual)

**Login Keycloak OIDC (JWT RS256) → Submit `.docx` (`POST /api/manuscripts` → `202`) → Enqueue Atomik (`pg-boss` `format-check`) → Parse OOXML & Evaluasi Tier-1 (`worker-format`) → Laporan Kepatuhan (`GET /api/manuscripts/:id/report`)**

### 2.4 Diagram ArchiMate 1: Motivation, Business & Strategy View

> **[Sisipkan Gambar Terbaru: `01-business/01_evidence.jpg` — ArchiMate 3.2 Business Case, Motivation & Cloud Rationale]**

Diagram ini memetakan empat *Stakeholder* (Author, Journal Editor, Tenant Admin, Platform Admin) terhadap tiga *Driver* utama (>30% *desk rejection*, 10–40 menit cek manual, dan lonjakan beban 10x menjelang *deadline*). Dari *driver* tersebut diturunkan empat *Goal* terukur (`G1`–`G4`: audit Tier-1 `FMT-001..009`, isolasi kriptografis Keycloak `401/404/403`, pemulihan teruji `7,1s` / RTO `0,78s`, dan efisiensi `$0` AI cost di v1) serta lima pilar kebutuhan *cloud-native*.

---

## Bab III — Cloud Rationale

### 3.1 Pemetaan Karakteristik Cloud

JournalFit memenuhi kriteria beban kerja *cloud-suitable* (bukan sekadar aplikasi web yang di-*hosting*) berdasarkan lima karakteristik utama:

- **Elastisitas Otomatis & Berbasis Antrean (*HPA + Async Queue*):** API Express 5 menggunakan Kubernetes HPA (`min: 2, max: 3` pod @ CPU 70%, teruji scale `2→3→2` pada 19.865 request tanpa gagal), sedangkan pemrosesan parsing `.docx` berat dipisahkan ke pod **`worker-format`** via antrean **`pg-boss`** sehingga API tidak pernah memblokir request unggahan.
- **Isolasi Sumber Daya Multi-Tenant (*Resource Pooling + Cryptographic Isolation*):** Satu kluster dan satu instance PostgreSQL 17 melayani banyak jurnal dengan isolasi klaim `tenant_id` dari token RS256 Keycloak dan filter query wajib (`HTTP 404` lintas-tenant).
- **Portabilitas *Provider-Neutral* (OCI + Kustomize):** Seluruh workload dikemas sebagai container non-root (`UID 10001` untuk API/worker/job, `UID 1000` untuk Keycloak) dengan manifest Kustomize deklaratif sehingga siap dipindahkan dari `k3d` lokal ke Apache CloudStack, AWS EKS, maupun GCP GKE tanpa mengubah kode aplikasi.
- **Ketahanan terhadap Kegagalan (*Fault Tolerance & Self-Healing*):** ReplicaSet memulihkan pod yang dihapus dalam **7,1 detik** tanpa kegagalan request; antrean `pg-boss` menerapkan enqueue atomik dalam transaksi DB, handler idempoten, retry 2x, dan Dead-Letter Queue (`format-check-dlq`).
- **Visibilitas & Kendali Biaya (*Measured Service / FinOps*):** Metrik diekspos lewat `GET /metrics` (API `:8000` dan Worker `:9101`) ke Prometheus/Grafana, sementara pendekatan rule-engine deterministik menjaga biaya AI tetap **$0** di v1.

### 3.2 Alternatif Arsitektur yang Ditolak

| Alternatif yang Ditolak | Alasan Penolakan | Keputusan Terpilih (JournalFit M2) |
| :--- | :--- | :--- |
| **Microservices Penuh Terpisah** | Overhead RAM >1,5 GB di kluster lab dan memperumit networking/tracing sejak awal. | **Modular Monolith Express 5 + Worker Async (`ADR-001`):** Hemat RAM (~128 MiB/pod) dengan antrean `pg-boss` terpisah. |
| **Kirim Full DOCX ke Paid LLM API di v1** | Biaya token tinggi (~$0,05/cek), latensi lambat (5–15 detik), dan non-deterministik untuk cek margin/twips/font. | **Native OOXML Parser (`jszip` + `fast-xml-parser`) + Tier-1 Rules (`ADR-008`):** Deterministik, cepat, $0 AI cost di v1. |
| **Dedicated Database per Tenant / Header-Only Auth** | Boros RAM & migrasi lambat; header `X-Tenant-ID` mentah rentan spoofing. | **Shared PostgreSQL 17 + Keycloak RS256 JWT (`ADR-002`, `ADR-009`):** Claim `tenant_id` terverifikasi JWKS + guard `404`. |
| **VPS Monolitik Sinkron / Deploy S3 Penuh di v1** | Rawan timeout saat lonjakan dan drift konfigurasi; kluster S3 penuh membebani host lab 8 GB RAM. | **k3d + HPA + Argo CD GitOps + 1Gi RWO PVC (`ADR-003`–`005`):** Deklaratif, portabel, migrasi S3 masuk Roadmap v2. |

### 3.3 Batasan Jujur Beban Kerja (*Realistic Workload Sizing*)

Rata-rata trafik harian di luar periode tenggat tergolong rendah (< 10–20 naskah/hari). Penggunaan kluster Kubernetes (`k3d-capstone`) bukan ditujukan untuk jutaan RPS, melainkan untuk membuktikan **isolasi multi-tenant**, **pemrosesan asinkron andal**, **self-healing & rolling update tanpa downtime**, serta **kesiapan elastisitas saat lonjakan musiman**. *[Rincian pengukuran kapasitas & headroom aktual pasca-Keycloak + `worker-format` akan disinkronkan setelah Paket C (`09_evidence.jpg`) selesai.]*

---

## Bab IV — Pembagian Tim dan Risiko

### 4.1 Pembagian Peran Tim

Setiap anggota tim tetap bertanggung jawab memahami keseluruhan sistem saat *Technical Defense*, dengan fokus implementasi:

- **Application & Data (Kemal Satya Wibowo):** Modular monolith Express 5, integrasi Keycloak OIDC/JWT (`jose`), parser OOXML (`jszip` + `fast-xml-parser`), Tier-1 rule engine (`FMT-001..009`), `pg-boss` worker, OpenAPI docs, migrasi & seeding DB, serta Paket A (`06-security`).
- **Platform & Kubernetes (Rafael Ananta Razid):** Topologi kluster `k3d-capstone`, manifest Kustomize (`deployment`, `pvc`, `ingress`, `hpa`, `keycloak`), hardening non-root `UID 10001`, uji beban HPA & rolling update (`04-platform-kubernetes`).
- **Delivery, Architecture, ADR & Demo (Liaurentino):** CI/CD GitHub Actions (Node 22 + Trivy), Argo CD GitOps (`05-ci-cd-gitops`), pemodelan ArchiMate 3.2 (`01-business`, `02-architecture`, `.archimate`), matriks & automated conformance test ADR-001..009 (`10-decisions-adr`), serta gladi bersih demo (`11-demo-defense`).
- **Reliability, Observability & FinOps (Muhammad Rafi Agastya & Tim):** Prometheus/Grafana SLO (`07-observability-slo`), uji controlled pod deletion & isolated DB backup/restore RTO (`08-reliability-recovery`), serta capacity planning & FinOps (`09-capacity-finops` — *dalam proses*).

### 4.2 Risiko Aktual dan Mitigasi

1. **Kerumitan variasi berkas DOCX:** Dimitigasi dengan validasi ZIP safety (`INVALID_FILE`), pembatasan format hanya `.docx`, dan 9 aturan Tier-1 deterministik (`FMT-001..009`) yang teruji dengan 63/64 unit/integration tests.
2. **PVC `ReadWriteOnce` (`local-path`) mengikat pod pada 1 node (`k3d-capstone-agent-0`):** Dimitigasi sementara dengan `nodeSelector: journalfit-storage: uploads` dan anotasi Argo CD `Prune=false,Delete=false`; migrasi ke Object Storage (Garage/MinIO S3) dijadwalkan pada Roadmap v2.
3. **Footprint memori Keycloak (`~596 MiB` saat cold start ~72 detik) & *Direct Access Grants* dev flow:** Dimitigasi dengan startupProbe 180 detik, strategi `Recreate`, serta pemisahan database `keycloak` tersendiri; migrasi ke *Authorization Code + PKCE* masuk Roadmap v2.
4. **PostgreSQL lokal via alias host k3d (`host.k3d.internal`) & backup CLI manual:** Dimitigasi dengan verifikasi restore terisolasi rutin (RTO 0,78 detik untuk `journalfit` dan 101 tabel `keycloak`); otomatisasi `CronJob` + Managed DB masuk Roadmap v2.
5. **Fitur Roadmap v2 (Worker Scope AI Groq & S3):** Dicatat secara jujur sebagai *limitation* v1 agar tidak terjadi klaim fitur yang belum terbukti.

---

## Bab V — Arsitektur Sistem

### 5.1 Komponen dan Alur Data (Implementasi Aktual `7e8607b`)

Sistem dirancang sebagai **Modular Monolith + Async Worker** dengan komponen aktual:

- **Traefik Ingress Gateway (`:8088`):** Pintu masuk tunggal berbasis *Host header* (`journalfit.localhost` → `journalfit-backend:80`; `keycloak.localhost` → `keycloak:80`).
- **Keycloak OIDC Provider (`quay.io/keycloak/keycloak:26.8.2`, Quarkus JVM, `UID 1000`):** Mengelola realm `journalfit`, menerbitkan token RS256 (klaim `tenant_id`, `role`), dan menyediakan endpoint JWKS internal (`http://keycloak.default.svc.cluster.local/realms/journalfit/protocol/openid-connect/certs`).
- **JournalFit Backend API (Node.js 22 + Express 5.3.0, 2–3 pod HPA, `UID 10001`):** Menangani validasi JWT (`jose`), isolasi multi-tenant (`404`) & RBAC (`403`), unggahan `.docx`, enqueue atomik `pg-boss`, OpenAPI/Swagger UI (`/docs`), probes (`/health/live`, `/health/ready`), dan `/metrics`.
- **Async Format Worker (`journalfit-worker-format`, 1 pod, `node src/worker.js`, `UID 10001`):** Mengambil job `format-check` dari `pg-boss`, membaca `.docx` dari PVC `/app/uploads`, menjalankan parser OOXML (`jszip` + `fast-xml-parser`) + 9 rule Tier-1 (`FMT-001..009`), menyimpan `findings`, dan mengekspos `/metrics` pada port `:9101`.
- **K8s DB Setup Job (`journalfit-db-setup`, `UID 10001`):** Menjalankan `initContainer` migrasi idempoten (`run-migrations.js` 001 + 002) dan seeding (`seed-demo-data.js`).
- **Persistence Layer:** PVC `journalfit-uploads` (`1Gi local-path` RWO di `/app/uploads`) dan PostgreSQL 17 Alpine (`journalfit-postgres:5432`) yang menampung database `journalfit` (6 tabel + skema `pg-boss`) dan `keycloak` (101 tabel).
- **Observability & GitOps Control Plane:** Prometheus (`:9090`, retensi 3 hari), Grafana (`:3000`), GitHub Actions CI (`node --test` + Trivy), Local OCI Registry (`:5001` / `registry:5000`, tag immutable `0c2cf92`), dan Argo CD Controller (`selfHeal: true`, `targetRevision: main`).

### 5.2 Control Plane dan Data Plane

- **Control Plane (Out-of-Band):** GitHub Actions CI, Local OCI Registry (`:5001` / `registry:5000`), Argo CD GitOps Controller, serta k3s control plane.
- **Data Plane (Runtime):** Traefik Ingress (`:8088`), pod `keycloak`, pod `journalfit-backend` (HPA 2–3), pod `journalfit-worker-format`, PVC `journalfit-uploads`, PostgreSQL 17, serta Prometheus/Grafana.

### 5.3 Diagram ArchiMate 2: Enterprise Architecture (Layered, Application & Technology View)

> **[Sisipkan Gambar Terbaru: `02-architecture/02_evidence.jpg` — ArchiMate 3.2 Enterprise Architecture (3 Layer: Business, Application, Technology + Trust/Failure Boundaries)]**  
> *(Model native Archi tersedia di `architecture/journalfit-architecture.archimate`.)*

Diagram ArchiMate 3.2 menampilkan keterlacakan menyeluruh dari **Business Layer** (Author, Journal Editor, siklus 4 langkah asinkron), **Application Layer** (Traefik Ingress, Keycloak OIDC → panah JWKS Keys → Express 5 Modular Monolith & `worker-format` OOXML + 4 Data Objects), hingga **Technology & Infrastructure Layer** (kluster `k3d-capstone`, worker node `k3d-capstone-agent-0`, Docker host PostgreSQL 17 + Prometheus/Grafana, serta CI/CD Control Plane).

---

## Bab VI — Trust Boundary dan Failure Boundary

### 6.1 Trust Boundary (TB-1 s.d. TB-4)

- **[TB-1] Perimeter Boundary (External → Ingress):** Seluruh trafik luar hanya masuk lewat Traefik Ingress `:8088`; tidak ada pod backend, worker, maupun PostgreSQL yang diekspos langsung ke publik.
- **[TB-2] Identity & Cryptographic Boundary (Keycloak OIDC / RS256):** Backend memvalidasi signature RS256 menggunakan public keys dari JWKS internal (`http://keycloak.default.svc.cluster.local`). Tanpa/token rusak ditolak `401 UNAUTHENTICATED`, dan header palsu `X-Tenant-ID` diabaikan total saat `AUTH_MODE=jwt`.
- **[TB-3] Multi-Tenant & RBAC Boundary:** Akses lintas-tenant terhadap naskah milik tenant lain ditolak dengan `404 NOT_FOUND` (mencegah enumerasi ID); pelanggaran peran (`editor` memanggil endpoint upload khusus `author`) ditolak dengan `403 FORBIDDEN`.
- **[TB-4] Container Hardening & Secret Boundary:** Pod API, worker, dan job berjalan non-root `UID 10001` (`runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `automountServiceAccountToken: false`); Keycloak non-root `UID 1000`; seluruh kredensial disuntikkan via K8s Secret (`journalfit-backend-secret`, `keycloak-db-secret`, `keycloak-admin-secret`) tanpa ada rahasia di Git.

### 6.2 Failure Boundary (FB-1 s.d. FB-3)

- **[FB-1] Pod Failure & Rolling Update Boundary:** Penghapusan 1 pod backend secara paksa terbukti pulih otomatis dalam **7,1 detik** dengan `/health/ready` konsisten `200 OK` dan checksum SHA-256 PVC utuh. Uji rolling update (`maxUnavailable: 0, maxSurge: 1`) mencatat **777 request, 0 gagal**, p95 **26,73 ms**.
- **[FB-2] Queue & Storage Boundary:** Jika `worker-format` mengalami crash, job `pg-boss` otomatis di-retry (maks 2x, delay 5 detik) secara idempoten dan dipindahkan ke `format-check-dlq` bila terus gagal; berkas korup ditandai `INVALID_FILE` tanpa retry sia-sia. PVC `1Gi local-path` RWO mempertahankan data saat restart pod, namun masih terikat pada 1 node (`k3d-capstone-agent-0`).
- **[FB-3] Database Disaster Recovery Boundary:** Pengujian backup dan isolated restore (`db-backup-restore.sh`) membuktikan pemulihan DB `journalfit` dalam **RTO 0,78 detik** (6 tabel 100% cocok) dan pemulihan DB `keycloak` (**101 tabel** identik).

---

## Bab VII — Quality Scenarios (Evaluasi ATAM & Hasil Uji Nyata)

| No | Skenario | Stimulus | Respons & Ukuran Target | Hasil Verifikasi Aktual (v1) |
| :--- | :--- | :--- | :--- | :--- |
| **7.1** | **Performa** | Beban unggahan & pembacaan laporan secara paralel | API tetap responsif; p95 format < 30 detik, report cepat | **PASS:** API report p95 < 50 ms; rolling update 777 req (0 gagal, p95 26,73 ms); uji beban 19.865 req (0 gagal). |
| **7.2** | **Elastisitas** | Lonjakan CPU > 70% pada pod backend | HPA otomatis menaikkan replika `2→3` dan turun kembali ke `2` saat beban mereda | **PASS (`04_evidence`):** HPA teruji scale `2→3→2` pada beban 64 worker tanpa request gagal. |
| **7.3** | **Keamanan — Isolasi Tenant** | `author.b` (`tenant-b`) mengakses `ms-001` (`tenant-a`) atau mengirim `X-Tenant-ID` palsu | Akses lintas-tenant ditolak `404 NOT_FOUND`; header palsu diabaikan | **PASS (`06_evidence`):** Terbukti di Docker Compose & K8s Ingress + automated tests (`63/64 PASS`). |
| **7.4** | **Keamanan — Kontrol Peran (RBAC)** | `editor.a` memanggil endpoint upload (`author`-only) atau akses tanpa token | Tanpa token → `401`; salah peran → `403 FORBIDDEN` | **PASS (`06_evidence`):** Terbukti di Compose & K8s Ingress + OpenAPI tenant restriction tests. |
| **7.5** | **Ketahanan Worker & Queue** | File `.docx` korup atau error transien pada `worker-format` | File korup → `failed` (`INVALID_FILE`) tanpa retry; error transien → retry + DLQ + idempoten | **PASS (`format-worker.test.js`):** Terverifikasi pada automated worker & parser test suites. *(Graceful degradation AI scope masuk Roadmap v2).* |
| **7.6** | **Recovery (Backup & Restore)** | Simulasi kehilangan database (`restore drill`) & penghapusan pod | Restore DB < 5 menit; pod pulih otomatis tanpa hilang berkas PVC | **PASS (`08_evidence`):** Pod self-healing **7,1 detik** (SHA-256 cocok); DB Restore RTO **0,78 detik** (`journalfit` 6 tabel + `keycloak` 101 tabel). |
| **7.7** | **Biaya (*FinOps*)** | Pemeriksaan format naskah tanpa panggilan LLM eksternal | Biaya AI $0 pada v1; pemetaan biaya IaaS & headroom terukur | **SEBAGIAN PASS:** $0 biaya AI tercapai di v1; **[Rincian kapasitas & unit-cost final menunggu Paket C — `09_evidence.jpg`]**. |

---

## Bab VIII — Architecture Decision Records (ADR-001 s.d. ADR-009)

Seluruh 9 keputusan arsitektur terdokumentasi di `decisions/ADR-001` s.d. `ADR-009` dan telah diverifikasi otomatis menggunakan `automation/scripts/test-adr-conformance.py` (**9/9 ADR PASS — 100% compliant**) serta `npm test` (**63/64 tests PASS, 0 failures**).

> **[Sisipkan Gambar Terbaru: `10-decisions-adr/10_evidence.jpg` — Matriks ADR-001 s.d. ADR-009 & Automated Conformance Test]**

| ID | Keputusan Arsitektur | Alternatif Ditolak | Trade-Off & Bukti Implementasi |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Modular Monolith (`Node.js 22 + Express 5.3`) + Async Worker (`pg-boss`) | Microservices penuh terpisah | Hemat RAM (~128 MiB/pod), pemrosesan format asinkron terpisah via `worker-format.yaml`; scaling API tetap di level pod utuh. |
| **ADR-002** | PostgreSQL 17 + Logical Multi-Tenancy (`tenant_id`) | Dedicated DB per tenant / NoSQL | Integritas ACID & hemat resource; isolasi bergantung pada disiplin filter `tenant_id` di repository/service. |
| **ADR-003** | Kluster `k3d` + Hardened Container Non-Root (`UID 10001`) + HPA (2–3) | Docker Compose saja / Root container | Image ringan (`node:22-alpine`), `drop ALL`, HPA teruji `2→3→2`; koneksi DB lab memakai alias host k3d `host.k3d.internal` (koreksi 2026-11-23: `host.docker.internal` hanya ada di Docker Desktop dan gagal `ENOTFOUND` pada k3d Linux). |
| **ADR-004** | Declarative GitOps (Argo CD) + Immutable Tag SHA-7 (`0c2cf92`) | Manual `kubectl apply` & tag `:latest` | Audit trail Git 1:1 & anti-drift (`selfHeal: true`, `ignoreDifferences /spec/replicas`); butuh update `newTag` di `kustomization.yaml`. |
| **ADR-005** | PVC `local-path` RWO (1Gi) + `nodeSelector` Storage Pinning | Deploy kluster S3/MinIO penuh di v1 | Berkas `.docx` tetap utuh saat pod diganti (SHA-256 cocok 100%); replika terkunci pada 1 node (migrasi S3 di v2). |
| **ADR-006** | Runtime Secret Separation (`secretKeyRef`) + Trivy CI Scan Gate | Hardcoded password di YAML / Git | 0 kredensial di Git (`secret.example.yaml`), Trivy memblokir CVE `HIGH/CRITICAL`; secret dibuat imperatif saat setup kluster. |
| **ADR-007** | Pull Telemetry (`GET /metrics` API & Worker) + Prometheus & Grafana SLO | Paid SaaS APM Agent | Ringan & vendor-neutral (4 Golden Signals, retensi TSDB 3 hari); belum mencakup distributed tracing (OpenTelemetry). |
| **ADR-008** | `pg_dump` Isolated Restore + Native OOXML Rule Engine (`jszip` + `fast-xml-parser`) | Full-text DOCX ke Paid LLM API di v1 | RTO aktual **0,78 detik**, 9 rule `FMT-001..009`, **$0 biaya AI**; analisis semantik scope via AI masuk Roadmap v2. |
| **ADR-009** | Keycloak OIDC (`26.8.2`) RS256/JWKS, Claim `tenant_id` & Policy `404` | Mock token / Spoofable `X-Tenant-ID` | Verifikasi kriptografis kuat, anti-enumerasi `404`, RBAC `403`, `X-Tenant-ID` diabaikan; overhead RAM Keycloak ~596 MiB & cold start ~72s. |
