# 11 - Panduan Demo End-to-End, Automation & Verifikasi per Evidence (Demo 11)

**Milestone:** FINAL — End-to-End Demo Script, Automation & Technical Defense (Bobot Rubrik: 2.5%)  
**Penanggung Jawab:** Seluruh Anggota Tim 7 (JournalFit)  
**Artefak Bukti:** [`11_evidence.jpg`](./11_evidence.jpg) & [`e2e-live-run.txt`](./e2e-live-run.txt)

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Penjelasan Demo 11 terintegrasi (M0–M7), panduan menjalankan seluruh automation end-to-end (`e2e-milestone-test.sh` & `run-milestone-tests.sh`), panduan verifikasi masing-masing evidence (`01`–`11`), serta 12 Bank Pertanyaan Technical Defense (§13.1). |
| **Owner** | Seluruh Anggota Tim 7 (Anggota 1–4). |
| **Source / Version** | `automation/scripts/e2e-milestone-test.sh`, `automation/scripts/tests/run-milestone-tests.sh`, `source/tests/*.test.js`, `deployment/kustomization.yaml` (`newTag: 0c2cf92`), commit `main` (`7e8607b`). |
| **Timestamp** | Eksekusi live terbaru: 2026-11-23 18:55 WIB (`Asia/Jakarta`) |
| **Method** | Eksekusi otomatis `e2e-milestone-test.sh --with-trivy` pada stack aktif (PostgreSQL 17, Keycloak 26.8.2, Express 5, `worker-format` `pg-boss`, `k3d-capstone`, Local OCI Registry `:5001`, Argo CD, Prometheus `:9090`, Grafana `:3000`, Trivy) dan `run-milestone-tests.sh all --allow-pending`. |
| **Observation** | Live E2E selesai dengan **`PASS: 76 | FAIL: 0 | SKIP: 3`**: 63/64 unit/OOXML/worker/JWT tests lulus, Docker non-root & push registry (`7e8607b`/`0c2cf92`) sukses, rollout K8s & Ingress `/health/ready` + `/metrics` HTTP 200, Trivy scan selesai, uji keamanan Keycloak (`401`/`404`/`403`/`X-Tenant-ID` diabaikan) lulus, SLO 20/20 HTTP 200, Prometheus & Grafana sehat, serta backup & isolated restore DB pulih 15 baris. |
| **Interpretation** | Seluruh modul cloud-native (aplikasi, platform K8s, GitOps, keamanan, observability, dan recovery) terbukti berjalan sinkron secara end-to-end dan reproducible dari satu skrip terpadu maupun per modul. |
| **Limitation** | 3 item berstatus `SKIP` pada run ini karena cold start Keycloak K8s (~72s) dan transisi health Argo CD; PVC `1Gi local-path` RWO terikat 1 node (`k3d-capstone-agent-0`); fitur PRD v2 (Garage S3 & Groq AI scope checker) belum diimplementasikan di v1. |
| **Decision Supported** | Membuktikan kesiapan runtime menyeluruh untuk sidang akhir dan memvalidasi seluruh `ADR-001` s.d. `ADR-009`. |

---

## 2. Penjelasan Demo 11 & Baseline Platform

**Demo 11** adalah tahap verifikasi dan demonstrasi terpadu yang menguji ulang seluruh evidence (`01` s.d. `10`) dalam satu alur kerja nyata di atas kluster hidup:
- **Platform Baseline Terverifikasi:** `DB_HOST=host.docker.internal` (teruji di Docker Desktop Windows), `node:22-alpine` non-root `UID 10001` (`drop ALL`), `HPA 2→3→2` (teruji 19.865 request, 0 gagal), rolling update (`777` request, `0` gagal, p95 `26,73 ms`, rollout `22,53 detik`), controlled pod deletion (`7,1 detik` self-healing, SHA-256 PVC identik), serta isolated DB restore (`0,78 detik` untuk `journalfit` 6 tabel + `101` tabel `keycloak`).
- **Batas Klaim Jujur:** Storage PVC `ReadWriteOnce` single-node bukan multi-AZ HA; baseline resource lab bukan optimasi produksi penuh; `.env`, kredensial nyata, dan secret tidak pernah disimpan di Git.

---

## 3. Cara Pakai Automation Semua Sekaligus (Full E2E + Post-Evidence)

### Prasyarat
1. **Docker Desktop** menyala (`docker info` berhasil).
2. **Port `8000` bebas** di host (cek: `netstat -ano | findstr :8000`).
3. Tool tersedia: `git`, `node` (v22), `docker`, `curl`, `kubectl`, `k3d`, `python`, dan Git Bash (`C:\Program Files\Git\bin\bash.exe`).

