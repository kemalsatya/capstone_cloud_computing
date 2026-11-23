# Evidence 05: CI/CD & GitOps Delivery Pipeline

**Scope**: Otomasi pengiriman aplikasi (*delivery automation*), verifikasi kode otomatis di CI, pembuatan *immutable container artifact* (tag SHA-7), sinkronisasi GitOps Argo CD, dan pengujian *rollback* rilis.  
**Owner**: Anggota 3 (Liaurentino)  
**Source / Commit**: `main` (`2dc3593` / riwayat rilis `a8923ea`)  
**Timestamp**: 2026-11-10T14:45:00+07:00 (Diselaraskan: 2026-11-22)  

---

## 1. Standar Evidence (Guideline 2 Section 9)

| Field | Detail |
| :--- | :--- |
| **Scope** | Pipeline CI otomatis (GitHub Actions / Gitea), pembangunan image immutable bertag SHA-7, sinkronisasi GitOps Argo CD, serta pengujian rollback rilis. |
| **Owner** | Anggota 3 (Liaurentino) |
| **Source / Version** | `.github/workflows/ci.yaml`, `.gitea/workflows/ci.yml`, `automation/argocd/application.yaml`, `automation/scripts/build-and-tag.sh`, `automation/scripts/simulate-rollback.sh`. |
| **Timestamp** | 2026-11-10 s.d. 2026-11-22 |
| **Method** | (1) Trigger CI pipeline (`npm test` + Trivy scan); (2) Build & push image bertag SHA-7 via `build-and-tag.sh`; (3) Sinkronisasi aplikasi di Argo CD (`Synced & Healthy`); (4) Kasus uji rollback rilis via `bash automation/scripts/simulate-rollback.sh`. |
| **Observation** | Seluruh job CI lulus (`0 fail`), image tertag unik 7-karakter commit SHA (`a8923ea` / `2dc3593`), Argo CD menyinkronkan seluruh resource Kubernetes dengan status `Synced & Healthy`, dan skrip `simulate-rollback.sh` berhasil mengembalikan revisi deployment tanpa pod error. |
| **Interpretation** | Terjadi pemisahan kontrol penuh antara CI (pembuat artefak teruji) dan CD (deployment terkontrol via Argo CD); jika terjadi masalah rilis, sistem dapat dikembalikan (*rollback*) ke revisi sebelumnya secara aman. |
| **Limitation** | Pipeline GitHub Actions berjalan di cloud runner sementara kluster `k3d-capstone` dan registry OCI lokal (`:5001`) berjalan di mesin host lokal. |
| **Decision Supported** | Mendukung **ADR-004** (GitOps Argo CD & Immutable SHA-7 Tag). |

---

## 2. Komponen Bukti Visual (4 Panel Komposit: `05_evidence.jpg`)

| Panel | Kategori | Deskripsi Bukti & Pengamatan |
| :--- | :--- | :--- |
| **Panel 1** | **GitHub Actions CI** | Workflow `Capstone CI Pipeline` berjalan otomatis saat push/PR. Job `Node.js Test & Sanity Verification` lulus 100%, disusul job `Build Immutable Container & Scan` (Trivy scan lulus dengan exit code 0). |
| **Panel 2** | **Immutable Container Artifact** | Eksekusi `automation/scripts/build-and-tag.sh` membangun image `journalfit-backend` dengan tag commit SHA 7-karakter dan mendaftarkannya ke registry lokal `localhost:5001`. |
| **Panel 3** | **Argo CD GitOps Dashboard** | Antarmuka Argo CD memverifikasi aplikasi `journalfit-backend` berstatus **Synced** dan **Healthy** (2 Pods ready, ConfigMap, PVC, Service, Deployment, Ingress, HPA aktif). |
| **Panel 4** | **Kasus Testing: Simulasi Rollback** | Eksekusi `bash automation/scripts/simulate-rollback.sh` mengecek riwayat revisi dan menjalankan `kubectl rollout undo` ke revisi sebelumnya tanpa menyebabkan downtime pada pod yang aktif. |

---

## 3. Kasus Testing Evidence 05 (Simulasi Rollback Rilis)

Kasus testing untuk modul CI/CD & Delivery menggunakan skrip sederhana **1 perintah** yang sudah tersedia di [`automation/scripts/simulate-rollback.sh`](../../automation/scripts/simulate-rollback.sh) (dan sudah tercetak pada **Panel 4 `05_evidence.jpg`** / [`rollback-simulation.png`](./rollback-simulation.png)):

```bash
bash automation/scripts/simulate-rollback.sh
```

- **Skenario Uji:** Menguji pemulihan rilis (*release rollback*) apabila versi deployment yang baru dinaikkan perlu dikembalikan ke revisi sebelumnya.
- **Langkah di Dalam Skrip:**
  1. Cek status rollout aktif (`kubectl rollout status deployment/journalfit-backend`).
  2. Cek daftar riwayat revisi (`kubectl rollout history deployment/journalfit-backend`).
  3. Kembalikan deployment ke revisi sebelumnya (`kubectl rollout undo deployment/journalfit-backend`).
  4. Pastikan kedua pod tetap berstatus `Running` & `Ready` (`kubectl get pods -l app=journalfit -o wide`).
- **Hasil Uji:** **`PASS`** — Deployment berhasil di-rollback ke revisi stabil sebelumnya tanpa ada pod yang crash atau layanan terputus.
