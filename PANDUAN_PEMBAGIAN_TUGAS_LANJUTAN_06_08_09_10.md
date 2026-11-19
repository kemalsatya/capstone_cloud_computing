# Panduan Lanjutan & Pembagian Tugas Tim 7 (Modul 06, 08, 09, 10 — Guideline 2)

Dokumen ini membagi pekerjaan lanjutan **Capstone JournalFit (Team 7)** untuk empat area yang belum memiliki gambar bukti final (`06`, `08`, `09`, `10`) menjadi **4 Paket Tugas Independen**.

Masing-masing anggota tim cukup **memilih 1 Paket**, mengerjakan apa yang perlu dibuat/diuji, menjalankan perintah terminalnya, menyusun gambar `*_evidence.jpg`, dan (jika ingin dibantu asisten AI seperti Cursor / Antigravity / ChatGPT / Claude) tinggal **copy-paste Prompt AI** yang sudah disiapkan pada paket masing-masing.

---

## 0. Peta Pilihan Paket (Pilih 1 Orang = 1 Paket)

| Paket | Modul & File Bukti Target | Bobot Nilai | Pekerjaan Utama yang Harus Dibuat & Dibuktikan | Rekomendasi Pemegang |
| :--- | :--- | :---: | :--- | :--- |
| **Paket A** | `06-security/06_evidence.jpg` | **10%** | Uji auth & isolasi tenant (`400`/`403`/`200`), buat template `deployment/secret.example.yaml` + audit secret, jalankan **Trivy image scan**, dan tulis interpretasi prioritas CVE. | Anggota 4 *(atau tukar)* |
| **Paket B** | `08-reliability-recovery/08_evidence.jpg` | **7.5%** | Uji **Controlled Pod Deletion** (`kubectl delete pod`) & self-healing di `k3d`, uji **Backup & Actual Restore** PostgreSQL (`pg_dump` ke DB validasi + cocokkan jumlah baris), dan hitung **RTO** nyata. | Anggota 2 / Anggota 4 |
| **Paket C** | `09-capacity-finops/09_evidence.jpg` | **5%** | Ukur utilisasi live (`kubectl top`), lengkapi **Capacity & Headroom Worksheet**, buat model **Cloud IaaS Mapping + FinOps Unit-Cost**, serta dokumentasikan **Residual Risk & Roadmap**. | Anggota 4 / Anggota 2 |
| **Paket D** | `10-decisions-adr/10_evidence.jpg` *(+ Cek `01`, `02`, `11`)* | **15%*** | Finalisasi & review **ADR-001 s.d. ADR-008**, lengkapi diagram arsitektur (`02`), matriks keputusan (`10_evidence.jpg`), dan jalankan **E2E Milestone Test** (`11_evidence.jpg`). | Anggota 1 & Anggota 3 |

*\*Catatan: Bobot 15% adalah nilai terpadu Domain Architecture & ADRs (`02-architecture` + `10-decisions-adr`).*

> **Target Output Semua Paket:** Setiap gambar `*_evidence.jpg` bukan sekadar tangkapan layar mentah, melainkan **wajib** dilengkapi catatan Standar Evidence di `README.md` folder masing-masing (**Scope, Owner, Source/Version, Timestamp, Method, Observation, Interpretation, Limitation, Decision Supported**) sesuai **Guideline 2 Section 9**.

---

## 1. Persiapan Awal Wajib (Untuk Semua Anggota)

Sebelum mengerjakan paket pilihan masing-masing, jalankan langkah berikut di **Git Bash** pada komputer Anda:

```bash
# 1. Tarik branch terbaru yang sudah disinkronkan
git fetch origin
git checkout feat/sync-all-work
git pull origin feat/sync-all-work

# 2. Buat branch kerja pribadi agar tidak bentrok saat push nanti (ganti <nama-paket>)
git checkout -b feat/paket-<06|08|09|10>-<nama-anda>

# 3. Cek kesiapan tool di laptop (git, docker, node, kubectl, k3d)
bash automation/scripts/doctor.sh
```

