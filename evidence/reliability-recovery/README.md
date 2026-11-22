# 08 - Reliability & Disaster Recovery

**Milestone:** M7 — Reliability & Recovery (Bobot Rubrik: 7.5%)  
**Penanggung Jawab:** Muhammad Rafi Agastya (Paket B)  
**Berkas Bukti Target:** `08_evidence.jpg`

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Pengujian keandalan workload Kubernetes (*controlled pod failure*, *self-healing*, persistensi PVC `/app/uploads`, *rolling update* tanpa kegagalan) serta verifikasi *backup* dan *isolated restore* basis data PostgreSQL (`journalfit` dan `keycloak`) beserta pengukuran RTO aktual. |
| **Owner** | Muhammad Rafi Agastya (Paket B — Reliability & Recovery), berkoordinasi dengan baseline platform (Anggota 2) dan skrip recovery (Anggota 4). |
| **Source / Version** | Repositori `capstone_cloud_computing`, image `registry:5000/journalfit-backend:2dc3593`, Keycloak `quay.io/keycloak/keycloak:26.8.2`, PostgreSQL `17-alpine`, kluster `k3d-capstone` (`namespace: default`). |
| **Timestamp** | 2026-11-23T05:24:59+07:00 s.d. 2026-11-23T05:54:00+07:00 (Asia/Jakarta) |
| **Method** | (1) Menulis berkas uji ke PVC `/app/uploads/evidence-08-test.txt`, menghapus 1 pod backend secara paksa (`kubectl delete pod --wait=false`), memantau ketersediaan `/health/ready` via Service selama pemulihan, dan membandingkan checksum SHA-256 pada pod pengganti. (2) Meninjau log *rolling update* (`rolling-update-result.json`). (3) Mengeksekusi `automation/scripts/db-backup-restore.sh backup` dan merestore ke database terisolasi (`journalfit_restore_test` dan `keycloak_restore_test`) sambil mengukur durasi RTO dengan stopwatch presisi tinggi. |
| **Observation** | (1) Penghapusan pod `journalfit-backend-56657c6848-q4d9k` memicu ReplicaSet menumbuhkan pod pengganti `journalfit-backend-56657c6848-5qhjf` hingga `1/1 Running` dalam **7,1 detik**, sementara `/health/ready` tetap merespons `HTTP/1.1 200 OK` di setiap interval dan checksum SHA-256 berkas PVC tetap identik (`118046d796143615d91b098e6bdc9c3cd532a57900e7e9849880b580f0bee40f`). (2) Uji *rolling update* mencatat **777 request, 0 gagal**, latensi p95 **26,73 ms** (durasi rollout 22,53 detik). (3) Backup DB `journalfit` menghasilkan berkas `9.961 bytes` dan restore ke `journalfit_restore_test` selesai dalam **RTO aktual 0,78 detik (780 ms)** dengan 6 tabel dan seluruh jumlah baris (`check_results=1`, `findings=2`, `format_rule_templates=2`, `manuscripts=1`, `tenants=2`, `users=2`) cocok 100%. (4) Backup DB `keycloak` (`400.846 bytes`) dan restore ke `keycloak_restore_test` mencocokkan seluruh **101 tabel** publik secara identik. |
| **Interpretation** | Mekanisme *self-healing* Kubernetes, strategi rollout `maxUnavailable: 0`, dan persistensi PVC berjalan efektif menjaga ketersediaan layanan saat terjadi kegagalan pod tunggal. Prosedur pemulihan basis data aplikasi maupun identitas (Keycloak) terbukti dapat dieksekusi ulang secara deterministik dengan RTO **0,78 detik**, jauh lebih cepat daripada target SLO `< 300 detik` (5 menit). |
| **Limitation** | (1) PVC `journalfit-uploads` menggunakan mode `ReadWriteOnce` (`local-path`) pada kluster single-node `k3d`, sehingga membuktikan persistensi antar-pod pada node yang sama, bukan ketersediaan lintas node/AZ. (2) Proses backup saat ini masih dijalankan secara manual melalui skrip CLI (`db-backup-restore.sh`), belum terjadwal otomatis via Kubernetes `CronJob` maupun tersimpan ke *off-site object storage*. (3) Pengujian kegagalan dilakukan melalui *controlled pod deletion*, bukan simulasi kegagalan node fisik atau pemadaman host. |
| **Decision Supported** | Mendukung **ADR-005** (penggunaan PVC RWO + node pinning untuk persistensi dokumen di v1) dan **ADR-008** (strategi `pg_dump` dengan verifikasi restore terisolasi untuk memenuhi target RTO < 5 menit). |

---

## 2. Ringkasan Metrik Pengujian Aktual

### Panel 1 — Kubernetes Reliability & Self-Healing
* **Pod Dihapus (Victim):** `journalfit-backend-56657c6848-q4d9k`
* **Pod Pengganti (Replacement):** `journalfit-backend-56657c6848-5qhjf` (`1/1 Running`)
* **Waktu Pemulihan Pod (Self-Healing):** `7,1 detik`
* **Ketersediaan Service Selama Kegagalan:** `/health/ready` konsisten `HTTP/1.1 200 OK`
* **Checksum SHA-256 PVC (`/app/uploads/evidence-08-test.txt`):**
  * Sebelum: `118046d796143615d91b098e6bdc9c3cd532a57900e7e9849880b580f0bee40f`
  * Sesudah: `118046d796143615d91b098e6bdc9c3cd532a57900e7e9849880b580f0bee40f` (Cocok 100%)
* **Rolling Update Benchmark (`evidence/platform/rolling-update-result.json`):** `777` requests, `0` failed, p95 latency `26,73 ms`, rollout `22,53 detik`.

### Panel 2 — Database Backup & Isolated Recovery
* **Backup `journalfit`:** `backup_journalfit_20261123_052459.sql` (`9.961 bytes`)
* **RTO Restore Aktual (`journalfit` → `journalfit_restore_test`):** `780 ms` (`0,78 detik`) — **PASS** (Target SLO `< 300 detik`)
* **Integritas Data `journalfit` (6 Tabel):** `tenants` (2), `users` (2), `format_rule_templates` (2), `manuscripts` (1), `check_results` (1), `findings` (2) — **100% Identik**
* **Backup & Restore `keycloak`:** `backup_keycloak_20261123_052900.sql` (`400.846 bytes`) → `keycloak_restore_test` (`101 tabel` publik) — **100% Identik**