# Evidence 05: CI/CD & GitOps Delivery Pipeline

**Scope**: Otomasi pengiriman aplikasi (delivery automation), verifikasi kode, pembuatan immutable container artifact, sinkronisasi GitOps Argo CD, dan pengujian rollback.  
**Owner**: Anggota 3 (Liaurentino)  
**Source / Commit**: `milestone-per-week` (`a8923ea`)  
**Timestamp**: 2026-11-10T14:45:00+07:00  

---

## 1. Komponen Bukti (4 Panel Komposit: `05_evidence.jpg`)

| Panel | Kategori | Deskripsi Bukti & Pengamatan |
| :--- | :--- | :--- |
| **Panel 1** | **GitHub Actions CI** | Workflow `Capstone CI Pipeline` berjalan otomatis di PR #8. Job `Node.js Test & Sanity Verification` lulus 100% (10 tests pass), disusul job `Build Immutable Container & Scan` (Trivy scan lulus dengan exit code 0). |
| **Panel 2** | **Immutable Container Artifact** | Eksekusi `automation/scripts/build-and-tag.sh` membangun image `journalfit-backend` dengan tag commit SHA 7-karakter `a8923ea` dan mendaftarkannya ke registry lokal `localhost:5001`. |
| **Panel 3** | **Argo CD GitOps Dashboard** | Antarmuka Argo CD v3.5.6 memverifikasi aplikasi `journalfit-backend` berstatus **Synced** ke commit `a8923ea` dan **Healthy** (2 Pods ready, ConfigMap, PVC, Service, Deployment, Ingress, HPA aktif). |
| **Panel 4** | **Simulasi Rollback** | Eksekusi `automation/scripts/simulate-rollback.sh` memvalidasi status rollout, memeriksa riwayat revisi, dan menangani rollback tanpa menyebabkan kegagalan layanan pada pod yang aktif. |

---

## 2. Standard Capstone Interpretation (Bab 9 & 14 Rubrik)

* **Observation**: Perubahan kode sumber yang di-push ke remote secara deterministik memicu verifikasi tes otomatis, menghasilkan artefak container immutable berlabel SHA, tersinkronisasi otomatis ke kluster Kubernetes k3d melalui Argo CD, dan menjaga status pod tetap sehat tanpa intervensi `kubectl` manual.
* **Interpretation**: Pemisahan kontrol antara CI (pembuat artefak) dan CD (rekonsiliasi GitOps) tercapai penuh. Tidak ada image mengambang (`latest` tanpa versi), dan konfigurasi runtime selalu merefleksikan git repository.
* **Limitation**: Runner CI GitHub Actions melakukan build & scan di cloud hosted runner, sementara publikasi image registry dan kluster k3d dieksekusi di runner infrastruktur lokal laptop mahasiswa.
* **Decision Supported**: Menerapkan GitOps berbasis Argo CD sebagai standar rilis tunggal dan mengabaikan intervensi manual pada kluster produksi.