> **Catatan Lingkungan Lokal:**
> - Pastikan **Docker Desktop** sudah menyala sebelum menjalankan kontainer atau kluster `k3d`.
> - Jika stack belum menyala di laptop Anda:
>   - Jalankan DB & Backend lokal: `cp .env.example .env && docker compose up -d postgres app` (`http://localhost:8000`)
>   - Atau jika pakai Kubernetes `k3d` (`k3d-capstone`): `bash automation/scripts/create-cluster.sh && kubectl apply -k deployment/` (`http://localhost:8088` dengan header `Host: journalfit.localhost`).

---

## 2. Detail Tugas, Perintah & Prompt AI per Paket

---

### PAKET A — Modul `06-security/` (`06_evidence.jpg`)

#### Apa yang Harus Anda Buat & Kerjakan?
1. **Membuat template Secret aman (`deployment/secret.example.yaml`):** Saat ini di `deployment/` sudah ada `configmap.yaml`, tetapi belum ada contoh template manifest `Secret` tanpa kredensial asli. Buat `deployment/secret.example.yaml` (berisi placeholder seperti `CHANGE_ME`) dan pastikan tidak ada password nyata masuk ke Git.
2. **Menjalankan Uji Positive & Negative Authorization (Tenant Isolation & RBAC Token):**
   - Uji akses laporan `ms-001` (milik `tenant-a`):
     - Tanpa `X-Tenant-ID` -> harus **400 Bad Request**.
     - Pakai `X-Tenant-ID: tenant-b` -> harus **403 Forbidden** (*cross-tenant isolation proof*).
     - Pakai `X-Tenant-ID: tenant-a` -> harus **200 OK**.
   - Uji endpoint `POST /api/auth/token` (role `author`/`editor`) & rute non-eksisten (`404`).
3. **Audit Secret & Pod Hardening:** Verifikasi manifest `deployment/deployment.yaml` memakai `runAsNonRoot: true`, `runAsUser: 10001`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `automountServiceAccountToken: false`, dan `secretKeyRef: journalfit-backend-secret`.
4. **Menjalankan Pemindaian Kerentanan Nyata dengan Trivy:** Scan container image `journalfit-backend` (`CRITICAL,HIGH`), simpan hasil outputnya, lalu tulis **tabel interpretasi prioritas temuan** (CVE mana yang paling penting, dampaknya, apa yang dibuktikan scan dan apa keterbatasannya) di `evidence/security/README.md` (dan `06-security/README.md`).
5. **Menyusun `06_evidence.jpg` (3 Panel Rapi):**
   - **Panel 1:** Output `curl` HTTP `400`, `403`, dan `200`.
   - **Panel 2:** Audit secret (`git grep` bersih / `secret.example.yaml`) + `securityContext` non-root `UID 10001`.
   - **Panel 3:** Hasil **Trivy Scan** (`aquasec/trivy`) beserta ringkasan interpretasi risiko.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Nyalakan aplikasi & database lokal jika belum jalan
docker compose up -d postgres app

# 2. Build image backend lokal untuk di-scan Trivy
docker build -t journalfit-backend:latest -f source/Dockerfile ./source

# 3. Jalankan skrip otomasi capture Panel 06 (otomatis uji HTTP + audit YAML + Trivy)
bash automation/scripts/capture-evidence-06-08-09-10.sh 06

# 4. Uji tambahan issue token & 404 (opsional untuk memperkuat bukti IAM)
curl -i -X POST http://127.0.0.1:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"auditor-demo","role":"editor","tenantId":"tenant-a"}'
```

#### Prompt AI Siap Copy-Paste (Paket A: Security)
```text
Saya sedang mengerjakan Paket A (Modul 06 - Security) untuk proyek Capstone Cloud Computing "JournalFit" (Node.js Express v5, PostgreSQL 17, Docker, Kubernetes k3d) di branch `feat/sync-all-work`.

Konteks repositori saat ini:
- Aplikasi: `source/src/app.js`, middleware tenant: `source/src/common/middlewares/tenant.js`, auth mock: `source/src/modules/auth/`, seed data: `source/schema.sql` (`ms-001` milik `tenant-a`).
- Manifest K8s: `deployment/deployment.yaml`, `deployment/configmap.yaml`, `source/Dockerfile`.
- Skrip bantuan: `automation/scripts/capture-evidence-06-08-09-10.sh`.
- Dokumen target: `evidence/security/README.md` (dan folder portofolio `06-security/`).