### A. Jalankan Semua Tahap Live E2E (M0–M7 + Trivy)
Jalankan dari Windows Command Prompt (`cmd.exe`):

```bat
cd /d "C:\Users\liaur\Documents\Tugas-Tugas Kuliah\Semester Ganjil\Semester 5\CloudComputing\Project CloudComputing\capstone_cloud_computing"
"C:\Program Files\Git\bin\bash.exe" automation/scripts/e2e-milestone-test.sh --with-trivy
```

**Opsi Flag yang Didukung:**
- `--with-trivy` : aktifkan pemindaian kerentanan image (`HIGH,CRITICAL`).
- `--skip-k8s` : lewati sinkronisasi & verifikasi live kluster `k3d`.
- `--skip-argocd` : lewati instalasi/cek Argo CD.
- `--skip-observability` : lewati aktivasi Prometheus & Grafana.
- `--keep-backup` : simpan berkas `.sql` hasil uji backup.
- `--cleanup` : matikan stack Docker Compose otomatis setelah selesai.

### B. Jalankan Semua Pengujian Operasional & Verifikasi Per Milestone (`01`–`11`)
```bat
"C:\Program Files\Git\bin\bash.exe" automation/scripts/tests/run-milestone-tests.sh all --allow-pending
```

---

## 4. Cara Pakai Masing-Masing per Evidence (`01` s.d. `11`)

Jalankan dari root repo `capstone_cloud_computing`:

| Evidence | Perintah Verifikasi / Pengujian Live per Modul | Hasil yang Diharapkan |
| :--- | :--- | :--- |
| **`01-business`** | `bash automation/scripts/tests/test-milestone-01-business.sh` | **6/6 PASS** (9-field README, `01_evidence.jpg`, ArchiMate Motivation/Strategy/Business, jujur Roadmap v2). |
| **`02-architecture`** | `bash automation/scripts/tests/test-milestone-02-architecture.sh` | **6/6 PASS** (`journalfit-architecture.archimate` 4 views valid XML + 4 PNG capture murni Archi + `02_evidence.jpg`). |
| **`03-application-data`** | `bash automation/scripts/tests/test-milestone-03-application-data.sh` | Live `npm test` (**63/64 PASS**), live `/health/ready`, & live `psql \dt` 6 tabel inti PostgreSQL. |
| **`04-platform-kubernetes`** | `bash automation/scripts/tests/test-milestone-04-platform-k8s.sh` | Live `kubectl kustomize`, `kubectl get deploy,pods,svc,ingress,pvc,hpa`, & live Traefik Ingress `:8088` HTTP 200. |
| **`05-ci-cd-gitops`** | `bash automation/scripts/tests/test-milestone-05-cicd-gitops.sh` | Cek immutable SHA-7 (`0c2cf92`), live registry `:5001`, live status Argo CD, & workflow CI Trivy. |
| **`06-security`** | `bash automation/scripts/tests/test-milestone-06-security.sh --with-trivy` | Live Keycloak JWT, `401` tanpa/bad token, `404` lintas-tenant (`author.b -> ms-001`), `403` RBAC, `X-Tenant-ID` diabaikan, & live Trivy scan. |
| **`07-observability-slo`** | `bash automation/scripts/tests/test-milestone-07-observability.sh` | Live scrape `/metrics`, 10-req SLO latency probe, live Prometheus `:9090` & Grafana `:3000`. |
| **`08-reliability-recovery`** | `bash automation/scripts/tests/test-milestone-08-reliability.sh` | Live `pg_dump` backup & isolated DB restore drill + K8s pod readiness + bukti `7,1s` / `0,78s` / `0` fail. |
| **`09-capacity-finops`** | `bash automation/scripts/tests/test-milestone-09-capacity-finops.sh` | Live `docker stats` & `kubectl top pods`, cek resource requests/limits di manifest `deployment/`. |
| **`10-decisions-adr`** | `bash automation/scripts/tests/test-milestone-10-adr.sh` | **11/11 PASS** (`9/9 ADR` conformance terhadap kode/manifest/CI + 9-field README + `10_evidence.jpg`). |
| **`11-demo-defense`** | `bash automation/scripts/tests/test-milestone-11-demo.sh` | Live `doctor.sh`, ping semua endpoint demo, 12 Q&A §13.1, & bukti `e2e-live-run.txt` / `11_evidence.jpg`. |

---

## 5. Bank Pertanyaan Technical Defense (Guideline 2 Section 13.1)

