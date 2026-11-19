# 08 - Reliability & Disaster Recovery

**Milestone:** M7 — Reliability & Recovery (Bobot Rubrik: 7.5%)  
**Penanggung Jawab Utama (Lead):** Anggota 4  
**Pendukung Teknis:** Anggota 2 (Kubernetes Pod Failure / Rolling Update Test)  
**Berkas Bukti Target:** `08_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Uji ketahanan beban kerja Kubernetes (*pod deletion self-healing*, *rolling update zero-downtime*), persistensi berkas unggahan pada PVC, dan pembuktian backup serta *actual restore* database PostgreSQL 17. |
| **Owner** | Anggota 4 (Eksekusi `db-backup-restore.sh`, verifikasi data restore, pengukuran RTO), Anggota 2 (Controlled pod termination, checksum SHA-256 PVC, & rolling update traffic test). |
| **Source / Version** | `automation/scripts/db-backup-restore.sh`, `deployment/deployment.yaml`, `deployment/pvc.yaml`, `pod-replacement-persistence.txt`, `rolling-update-result.json`, `restore-proof.txt`. |
| **Timestamp** | Uji Pod/Rolling Update: 2026-11-10 \| Uji Restore Validasi: 2026-11-10 s.d. 2026-11-18 |
| **Method** | (1) `kubectl delete pod` saat melayani 2 replika lalu cek rollout & SHA-256 file `/app/uploads`; (2) `rolling-update` dengan 3 HTTP workers (777 requests); (3) `pg_dump` -> `CREATE DATABASE` validasi terisolasi -> `psql` restore & query `SELECT COUNT(*)`. |
| **Observation** | Pod pengganti aktif otomatis (`Ready`) dalam ~32.5 detik dengan UID baru dan checksum SHA-256 berkas `.docx` identik; rolling update 777 request mencatat `failed_requests: 0` (latensi p95 `26.73 ms`); restore database 6 tabel sukses dalam **1.41 detik**. |
| **Interpretation** | Sistem terbukti memiliki mekanisme *self-healing* nyata pada level kontainer dan kapabilitas pemulihan data yang teruji (bukan sekadar klaim teori). |
| **Limitation** | (1) Uji pod failure & PVC masih pada satu worker node (`k3d-capstone-agent-0`) karena sifat RWO `local-path`, sehingga belum menguji kegagalan node total; (2) Backup PostgreSQL masih memicu skrip manual/cron lokal, belum terjadwal otomatis ke object storage jarak jauh. |
| **Decision Supported** | Mendukung **ADR-005** (PVC RWO + `Prune=false`) dan **ADR-008** (prosedur restore ke validation DB terisolasi). |

---

## 2. Pembagian Tugas Anggota & Checklist Eksekusi

| Sub-Tugas | Pemilik | Deskripsi & Langkah Eksekusi |
| :--- | :--- | :--- |
| **8.1 Controlled Pod Failure & Self-Healing** | Anggota 2 | Menghapus 1 pod aktif (`kubectl delete pod <nama-pod>`), memverifikasi ReplicaSet langsung menciptakan pod baru, dan membandingkan checksum SHA-256 file `.docx` pada PVC sebelum dan sesudah pod mati (`pod-replacement-persistence.txt`). |
| **8.2 Zero-Downtime Rolling Update** | Anggota 2 | Memvalidasi strategi `maxUnavailable: 0, maxSurge: 1` pada `deployment.yaml` sambil mengirim trafik HTTP konstan (`rolling-update-result.json`: 777 requests, `failed_requests: 0`). |
| **8.3 Actual DB Backup & Restore Verification** | Anggota 4 | Menjalankan `bash automation/scripts/db-backup-restore.sh backup`, membuat database validasi (`journalfit_restore_test`), merestore file `.sql`, dan membuktikan 6 tabel serta baris tabel `manuscripts` cocok, lalu mengukur durasi (RTO). |

---

## 3. Rekapitulasi Bukti Operasional Nyata

### A. Self-Healing & Persistensi Pod (`pod-replacement-persistence.txt`)
- **Kondisi Awal:** 2 pod aktif (`...-fjhdn` dan `...-pjtkd`), file `ms-a5430ef1-Panduan_Eksekusi_Capstone_JournalFit_v2.docx` di PVC memiliki hash:
  `ab93dff100416e06235c16f297d8d53b61e7b9c95bfd444f22e572fef2b8d753`
- **Aksi Injeksi Kegagalan:** `kubectl --context k3d-capstone -n capstone delete pod journalfit-backend-65fb8cb7d-fjhdn`
- **Hasil Pengamatan:**
  - Kubernetes otomatis menumbuhkan pod baru (`...-tkpbl`, UID `aceebf46-30f7-4e4d-8e87-2d6935d76758`) dan meluluskan readiness probe dalam **32.5 detik**.
  - Hash SHA-256 berkas di dalam pod baru **tetap identik** dan `GET /api/manuscripts/ms-a5430ef1/report` tetap merespons `HTTP 200`.

### B. Rolling Update Tanpa Kegagalan Request (`rolling-update-result.json`)
- **Konfigurasi:** `maxUnavailable: 0`, `maxSurge: 1`, `readinessProbe: /health/ready`
- **Metrik Trafik (31.58 detik selama pergantian pod):**
  - Total Requests: **777**
  - Failed Requests: **0** (100% sukses)
  - Latensi p95: **26.73 ms**

### C. Backup & Actual Restore Database (`restore-proof.txt` & `slo-sli.md`)
- **Target RPO/RTO Tim:**
  - **Target RTO (Recovery Time Objective):** `< 5 menit` (300 detik) untuk pemulihan skema dan data SQL.
  - **Target RPO (Recovery Point Objective):** `24 jam` (berbasis snapshot dump harian pada arsitektur v1).
- **Hasil Uji Nyata:**
  - Seluruh **6 tabel** (`tenants`, `users`, `format_rule_templates`, `manuscripts`, `check_results`, `findings`) berhasil dipulihkan pada database terpisah (`capstone_restore_validation` / `journalfit_restore_test`).
  - Jumlah baris `manuscripts` terverifikasi cocok dengan database sumber.
  - Waktu eksekusi restore aktual: **1,41 detik** (memenuhi target SLO `< 5 menit`).

---

## 4. Panduan Pengambilan Screenshot `08_evidence.jpg` (Tugas Anggota 4 & Anggota 2)

Jalankan perintah otomasi berikut di Git Bash / WSL pada root repositori `capstone_cloud_computing` (pastikan Docker Desktop & k3d menyala):
```bash
bash automation/scripts/capture-evidence-06-08-09-10.sh 08
```
**Susun menjadi 2 panel pada `08_evidence.jpg`:**
1. **Panel 1 (Kiri - Kubernetes Self-Healing & Rolling Update):** Tangkapan layar terminal saat menjalankan penghapusan 1 pod -> kemunculan pod pengganti berstatus `Running 1/1 Ready`, plus ringkasan hasil uji rolling update (`777 requests, 0 failed`).
2. **Panel 2 (Kanan - Database Backup & Restore Proof):** Tangkapan layar terminal eksekusi `db-backup-restore.sh backup`, ukuran file `.sql` yang terbentuk, proses restore ke database validasi, tabel hasil `SELECT COUNT(*) FROM manuscripts`, serta waktu tempuh (`time`) eksekusi (~1.4s).