Tolong bantu saya secara bertahap dan hanya berdasarkan output nyata yang kita jalankan bersama:
1. Buatkan file `deployment/secret.example.yaml` sebagai template manifest Kubernetes Secret bernama `journalfit-backend-secret` dengan key `DB_PASSWORD: "REPLACE_WITH_LOCAL_SECRET"` (tanpa password asli) dan pastikan `.gitignore` tetap melindungi secret nyata.
2. Periksa `source/src/modules/manuscripts/` & `source/tests/app.test.js` apakah sudah ada unit test negatif 400/403; jika belum lengkap, bantu tambahkan test negatif di `source/tests/app.test.js` lalu jalankan `npm test` di folder `source/`.
3. Pandu saya menjalankan container/backend lokal (`docker compose up -d postgres app`), membangun image `journalfit-backend:latest`, menjalankan `bash automation/scripts/capture-evidence-06-08-09-10.sh 06`, dan menjalankan `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL journalfit-backend:latest`.
4. Berdasarkan hasil scan Trivy dan log uji `400/403/200` yang benar-benar muncul di terminal saya nanti (jangan mengarang angka/CVE), bantu perbarui `evidence/security/README.md` sesuai Guideline 2 Section 9 (Scope, Owner, Source/Version, Timestamp, Method, Observation, Interpretation, Limitation, Decision Supported + Prioritized Remediation Table).
5. Jelaskan cara saya menggabungkan tangkapan layar menjadi `06_evidence.jpg` (3 panel) dan siapkan jawaban singkat untuk pertanyaan sidang: "Which secret would be most damaging if leaked?", "How do you prove tenant isolation?", dan "What does your Trivy scan prove and NOT prove?".
```

---

### PAKET B — Modul `08-reliability-recovery/` (`08_evidence.jpg`)

#### Apa yang Harus Anda Buat & Kerjakan?
1. **Membuat / Memverifikasi Skrip & Prosedur Failure Test + Backup Restore:**
   - Cek `automation/scripts/db-backup-restore.sh` dan `automation/scripts/capture-evidence-06-08-09-10.sh`.
   - Jika Anda punya ide peningkatan (mis. menyimpan laporan JSON/MD otomatis saat verifikasi RTO/RPO atau menambahkan verifikasi checksum berkas unggahan di PVC), implementasikan di skrip/dokumentasi modul `08`.
2. **Menjalankan Controlled Pod Failure Test di `k3d` (Self-Healing + Persistensi):**
   - Pastikan kluster `k3d-capstone` menyala dengan 2 replika `journalfit-backend` (`Running 1/1`).
   - Hapus 1 pod secara sengaja (`kubectl delete pod <nama-pod>`), catat waktu sampai ReplicaSet menciptakan pod pengganti menjadi `Ready`, dan buktikan `GET /health/ready` dan `GET /api/manuscripts/ms-001/report` tetap `HTTP 200` serta file pada PVC `/app/uploads` tidak hilang.
3. **Menjalankan Actual Database Backup & Restore Verification:**
   - Isi atau pastikan database `journalfit` memiliki data (`ms-001`, atau unggah 1 naskah tambahan agar terlihat perubahan record).
   - Jalankan backup nyata (`pg_dump` via `db-backup-restore.sh backup`).
   - Simulasikan pemulihan ke database terpisah `journalfit_restore_test`, ukur **waktu tempuh restore (RTO aktual)**, dan verifikasi **seluruh 6 tabel + `SELECT COUNT(*) FROM manuscripts;`** cocok 100% dengan database sumber!
4. **Menyusun `08_evidence.jpg` (2 Panel Rapi):**
   - **Panel 1:** Output terminal `kubectl get pods` sebelum -> `kubectl delete pod` -> pod baru muncul & `rollout status` sukses + ringkasan *zero-downtime rolling update*.
   - **Panel 2:** Output `db-backup-restore.sh backup` (ukuran file `.sql`), proses restore ke database validasi, tabel perbandingan jumlah baris sumber vs hasil restore, dan catatan waktu RTO aktual vs target SLO `< 5 menit`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Pastikan Postgres lokal & kluster k3d menyala
docker compose up -d postgres
bash automation/scripts/create-cluster.sh
kubectl apply -k deployment/
kubectl rollout status deployment/journalfit-backend --timeout=90s

# 2. Jalankan skrip otomasi Panel 08 (otomatis hapus 1 pod -> cek self-healing -> backup & restore test DB + ukur RTO)
bash automation/scripts/capture-evidence-06-08-09-10.sh 08
```