| Pertanyaan Penguji | Jawaban Teknis Tim 7 (Sinkron `7e8607b`) | Penjawab Utama |
| :--- | :--- | :--- |
| **1. Why is this workload cloud-suitable rather than simply hosted?** | Multi-tenancy antar jurnal (`tenant_id`), elastisitas trafik lonjakan *deadline* via HPA (2–3 pod) + antrean asinkron `pg-boss`, & portabilitas OCI/Kustomize ke CloudStack/Public Cloud. | Anggota 1 |
| **2. Control plane vs data plane?** | Control plane: GitHub Actions CI, OCI Registry (`:5001` / `registry:5000`), Argo CD Controller, & k3s master. Data plane: Traefik Ingress (`:8088`), Keycloak OIDC pod, Backend Express pods, `worker-format`, PVC, & PostgreSQL. | Anggota 3 |
| **3. What happens if one application pod is deleted?** | Traffic segera diarahkan ke pod kedua via Service/Readiness Probe, ReplicaSet menumbuhkan pod baru dalam **7,1 detik** (`08_evidence`, 0 request gagal), dan file `.docx` tetap aman di PVC bersama (SHA-256 identik). | Anggota 2 |
| **4. What does your readiness probe protect against?** | Mencegah Traefik/Service mengirim request ke pod saat startup atau ketika koneksi ke PostgreSQL/queue terputus (`/health/ready` mengembalikan 503). | Anggota 2 |
| **5. Where is configuration stored and why?** | Non-secret di `ConfigMap` (`PORT`, `DB_HOST`, `AUTH_MODE`, `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URI`); kredensial sensitif di `Kubernetes Secret` (`journalfit-backend-secret`, `keycloak-db-secret`, `keycloak-admin-secret`), terpisah dari Git. | Anggota 3 / 4 |
| **6. Which secret would be most damaging if leaked?** | `DB_PASSWORD` / `KC_DB_PASSWORD` (kredensial PostgreSQL) & `KC_BOOTSTRAP_ADMIN_PASSWORD` (admin Keycloak), karena membuka akses penuh lintas-tenant di database atau kemampuan menerbitkan/memanipulasi identitas & role user. | Anggota 4 |
| **7. How do you prove tenant or role isolation?** | Melalui negative tests JWT Keycloak aktual: tanpa/bad token -> `401`, `author.b` (`tenant-b`) akses `ms-001` (`tenant-a`) -> `404 NOT_FOUND` (anti-enumerasi), `editor.a` memanggil endpoint upload (`author`-only) -> `403 FORBIDDEN`, dan header palsu `X-Tenant-ID` diabaikan total. | Anggota 1 / 4 |
| **8. What does your scan prove and what does it not prove?** | Trivy membuktikan tidak ada CVE `HIGH/CRITICAL` OS/npm terdeteksi di image build; namun **tidak** menjamin bebas bug logika bisnis, salah konfigurasi runtime/Keycloak, atau zero-day yang belum masuk database CVE. | Anggota 4 / 3 |
| **9. What is your most useful service signal and why?** | Gabungan HTTP Error Rate `5xx` & Latensi `p95` (`/metrics` API `:8000` & Worker `:9101`), karena lonjakan error/latensi langsung menandakan masalah koneksi DB, kegagalan JWKS, atau kejenuhan CPU sebelum pod crash. | Anggota 4 |
| **10. Recovery target and was it actually tested?** | Target RTO `< 5 menit`. Sudah diuji nyata (`08_evidence`): restore `pg_dump` ke DB validasi terisolasi (`journalfit_restore_test`) selesai dalam **0,78 detik** (6 tabel identik) + DB `keycloak` (**101 tabel** identik). | Anggota 4 |
| **11. Which resource is currently over- or under-provisioned?** | CPU backend saat idle (~1% dari target 70% HPA) punya *headroom* longgar untuk lonjakan parsing `.docx`, sedangkan pod Keycloak (`~596 MiB` saat cold start 72s dari limit `1Gi`) merupakan konsumen memori terbesar yang perlu sizing khusus saat migrasi cloud. | Anggota 2 / 4 |
| **12. What changes when moving from k3d to real IaaS/private cloud?** | Ganti PostgreSQL `host.docker.internal` ke Managed DB, ganti PVC `local-path` RWO ke Object Storage S3/MinIO atau RWX storage multi-AZ, aktifkan HTTPS/TLS pada Ingress, ganti Keycloak Direct Access Grant menjadi Authorization Code + PKCE, dan gunakan container registry privat terautentikasi. | Anggota 2 / 3 |
