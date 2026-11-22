# Panduan Pembagian Tugas Progress Milestone 2 — Tim 7 (JournalFit)

Dokumen ini membagi pekerjaan **Progress Milestone 2** untuk empat modul utama yang belum memiliki gambar bukti final (**`06`**, **`08`**, **`09`**, **`10`** — plus penyelarasan **`01`**, **`02`**, **`11`**) berdasarkan kondisi terbaru branch **`main` (`2dc3593` — pasca merge PR #10, #11, dan #12 integrasi Keycloak SSO/OIDC)** menjadi **4 Paket Independen**.

Masing-masing anggota tim bebas **memilih sendiri 1 Paket** (1 orang = 1 paket), mengerjakan requirement & perintah terminalnya, menyusun `*_evidence.jpg` beserta catatan 9 field **Evidence Standard (Guideline 2 §9)**, dan bila ingin dibantu AI tinggal **copy-paste Prompt AI** pada paket yang dipilih.

> **Fokus Scope Milestone 2 (Guideline 2 §6 & §11):**
> - **Prioritas Utama (Wajib 100%):** Menuntaskan seluruh baseline wajib di atas stack yang sudah berjalan (`Express + PostgreSQL + Keycloak OIDC/JWT + k3d + Argo CD + Prometheus/Grafana + Trivy + Backup/Restore`), 11 gambar `*_evidence.jpg`, `final-report.pdf` (§15.1), dan 4 `individual-reflections/` (§12H).
> - **Di Luar Scope Wajib Milestone 2 (Masuk Roadmap):** Fitur tambahan di `PRD_JournalFit_v0.1.md` yang belum dibangun di `source/` (Garage S3, worker `pg-boss`, AI scope checker Groq, rule-template suggester) dicatat jujur sebagai **Limitation & Improvement Roadmap** (Critical Gate §14.2: tidak boleh mengklaim fitur yang belum terbukti).

---

## 0. Peta Pilihan Paket (Bebas Pilih: 1 Orang = 1 Paket)

| Paket | Modul & File Bukti Target | Bobot Rubrik | Pekerjaan Utama yang Harus Dibuat & Dibuktikan | Status / Dipilih Oleh |
| :--- | :--- | :---: | :--- | :--- |
| **Paket A** | `06-security/06_evidence.jpg` | **10%** | Buat `deployment/secret.example.yaml`, uji ulang auth & isolasi tenant pakai **JWT Keycloak** (`401`/`403`/`404`/`200`, `X-Tenant-ID` diabaikan), audit secret & non-root, merge/update **Trivy scan** image terbaru + tabel prioritas remediasi CVE nyata. *(Progress di GitHub: Keycloak PR #11/#12 sudah di `main`; `trivy-scan.txt` awal sudah ada di branch `feat/evidence-jpg-trivy-observability`)* | **Sudah Diambil** |
| **Paket B** | `08-reliability-recovery/08_evidence.jpg` | **7.5%** | Verifikasi deploy K8s + Keycloak (`setup-keycloak.sh`), uji **Controlled Pod Deletion** (`kubectl delete pod`) & self-healing + ringkasan rolling update (`0 failed`), uji **Backup & Actual Restore** DB (`journalfit` + catatan/backup `keycloak`) + ukur **RTO aktual**. | `[ Terbuka — bebas pilih ]` |
| **Paket C** | `09-capacity-finops/09_evidence.jpg` | **5%** | Ambil metrik live (`kubectl top`, `describe hpa`, `docker stats`), perbarui **Capacity & Headroom Worksheet** dengan memasukkan **pod Keycloak** (`~596 MiB`), lengkapi **Cloud IaaS Mapping + Unit-Cost FinOps**, dan revisi **Residual Risks & Roadmap** pasca-Keycloak. | `[ Terbuka — bebas pilih ]` |
| **Paket D** | `10-decisions-adr/10_evidence.jpg` *(+ `01`, `02`, `11`)* | **15%*** *(+10% +2.5%)* | Audit `ADR-001`..`ADR-008`, revisi `ADR-006` + tambah **`ADR-009` (Keycloak OIDC)** → `10_evidence.jpg`; buat diagram visual arsitektur (+ Keycloak) → `02_evidence.jpg`; ringkasan bisnis → `01_evidence.jpg`; gladi bersih E2E → `11_evidence.jpg` *(bagian `01`/`02`/`10` bisa dikerjakan langsung; hanya `11` menunggu integrasi akhir)*. | **Liaurentino** |

*\*Catatan: Bobot 15% adalah nilai terpadu Architecture & ADRs (`02-architecture` + `10-decisions-adr`). Bukti `03`, `04`, `05`, `07` sudah tersedia, namun pastikan catatan versinya selaras dengan `main` terbaru.*

---

## 1. Prasyarat Sinkronisasi Bersama (Sebelum Ambil Bukti Final)

Sebelum mengambil screenshot final untuk kluster `k3d`, pastikan **3 penyelarasan teknis** di `main` ini sudah beres (dikerjakan bersama / oleh pengelola CI/CD & kluster):
1. **Bump tag image backend di `deployment/kustomization.yaml`:** tag lama `3bdf305` belum memuat library `jose` / middleware Keycloak, sedangkan `deployment/configmap.yaml` sudah mengeset `AUTH_MODE: jwt`. Build ulang image dari `main` terbaru dan perbarui `images[].newTag` ke SHA-7 baru.
2. **Arahkan Argo CD ke `main`:** perbarui `automation/argocd/application.yaml` dari `targetRevision: milestone-per-week` ke `main` agar Argo CD menyinkronkan manifest Keycloak + backend terbaru.
3. **Siapkan DB & Secret Keycloak di `k3d`:** jalankan `bash automation/scripts/setup-keycloak.sh` sebelum `kubectl apply -k deployment/`.

---

## 2. Persiapan Awal Wajib (Untuk Semua Anggota)

Jalankan langkah berikut di **Git Bash** pada root repositori `capstone_cloud_computing`:

```bash
# 1. Tarik kondisi terbaru branch main (sudah memuat Keycloak PR #11 & #12)
git fetch origin
git checkout main
git pull --ff-only origin main

# 2. Buat feature branch kerja pribadi (DILARANG direct commit ke main)
git checkout -b feat/m2-paket-<a|b|c|d>-<nama-anda>

# 3. Cek kesiapan tool lokal (git, docker, node, kubectl, k3d)
bash automation/scripts/doctor.sh
```

**Aturan Wajib (Critical Quality Gates — Guideline 2 §14.2):**
- **Jangan pernah** commit file `.env`, password DB/Keycloak, token, atau kredensial nyata ke Git.
- **Jangan menyalin output lama pre-Keycloak** (`400/403` `X-Tenant-ID`) sebagai hasil uji keamanan terbaru — modul `06` wajib menggunakan token JWT Keycloak aktual (`source/AUTH.md`).
- Setiap `README.md` modul wajib memuat 9 field **Evidence Standard (§9)**: *Scope, Owner, Source/Version, Timestamp, Method, Observation, Interpretation, Limitation, Decision Supported*.

---

## 3. Detail Tugas, Requirement, Perintah & Prompt AI per Paket

---

### PAKET A — Modul `06-security/` (`06_evidence.jpg` — Bobot 10%)

#### Apa yang Harus Dibuat & Dibuktikan?
1. **Membuat template Secret aman (`deployment/secret.example.yaml`):**
   - Buat template Kubernetes Secret untuk `journalfit-backend-secret` (`DB_PASSWORD: "REPLACE_WITH_LOCAL_SECRET"`, sejajar dengan `deployment/keycloak/secret.example.yaml`). Pastikan `.gitignore` memblokir secret nyata.
2. **Menjalankan Uji Positive & Negative Authorization BARU dengan JWT Keycloak (sesuai `source/AUTH.md`):**
   - `POST /api/auth/token` (mock) sudah dihapus; backend kini memakai `AUTH_MODE=jwt` dengan realm `journalfit`.
   - Wajib membuktikan 5 kasus uji nyata dan menyimpan log mentahnya ke `evidence/security/negative-authorization-test.txt`:
     - Tanpa token & token rusak ke `GET /api/auth/me` → **`401 UNAUTHENTICATED`**.
     - `author.b` (`tenant-b`) akses `GET /api/manuscripts/ms-001/report` (milik `tenant-a`) → **`404 NOT_FOUND`** (*cross-tenant isolation*).
     - `editor.a` memanggil `POST /api/manuscripts/upload` (khusus `author`) → **`403 FORBIDDEN`** (*RBAC*).
     - `author.a` mengirim header palsu `X-Tenant-ID: tenant-b` → **diabaikan**, respons tetap mengacu claim token `tenant-a`.
     - `author.a` / `editor.a` akses sah (`GET /api/auth/me` & report `tenant-a`) → **`200 OK`**.
3. **Audit Secret & Container Hardening:**
   - Buktikan `git grep` bersih dari kredensial riil; verifikasi container non-root `UID 10001` (backend) & `UID 1000` (keycloak), `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `automountServiceAccountToken: false`.
4. **Pemindaian Kerentanan Trivy & Tabel Prioritas Remediasi Nyata:**
   - Build image backend terbaru (memuat `jose`) dan jalankan `aquasec/trivy` (`HIGH,CRITICAL`) — cek/gabungkan juga dengan `evidence/security/trivy-scan.txt` di branch `origin/feat/evidence-jpg-trivy-observability`.
   - Perbarui `evidence/security/README.md` dengan **Prioritized Remediation Table** berdasarkan CVE aktual + penjelasan eksplisit *apa yang dibuktikan scan dan apa yang TIDAK dibuktikan scan*, lengkap 9 field Evidence Standard.
5. **Menyusun `06_evidence.jpg` (3 Panel Rapi):**
   - **Panel 1:** Output `curl` uji JWT Keycloak (`401`, `404` lintas-tenant, `403` RBAC, `X-Tenant-ID` diabaikan, `200`).
   - **Panel 2:** Audit secret (`git grep` bersih + `secret.example.yaml`) & `securityContext` non-root (`UID 10001` / `UID 1000`).
   - **Panel 3:** Output **Trivy Scan** terbaru + ringkasan tabel prioritas remediasi.
6. **Kontribusi Laporan Akhir:** Draft **Bab 7 (Security)** `final-report.pdf` + `individual-reflections/<nama-anda>.md`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Jalankan Postgres, Keycloak, dan App lokal (atau pakai Ingress k3d :8088)
cp -n .env.example .env
docker compose up -d postgres keycloak app

KC_URL="http://localhost:8081/realms/journalfit/protocol/openid-connect/token"
API_URL="http://localhost:8000"

# 2. Ambil token user demo dari Keycloak
TOK_AUTH_A=$(curl -s -X POST "$KC_URL" -d "grant_type=password&client_id=journalfit-app&username=author.a&password=author.a&scope=openid" | jq -r .access_token)
TOK_EDIT_A=$(curl -s -X POST "$KC_URL" -d "grant_type=password&client_id=journalfit-app&username=editor.a&password=editor.a&scope=openid" | jq -r .access_token)
TOK_AUTH_B=$(curl -s -X POST "$KC_URL" -d "grant_type=password&client_id=journalfit-app&username=author.b&password=author.b&scope=openid" | jq -r .access_token)

# 3. Jalankan suite Positive & Negative Auth Tests
curl -i "$API_URL/api/auth/me"                                                         # 401
curl -i -H "Authorization: Bearer bad.token" "$API_URL/api/auth/me"                    # 401
curl -i -H "Authorization: Bearer $TOK_AUTH_B" "$API_URL/api/manuscripts/ms-001/report" # 404 (cross-tenant)
curl -i -X POST -H "Authorization: Bearer $TOK_EDIT_A" "$API_URL/api/manuscripts/upload" # 403 (RBAC)
curl -i -H "Authorization: Bearer $TOK_AUTH_A" -H "X-Tenant-ID: tenant-b" "$API_URL/api/auth/me" # 200 (tenant-a)

# 4. Build image backend terbaru & jalankan Trivy scan
docker build -t journalfit-backend:latest -f source/Dockerfile ./source
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image --severity HIGH,CRITICAL journalfit-backend:latest
```

#### Prompt AI Siap Copy-Paste (Paket A — Security)
```text
Saya memilih Paket A (Modul 06 - Security) untuk Progress Milestone 2 proyek Capstone Cloud Computing "JournalFit" di branch `main` terbaru (`capstone_cloud_computing`, sudah termasuk integrasi Keycloak PR #11 & #12).

Konteks repo saat ini:
- Auth baru: `source/AUTH.md`, `source/src/common/middlewares/auth.js`, `source/tests/auth.test.js` (`AUTH_MODE=jwt`, endpoint `GET /api/auth/me`, `POST /api/auth/token` sudah dihapus; tanpa/bad token → `401`, cross-tenant → `404`, salah role → `403`, `X-Tenant-ID` diabaikan).
- Manifest K8s: `deployment/deployment.yaml`, `deployment/configmap.yaml`, `deployment/keycloak/secret.example.yaml`, `source/Dockerfile`.
- Dokumen target: `evidence/security/README.md` (dan portofolio `cloud-capstone-team-7/06-security/`).

Tolong bantu saya secara bertahap dan hanya berdasarkan output nyata yang kita jalankan bersama (jangan menyalin hasil lama pre-Keycloak dan jangan mengarang CVE/angka):
1. Buatkan file `deployment/secret.example.yaml` untuk `journalfit-backend-secret` (key `DB_PASSWORD: "REPLACE_WITH_LOCAL_SECRET"`, sejajar dengan `deployment/keycloak/secret.example.yaml`) dan verifikasi `.gitignore` tetap melindungi secret nyata.
2. Pandu saya menjalankan `docker compose up -d postgres keycloak app` (serta migrasi `source/migrations/001_add_keycloak_auth.sql` jika DB lama), mengambil token `author.a`, `editor.a`, `author.b`, dan menjalankan 5 kasus uji `401/404/403/header-ignored/200` lalu menyimpan output mentahnya ke `evidence/security/negative-authorization-test.txt`.
3. Pandu saya membangun image `journalfit-backend:latest` dan menjalankan Trivy scan (`aquasec/trivy:latest image --severity HIGH,CRITICAL journalfit-backend:latest`).
4. Berdasarkan log pengujian & hasil Trivy nyata di terminal saya, perbarui `evidence/security/README.md` sesuai Guideline 2 Section 9 (9 field Evidence Standard + Prioritized Remediation Table nyata + penjelasan *what Trivy proves and does NOT prove*).
5. Pandu penataan screenshot 3 panel untuk `06_evidence.jpg`, draft Bab 7 Laporan Akhir, dan jawaban singkat sidang: "Which secret would be most damaging if leaked?", "How do you prove tenant isolation?", dan "What does your scan prove and not prove?".
```

---

### PAKET B — Modul `08-reliability-recovery/` (`08_evidence.jpg` — Bobot 7.5%)

#### Apa yang Harus Dibuat & Dibuktikan?
1. **Verifikasi Runtime Kluster `k3d-capstone` (Backend + Keycloak):**
   - Jalankan `bash automation/scripts/setup-keycloak.sh` dan `kubectl apply -k deployment/` agar seluruh workload (2 pod `journalfit-backend`, 1 pod `keycloak`, PVC `Bound`, HPA aktif) berjalan sehat sebelum pengujian failure.
2. **Panel 1 — Controlled Pod Failure (Self-Healing + Persistensi PVC) & Rolling Update:**
   - Hapus 1 pod `journalfit-backend` secara sengaja (`kubectl delete pod <pod>`), catat waktu sampai ReplicaSet menciptakan pod pengganti menjadi `Running 1/1 Ready`.
   - Buktikan `GET /health/ready` tetap `HTTP 200` dan checksum SHA-256 berkas di PVC `/app/uploads` tidak hilang/berubah.
   - Sertakan ringkasan bukti rolling update tanpa kegagalan (`evidence/platform/rolling-update-result.json`: 777 requests, `failed_requests: 0`, p95 `26.73 ms`).
3. **Panel 2 — Actual Database Backup & Isolated Restore Verification + RTO:**
   - Jalankan backup nyata PostgreSQL (`bash automation/scripts/db-backup-restore.sh backup`), catat ukuran berkas `.sql` yang dihasilkan.
   - Lakukan restore nyata ke database validasi terisolasi (`journalfit_restore_test`), ukur **RTO aktual (detik)** terhadap target `< 5 menit`, dan buktikan **seluruh 6 tabel + `SELECT COUNT(*) FROM manuscripts`** cocok 100% dengan DB sumber.
   - Jalankan juga backup/verifikasi DB `keycloak` (atau catat prosedurnya + keterbatasannya secara eksplisit).
4. **Perbarui `evidence/reliability-recovery/README.md` & Susun `08_evidence.jpg` (2 Panel Rapi):**
   - **Panel 1 (Kiri):** `kubectl get pods` sebelum → `kubectl delete pod` → pod baru `Ready` + verifikasi SHA-256 PVC & ringkasan rolling update.
   - **Panel 2 (Kanan):** Output `db-backup-restore.sh backup` + proses restore ke DB validasi + tabel cocoknya jumlah baris + waktu RTO aktual vs target SLO.
   - Lengkapi 9 field Evidence Standard (termasuk keterbatasan jujur: PVC RWO 1-node & backup manual).
5. **Kontribusi Laporan Akhir:** Draft **Bab 9 (Reliability & Recovery)** `final-report.pdf` + `individual-reflections/<nama-anda>.md`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Pastikan Postgres & kluster k3d menyala + Keycloak secrets terpasang
docker compose up -d postgres
bash automation/scripts/setup-keycloak.sh
kubectl --context k3d-capstone apply -k deployment/
kubectl --context k3d-capstone -n default rollout status deployment/journalfit-backend --timeout=90s

# 2. Panel 1 — Controlled Pod Deletion & Self-Healing
kubectl --context k3d-capstone -n default get pods -l app=journalfit
POD=$(kubectl --context k3d-capstone -n default get pods -l app=journalfit -o jsonpath='{.items[0].metadata.name}')
kubectl --context k3d-capstone -n default delete pod "$POD"
kubectl --context k3d-capstone -n default rollout status deployment/journalfit-backend --timeout=90s
kubectl --context k3d-capstone -n default get pods -l app=journalfit

# 3. Panel 2 — Backup & Actual Isolated Restore + Ukur RTO
bash automation/scripts/db-backup-restore.sh backup
# Ganti <file.sql> dengan file backup yang baru terbuat di evidence/reliability-recovery/:
time bash automation/scripts/db-backup-restore.sh restore evidence/reliability-recovery/<file.sql>
```

#### Prompt AI Siap Copy-Paste (Paket B — Reliability & Recovery)
```text
Saya memilih Paket B (Modul 08 - Reliability & Recovery) untuk Progress Milestone 2 proyek Capstone Cloud Computing "JournalFit" di branch `main` terbaru (`capstone_cloud_computing`, sudah termasuk Keycloak PR #11 & #12).

Konteks repo saat ini:
- Manifest K8s: `deployment/deployment.yaml` (2 replika, maxUnavailable: 0, maxSurge: 1, readiness `/health/ready`), `deployment/pvc.yaml` (1Gi local-path RWO, `Prune=false,Delete=false`), dan `deployment/keycloak/deployment.yaml` (1 replika `Recreate`).
- Skrip: `automation/scripts/setup-keycloak.sh`, `automation/scripts/db-backup-restore.sh`.
- Bukti referensi sebelumnya: `evidence/platform/pod-replacement-persistence.txt`, `evidence/platform/rolling-update-result.json`, `evidence/reliability-recovery/restore-proof.txt`, `evidence/reliability-recovery/README.md`.

Tolong bantu saya mengerjakan dan membuktikan modul 08 secara nyata di mesin saya (jangan membuat angka fiktif):
1. Bantu memverifikasi prasyarat: `journalfit-postgres` berjalan, `setup-keycloak.sh` selesai, kluster `k3d-capstone` aktif dengan 2 pod `journalfit-backend` Ready dan PVC `Bound`.
2. Pandu saya menjalankan **Controlled Pod Failure Test** (`kubectl delete pod`), mengukur waktu self-healing sampai pod baru `Ready`, serta membuktikan `GET /health/ready` tetap 200 dan file PVC tidak hilang.
3. Pandu saya menjalankan **Actual Backup & Restore** lewat `automation/scripts/db-backup-restore.sh` (tambahkan uji insert/cek data sebelum backup → restore ke DB validasi → cocokkan 6 tabel & jumlah baris + ukur waktu RTO dalam detik), serta bantu tambahkan verifikasi backup DB `keycloak` (atau catat batasannya).
4. Perbarui `evidence/reliability-recovery/README.md` dengan hasil observasi & RTO aktual saya sesuai Guideline 2 Section 9 (9 field Evidence Standard, termasuk keterbatasan RWO single-node).
5. Pandu penataan screenshot 2 panel untuk `08_evidence.jpg`, draft Bab 9 Laporan Akhir, dan jawaban singkat sidang: "What happens if one application pod is deleted?", "What does your readiness probe protect against?", dan "What is your recovery target (RTO/RPO) and was it actually tested?".
```

---

### PAKET C — Modul `09-capacity-finops/` (`09_evidence.jpg` — Bobot 5%)

#### Apa yang Harus Dibuat & Dibuktikan?
1. **Mengambil Data Utilisasi Resource Nyata (Termasuk Pod Keycloak):**
   - Ambil pengukuran aktual dari kluster & Docker: `kubectl top nodes`, `kubectl top pods -n default`, `kubectl describe hpa journalfit-backend`, dan `docker stats --no-stream`.
   - Simpan output mentah ke `evidence/capacity-finops/live-metrics.txt`.
2. **Memperbarui Capacity & Headroom Worksheet (Pasca-Keycloak):**
   - Dokumen `evidence/capacity-finops/README.md` lama belum memasukkan **pod Keycloak** (`requests: 250m CPU / 512Mi RAM`, `limits: 1000m CPU / 1Gi RAM`, cold start terukur 72s / `~596 MiB` RAM di `deployment/README.md`).
   - Hitung ulang total reservasi & puncak host (Backend 2–3 pod HPA + Keycloak 1 pod + PostgreSQL + Prometheus/Grafana + k3s control plane), bedakan jelas mana angka **terukur (*measured*)** dan mana **asumsi (*assumed*)**, serta identifikasi mana yang *over-provisioned* dan mana yang berisiko *under-provisioned*.
3. **Memperbarui Cloud IaaS Mapping & FinOps Unit-Cost:**
   - Sesuaikan pemetaan ke Cloud IaaS / CloudStack (pastikan sizing RAM worker node memadai untuk Backend + Keycloak + DB).
   - Jelaskan **Unit-Cost per pemeriksaan naskah** dan prinsip **"Optimization Without Harming Controls"** (`node:22-alpine`, rule-engine deterministik `$0` biaya AI di v1, HPA `2–3`, retensi Prometheus `3d` tanpa melepas `UID 10001`, Keycloak JWT, atau min 2 replika).
4. **Merevisi Residual Risks & Prioritized Improvement Roadmap:**
   - **Hapus klaim lama** *"R2: Mock JWT belum pakai Keycloak"* karena Keycloak sudah aktif di `main`!
   - Ganti dengan risiko sisa yang benar-benar ada: (R1) PVC RWO single-node, (R2) Keycloak `direct access grant` & password demo lokal, (R3) PostgreSQL via `host.docker.internal` & backup manual, (R4) Registry lokal tanpa auth/TLS + fitur PRD v2 (Garage S3, `pg-boss`, Groq AI scope checker).
5. **Menyusun `09_evidence.jpg` (3 Panel Rapi):**
   - **Panel 1:** Output `kubectl top` / `docker stats` + Capacity & Headroom Worksheet (sudah mencakup Keycloak).
   - **Panel 2:** Cloud IaaS Mapping + kalkulasi Unit-Cost FinOps & *Optimization Without Harming Controls*.
   - **Panel 3:** Tabel Residual Risks & Prioritized Improvement Roadmap terbaru.
6. **Kontribusi Laporan Akhir:** Draft **Bab 10–12 (Capacity/FinOps, Limitations & Residual Risk, Improvement Roadmap)** `final-report.pdf` + `individual-reflections/<nama-anda>.md`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Ambil metrik live dari Kubernetes (termasuk pod Keycloak) & Docker
kubectl --context k3d-capstone top nodes
kubectl --context k3d-capstone top pods -n default
kubectl --context k3d-capstone describe hpa journalfit-backend -n default
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

#### Prompt AI Siap Copy-Paste (Paket C — Capacity & FinOps)
```text
Saya memilih Paket C (Modul 09 - Capacity Planning, FinOps & Roadmap) untuk Progress Milestone 2 proyek Capstone Cloud Computing "JournalFit" di branch `main` terbaru (`capstone_cloud_computing`, sudah termasuk Keycloak PR #11 & #12).

Konteks repo saat ini:
- Alokasi resource aktual:
  - `deployment/deployment.yaml`: backend 2–3 pod (HPA min 2, max 3, CPU 70%), requests `100m/128Mi`, limits `250m/256Mi`.
  - `deployment/keycloak/deployment.yaml`: Keycloak 1 pod (`Recreate`), requests `250m/512Mi`, limits `1000m/1Gi` (cold start terukur 72s / `596MiB` di `deployment/README.md`).
  - `deployment/pvc.yaml`: 1Gi local-path RWO; `docker-compose.yml`: Postgres 17, Prometheus (retensi 3d), Grafana.
- Dokumen lama yang perlu diperbarui: `evidence/capacity-finops/README.md` (masih belum menghitung Keycloak dan Residual Risk R2 masih menyebut mock JWT).

Tolong bantu saya melengkapi dan memvalidasi modul 09 secara nyata & terukur:
1. Pandu saya merekam angka utilisasi nyata (`kubectl top nodes`, `kubectl top pods -n default`, `kubectl describe hpa`, `docker stats --no-stream`) ke `evidence/capacity-finops/live-metrics.txt`.
2. Perbarui tabel **Capacity & Headroom Worksheet** di `evidence/capacity-finops/README.md` dengan memasukkan **pod Keycloak** dan hasil pengukuran saya (tandai tegas mana angka *measured* dan mana *assumed*), lalu analisis komponen mana yang *over-provisioned* vs *under-provisioned*.
3. Sesuaikan tabel **Cloud IaaS / CloudStack Mapping** & **Unit-Cost FinOps** (termasuk perbandingan v1 deterministic rule-engine `$0` AI vs proyeksi v2 abstract-only LLM + prinsip *Optimization Without Harming Controls*).
4. Revisi bagian **Residual Risks & Roadmap**: hapus klaim lama "belum pakai Keycloak" dan ganti dengan risiko sisa aktual (PVC RWO single-node, direct access grant & dev passwords Keycloak, DB host.docker.internal & backup manual, local registry tanpa TLS, serta fitur PRD v2 Garage/pg-boss/Groq). Lengkapi 9 field Evidence Standard Guideline 2 §9.
5. Pandu penataan 3 panel untuk `09_evidence.jpg`, draft Bab 10–12 Laporan Akhir, dan jawaban singkat sidang: "Which resource is currently over- or under-provisioned?" dan "What would change when the workload moves from k3d to a real IaaS/CloudStack platform?".
```

---

### PAKET D — Modul `10-decisions-adr/` (`10_evidence.jpg`) + Penyelarasan `01`, `02`, `11` (Bobot 15% + 10% + 2.5%)

#### Apa yang Harus Dibuat & Dibuktikan?
1. **Audit & Sinkronisasi ADR (`10-decisions-adr/10_evidence.jpg`):**
   - Audit silang `decisions/ADR-001` s.d. `ADR-008` terhadap kondisi `main` terbaru.
   - **Revisi `ADR-006`** (hapus klaim *"Keycloak ditolak di v1 / masih mock token"*) dan **buat `decisions/ADR-009-keycloak-oidc-tenant-claim.md`** (keputusan integrasi Keycloak RS256/JWKS, pemisahan external issuer vs internal JWKS URI, claim `tenant_id`, dan penolakan `404` cross-tenant + `403` RBAC).
   - Perbarui matriks di `decisions/README.md` (9 field Evidence Standard) dan ambil screenshot rapi matriks ADR-001..009 sebagai **`10_evidence.jpg`**.
2. **Diagram Visual Arsitektur (`02-architecture/02_evidence.jpg`):**
   - Buat diagram arsitektur visual yang bersih (Mermaid / Draw.io / Excalidraw) yang **sudah memuat Keycloak**, PostgreSQL (`journalfit` + `keycloak`), Traefik Ingress (`journalfit.localhost` & `keycloak.localhost`), Backend 2–3 pod HPA, PVC RWO 1Gi, Argo CD, Prometheus/Grafana, dengan label tegas:
     - **Control Plane vs Data Plane**
     - **Trust Boundaries** (External, JWT/JWKS, Tenant, Secret)
     - **Failure Boundaries**
   - Simpan sumber diagram di `architecture/`, ekspor sebagai **`02_evidence.jpg`**, dan perbarui `evidence/architecture/README.md` (9 field Evidence Standard).
3. **Ringkasan Visual Business Case (`01-business/01_evidence.jpg`):**
   - Ekspor ringkasan visual **Problem, Stakeholders, Core Workflow, Cloud Suitability, Alternatives, & Success Criteria** dari `JournalFit_Konsep_Proyek_M0_M1.docx` & `evidence/business/README.md` menjadi **`01_evidence.jpg`**.
4. **Verifikasi Test Aplikasi & Gladi Bersih Demo (`11-demo-defense/11_evidence.jpg`):**
   - Jalankan `cd source && npm test` (pastikan seluruh test termasuk `auth.test.js` hijau) dan jalankan gladi bersih `bash automation/scripts/e2e-milestone-test.sh` (setelah runtime kluster sinkron) untuk menghasilkan **`11_evidence.jpg`**.
   - Verifikasi kesiapan **13 langkah demo (§13)** dan **12 Bank Pertanyaan Sidang (§13.1)**.
5. **Kontribusi Laporan Akhir:** Draft **Bab 1–3 (Executive Summary, Problem & Cloud Rationale, Architecture)** `final-report.pdf` + `individual-reflections/<nama-anda>.md`.

#### Perintah yang Dijalankan di Git Bash
```bash
# 1. Jalankan seluruh unit & auth tests terbaru di source/
cd source && npm test && cd ..

# 2. Cek daftar file ADR & render matriks ADR
ls -la decisions/

# 3. Gladi bersih End-to-End (setelah stack & kluster sinkron) untuk 11_evidence.jpg
bash automation/scripts/e2e-milestone-test.sh --with-trivy
```

#### Prompt AI Siap Copy-Paste (Paket D — ADR, Architecture, Business & Demo)
```text
Saya memilih Paket D (Modul 10 - Decisions ADR, serta penyelarasan 01-Business, 02-Architecture, dan 11-Demo-Defense) untuk Progress Milestone 2 proyek Capstone Cloud Computing "JournalFit" di branch `main` terbaru (`capstone_cloud_computing`, sudah termasuk Keycloak PR #11 & #12).

Konteks repo saat ini:
- File ADR: `decisions/README.md` dan `decisions/ADR-001`..`ADR-008`.
- Arsitektur & Bisnis: `architecture/index.md`, `evidence/architecture/README.md`, `evidence/business/README.md`.
- Implementasi terbaru: `source/AUTH.md`, `source/src/app.js`, `deployment/*.yaml`, `deployment/keycloak/*.yaml`, `.github/workflows/ci.yaml`, `docker-compose.yml`.
- Demo: `automation/scripts/e2e-milestone-test.sh`, `cloud-capstone-team-7/11-demo-defense/README.md`.

Tolong bantu saya mengerjakan paket ini secara lengkap & faktual (jangan mengklaim fitur PRD yang belum dibangun seperti Garage/pg-boss/Groq; catat di Roadmap saja):
1. Audit silang `decisions/ADR-001`..`ADR-008` terhadap kode `main` terbaru. Revisi `ADR-006` (hapus klaim Keycloak ditolak/mock token) dan buat `decisions/ADR-009-keycloak-oidc-tenant-claim.md` (RS256/JWKS, pemisahan external issuer vs internal JWKS URI, claim `tenant_id`, 404 cross-tenant, 403 RBAC), lalu perbarui matriks di `decisions/README.md` lengkap 9 field Guideline 2 §9 untuk `10_evidence.jpg`.
2. Buatkan diagram visual arsitektur (Mermaid/HTML siap ekspor gambar) untuk `02_evidence.jpg` yang menampilkan **Keycloak**, Backend HPA (UID 10001), PostgreSQL (`journalfit` + `keycloak`), PVC RWO 1Gi, Traefik Ingress, Argo CD, Prometheus/Grafana, dengan batas **Control Plane vs Data Plane**, **Trust Boundaries**, dan **Failure Boundaries**.
3. Buatkan ringkasan visual rapi untuk `01_evidence.jpg` dari `evidence/business/README.md` (Problem, Stakeholders, Workflow, Cloud Rationale, Success Metrics).
4. Pandu saya menjalankan `cd source && npm test` dan `bash automation/scripts/e2e-milestone-test.sh` untuk `11_evidence.jpg`, serta siapkan draft Bab 1–3 Laporan Akhir dan ringkasan jawaban 12 Bank Pertanyaan Sidang (Guideline 2 §13.1).
```

---

## 4. Pengumpulan Hasil & Checklist Final Gate

Setelah masing-masing anggota menyelesaikan paket pilihannya:

1. **Simpan gambar bukti** sesuai nama kanonik di `cloud-capstone-team-7/`:
   - Pemegang Paket A → `06-security/06_evidence.jpg` + `evidence/security/README.md` & log mentah
   - Pemegang Paket B → `08-reliability-recovery/08_evidence.jpg` + `evidence/reliability-recovery/README.md` & log mentah
   - Pemegang Paket C → `09-capacity-finops/09_evidence.jpg` + `evidence/capacity-finops/README.md` & `live-metrics.txt`
   - Pemegang Paket D → `10-decisions-adr/10_evidence.jpg`, `01-business/01_evidence.jpg`, `02-architecture/02_evidence.jpg`, `11-demo-defense/11_evidence.jpg` + update ADR/README
2. **Push kode, manifest, log teks, dan dokumen `.md`** ke feature branch masing-masing, lalu buka **Pull Request ke `main`** (jangan commit file gambar berat jika tidak disepakati, dan jangan pernah commit `.env`/secret).
3. **Checklist Final Acceptance (Guideline 2 §14.2 & §16):**
   - [ ] Semua 11 gambar `01_evidence.jpg` s.d. `11_evidence.jpg` lengkap & jelas terbaca.
   - [ ] Semua `README.md` bukti memuat 9 field **Evidence Standard** dengan versi/timestamp nyata.
   - [ ] Seluruh dokumen konsisten bahwa **Keycloak OIDC/JWT aktif** dan fitur PRD v2 dicatat jujur sebagai roadmap.
   - [ ] Tidak ada kredensial/secret nyata di Git (`git grep` bersih).
   - [ ] **4 file refleksi pribadi** terisi di `individual-reflections/<nama-anda>.md` (kontribusi, pembelajaran teknis, 1 keputusan/perbedaan desain, rencana perbaikan).
   - [ ] **`final-report.pdf`** terkompilasi (12 bab sesuai Guideline 2 §15.1) dan seluruh anggota siap menjawab acak **12 Bank Pertanyaan Sidang (§13.1)**.