#### Prompt AI Siap Copy-Paste (Paket B: Reliability & Recovery)
```text
Saya sedang mengerjakan Paket B (Modul 08 - Reliability & Recovery) untuk proyek Capstone Cloud Computing "JournalFit" (Express v5, PostgreSQL 17, Kubernetes k3d) di branch `feat/sync-all-work`.

Konteks repositori saat ini:
- Manifest K8s: `deployment/deployment.yaml` (2 replika, maxUnavailable: 0, maxSurge: 1, readiness probe `/health/ready`) dan `deployment/pvc.yaml` (`journalfit-uploads`, 1Gi `local-path` RWO, `argocd.argoproj.io/sync-options: Prune=false,Delete=false`).
- Skrip recovery: `automation/scripts/db-backup-restore.sh` dan `automation/scripts/capture-evidence-06-08-09-10.sh`.
- Bukti referensi sebelumnya: `evidence/platform/pod-replacement-persistence.txt`, `evidence/platform/rolling-update-result.json`, `evidence/reliability-recovery/restore-proof.txt`.
- Dokumen target: `evidence/reliability-recovery/README.md` (dan folder `08-reliability-recovery/`).

Tolong bantu saya mengerjakan dan membuktikan modul 08 ini langkah demi langkah menggunakan hasil eksekusi nyata di mesin saya (jangan membuat angka fiktif):
1. Bantu saya memverifikasi prasyarat sebelum test: apakah `journalfit-postgres` berjalan, apakah kluster `k3d-capstone` aktif dengan 2 pod Ready, dan apakah secret `journalfit-backend-secret` sudah terpasang di namespace `default`.
2. Pandu saya menjalankan simulasi **Controlled Failure & Data Protection** lewat `bash automation/scripts/capture-evidence-06-08-09-10.sh 08` — jika ada error pada koneksi `k3d`, `kubectl`, atau `pg_dump`, bantu perbaiki konfigurasi atau skripnya.
3. Bantu saya menambahkan pengujian tambahan untuk membuktikan persistensi data nyata: misalnya sebelum `backup`, masukkan/upload 1 data uji baru ke database/API, lakukan `pg_dump`, uji hapus baris di DB validasi/simulasi bencana, lalu buktikan data tersebut pulih 100% setelah `restore` beserta catatan waktu RTO (detik) dan RPO.
4. Perbarui `evidence/reliability-recovery/README.md` dengan hasil observasi & angka RTO aktual saya mengikuti Guideline 2 Section 9 (Scope, Owner, Source/Version, Timestamp, Method, Observation, Interpretation, Limitation — misalnya keterbatasan RWO single-node, Decision Supported).
5. Pandu susunan screenshot untuk `08_evidence.jpg` (2 panel) dan siapkan jawaban singkat untuk pertanyaan sidang: "What happens if one application pod is deleted?", "What does your readiness probe protect against?", dan "What is your recovery target (RTO/RPO) and was it actually tested?".
```

---

### PAKET C — Modul `09-capacity-finops/` (`09_evidence.jpg`)

#### Apa yang Harus Anda Buat & Kerjakan?
1. **Mengumpulkan Data Pengukuran Resource Aktual (`Measurement`):**
   - Jalankan stack (`k3d` dengan Metrics Server + Docker Compose observability) dan ukur pemakaian CPU & Memory nyata dari `kubectl top nodes`, `kubectl top pods`, dan `docker stats --no-stream`.
   - Bandingkan antara **angka riil di mesin** vs **konfigurasi `requests`/`limits`** pada `deployment/deployment.yaml` (`100m/250m CPU`, `128Mi/256Mi RAM`) dan `deployment/hpa.yaml` (`min 2, max 3, CPU 70%`).
2. **Menyusun / Memverifikasi Capacity Worksheet & Analisis Over/Under-Provisioning:**
   - Jawab secara kuantitatif: komponen mana yang saat ini *over-provisioned* (mis. CPU pod 1% saat idle namun dipakai untuk *headroom* parsing `.docx`) dan komponen mana yang berisiko *under-provisioned* jika beban melonjak (mis. PVC `1Gi` atau DB single-container).
3. **Menyusun Model Cloud IaaS Mapping & Unit-Cost FinOps:**
   - Lengkapi kalkulasi migrasi dari laptop (`k3d`) ke Cloud IaaS / Private Cloud (CloudStack / AWS / GCP): berapa VM worker, Managed DB, Object Storage, dan estimasi biaya bulanan + **Unit Cost per pemeriksaan naskah**.
   - Jelaskan **"Optimization Without Harming Controls"**: bagaimana efisiensi (`node:22-alpine` 276 MB, *rule-engine* deterministik `$0` biaya token AI di v1, HPA scale `2–3`, retensi Prometheus `3d`) dilakukan **tanpa** melepas security context `UID 10001`, readiness probe, atau minimum 2 replika HA.
4. **Merapikan Residual Risks & Prioritized Improvement Roadmap:**
   - Pastikan minimal 3–4 risiko sisa yang jujur (`PVC ReadWriteOnce 1-node`, `Mock JWT`, `host.docker.internal DB`, `Local Registry tanpa TLS`) tercatat dengan langkah perbaikan v2.
5. **Menyusun `09_evidence.jpg` (3 Bagian/Panel Rapi):**
   - **Panel 1:** Output `kubectl top pods/nodes` & `docker stats` + Tabel Capacity & Headroom Worksheet.
   - **Panel 2:** Tabel Cloud IaaS Mapping & Unit-Cost FinOps (`$0.0011/cek` & efisiensi rule-engine vs LLM).
   - **Panel 3:** Tabel Residual Risks & Prioritized Improvement Roadmap.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. (Opsional tapi sangat disarankan untuk angka riil) Nyalakan Docker/k3d & ambil metrik live
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
kubectl top nodes
kubectl top pods

# 2. Cetak Capacity Worksheet, FinOps Model & Roadmap siap screenshot
bash automation/scripts/capture-evidence-06-08-09-10.sh 09
```

#### Prompt AI Siap Copy-Paste (Paket C: Capacity & FinOps)
```text
Saya sedang mengerjakan Paket C (Modul 09 - Capacity Planning, FinOps & Improvement Roadmap) untuk proyek Capstone Cloud Computing "JournalFit" (Express v5, PostgreSQL 17, Kubernetes k3d, Prometheus/Grafana) di branch `feat/sync-all-work`.

Konteks repositori saat ini:
- Sumber alokasi resource: `deployment/deployment.yaml` (requests CPU 100m/Mem 128Mi, limits CPU 250m/Mem 256Mi, 2 replika), `deployment/hpa.yaml` (min 2, max 3, avg CPU 70%), `deployment/pvc.yaml` (1Gi local-path RWO), `docker-compose.yml` (Prometheus retention 3d).
- Aplikasi v1 (`source/src/modules/manuscripts/services/manuscript.service.js`) menggunakan `mammoth` + rule-engine deterministik (tanpa panggilan API LLM berbayar di v1).
- Dokumen & skrip awal sudah ada di `evidence/capacity-finops/README.md` (atau `09-capacity-finops/README.md`) dan `automation/scripts/capture-evidence-06-08-09-10.sh`.

Tolong bantu saya melengkapi dan memvalidasi modul 09 ini secara nyata & terukur:
1. Pandu saya mengambil data utilisasi resource riil di laptop saya (`kubectl top pods`, `kubectl top nodes`, `kubectl describe hpa journalfit-backend`, dan `docker stats --no-stream`), lalu bantu saya mengaudit tabel Capacity & Headroom berdasarkan angka riil tersebut (tandai dengan jujur bagian mana yang pengukuran riil dan bagian mana yang asumsi proyeksi).
2. Jika saya ingin menambahkan file worksheet/spreadsheet CSV/Markdown atau script benchmark beban kecil (mis. mengirim 50–100 request paralel untuk melihat kenaikan CPU di HPA & `docker stats`), bantu buatkan dan jalankan agar analisis *over-provisioning / under-provisioning* saya punya bukti uji empiris!
3. Evaluasi dan pertajam analisis FinOps (`Cloud IaaS / CloudStack Mapping` + `Unit Cost per 1.000 manuscript checks` + perbandingan biaya v1 Deterministic Rule-Engine vs v2 Hybrid Abstract-Only LLM) agar sesuai prinsip "optimization without harming security/reliability controls".
4. Perbarui `evidence/capacity-finops/README.md` mengikuti Guideline 2 Section 9 (Scope, Owner, Source/Version, Timestamp, Method, Observation, Interpretation, Limitation, Decision Supported).
5. Pandu cara menata screenshot `09_evidence.jpg` (3 panel) dan siapkan jawaban singkat untuk pertanyaan sidang: "Which resource is currently over- or under-provisioned?" dan "What would change when the workload moves from k3d to a real IaaS/CloudStack platform?".
```

---

### PAKET D — Modul `10-decisions-adr/` (`10_evidence.jpg`) + Integrasi Diagram & Demo (`01`, `02`, `11`)

#### Apa yang Harus Anda Buat & Kerjakan?
1. **Review, Validasi & Lengkapi 8 Dokumen ADR (`decisions/ADR-001` s.d. `ADR-008`):**
   - Baca seluruh ADR yang sudah dibuat ([`decisions/`](file:///C:/Users/liaur/Documents/Tugas-Tugas%20Kuliah/Semester%20Ganjil/Semester%205/CloudComputing/Project%20CloudComputing/capstone_cloud_computing/decisions/README.md)). Pastikan setiap ADR konsisten dengan kode nyata di repo (mis. cek jika ada perubahan konfigurasi atau tambah ADR-009 jika tim membuat keputusan baru seperti Template Secret atau Strategi Testing).
   - Setiap ADR harus memiliki **Alternatives Considered**, **Rationale**, **Trade-offs/Consequences** (positif & negatif), dan keterkaitannya dengan atribut kualitas (*Availability, Security, Cost, Portability*).
2. **Menyempurnakan Diagram Arsitektur (`02-architecture/02_evidence.jpg`) & Business Case (`01-business/01_evidence.jpg`):**
   - Karena bobot Architecture (15%) menilai `02-architecture` dan `10-decisions-adr` bersamaan, buat/ekspor visual **Architecture Diagram** yang rapi (mis. via Mermaid / Draw.io / Excalidraw) menampilkan **Control Plane vs Data Plane**, **Trust Boundaries**, dan **Failure Boundaries** menjadi `02_evidence.jpg`.
   - Buat/ekspor ringkasan **Lean Canvas / Business Workflow** dari `JournalFit_Konsep_Proyek_M0_M1.docx` menjadi `01_evidence.jpg`.
3. **Menghasilkan `10_evidence.jpg` (Matriks ADR):**
   - Jalankan perintah pencetak matriks ADR atau render tabel Markdown di `decisions/README.md`, lalu screenshot rapi menjadi `10_evidence.jpg`.
4. **Memvalidasi End-to-End Scenario (`11-demo-defense/11_evidence.jpg`):**
   - Jalankan skrip integrasi menyeluruh `bash automation/scripts/e2e-milestone-test.sh` (67 checks M0–M7), pastikan semuanya PASS, dan screenshot ringkasan akhirnya sebagai `11_evidence.jpg`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Cetak Matriks ADR-001 s.d. ADR-008 ke terminal (siap screenshot 10_evidence.jpg)
bash automation/scripts/capture-evidence-06-08-09-10.sh 10

# 2. Jalankan Unit Tests untuk memastikan konsistensi aplikasi (ADR-001 / ADR-002)
cd source && npm test && cd ..

# 3. Jalankan full End-to-End Test (pastikan Docker Desktop aktif) untuk 11_evidence.jpg
bash automation/scripts/e2e-milestone-test.sh --with-trivy
```

#### Prompt AI Siap Copy-Paste (Paket D: ADR, Architecture & Demo Defense)
```text
Saya sedang mengerjakan Paket D (Modul 10 - Decisions ADR, serta penyelarasan 01-Business, 02-Architecture, dan 11-Demo-Defense) untuk proyek Capstone Cloud Computing "JournalFit" di branch `feat/sync-all-work`.

Konteks repositori saat ini:
- File ADR: `decisions/README.md` dan `decisions/ADR-001` s.d. `ADR-008` (juga di `cloud-capstone-team-7/10-decisions-adr/`).
- Diagram teks arsitektur: `architecture/index.md` dan `evidence/architecture/README.md`.
- Skrip: `automation/scripts/capture-evidence-06-08-09-10.sh` (mode `10`) dan `automation/scripts/e2e-milestone-test.sh`.
- Dokumen referensi proyek: `README.md`, `source/src/app.js`, `source/schema.sql`, `deployment/*.yaml`, `.github/workflows/ci.yaml`.

Tolong bantu saya mengerjakan dan menyempurnakan paket ini secara lengkap & faktual:
1. Lakukan audit silang antara `decisions/ADR-001` s.d. `ADR-008` dengan isi aktual `source/`, `deployment/`, `.github/workflows/ci.yaml`, dan `docker-compose.yml`. Pastikan tidak ada satu pun klaim di ADR yang bertentangan dengan implementasi nyata (misal versi Node, nama probe, cara auth/tenancy, dan cara evaluasi rule-engine tanpa AI API eksternal di v1).
2. Buatkan diagram visual arsitektur yang rapi (format Mermaid `.mmd` / HTML-to-SVG atau instruksi Draw.io) yang memperlihatkan secara jelas **Control Plane vs Data Plane**, **External/Tenant/Secret Trust Boundaries**, dan **Failure Boundaries** agar bisa langsung saya ekspor menjadi `02_evidence.jpg`, serta ringkasan **Lean Canvas / Alur Bisnis** untuk `01_evidence.jpg`.
3. Periksa & perkaya `decisions/README.md` dengan kolom Evidence Standard (Guideline 2 Section 9) serta bantu saya menjalankan `bash automation/scripts/capture-evidence-06-08-09-10.sh 10` untuk menghasilkan tangkapan layar `10_evidence.jpg`.
4. Bantu saya menjalankan `bash automation/scripts/e2e-milestone-test.sh` sebagai gladi bersih demo akhir (`11_evidence.jpg`) dan susun ringkasan jawaban **12 Bank Pertanyaan Sidang (Guideline 2 Section 13.1)** agar saya dan tim siap saat Technical Defense 20–25 menit.
```

---

## 3. Cara Mengumpulkan Hasil Kerja ke Paket Final

Setelah masing-masing anggota menyelesaikan paketnya:
1. Simpan gambar hasil tangkapan layar pada folder paket `cloud-capstone-team-7/` sesuai penamaan persis **Guideline 2**:
   - Pemegang Paket A -> `cloud-capstone-team-7/06-security/06_evidence.jpg` + update log & `README.md`
   - Pemegang Paket B -> `cloud-capstone-team-7/08-reliability-recovery/08_evidence.jpg` + update log & `README.md`
   - Pemegang Paket C -> `cloud-capstone-team-7/09-capacity-finops/09_evidence.jpg` + update log & `README.md`
   - Pemegang Paket D -> `cloud-capstone-team-7/10-decisions-adr/10_evidence.jpg` (dan `01_evidence.jpg`, `02_evidence.jpg`, `11_evidence.jpg`) + update ADR/README
2. Push perubahan kode, skrip, log teks, dan dokumen `.md` ke branch masing-masing di GitHub (`capstone_cloud_computing`), lalu buka Pull Request ke `feat/sync-all-work` / `main`.
3. Isi juga **Individual Reflection** masing-masing anggota (kontribusi teknis, pembelajaran utama, satu keputusan desain/perbedaan pendapat arsitektur, dan rencana perbaikan berikutnya) di folder `individual-reflections/<nama-anggota>.md` sebelum final defense!
