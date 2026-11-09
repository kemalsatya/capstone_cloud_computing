# JournalFit - Roadmap Platform & Kubernetes

**Status keseluruhan:** BELUM SELESAI

Checklist ini diperbarui setelah setiap poin terverifikasi. `[x]` berarti selesai; `[ ]` berarti belum selesai.

**Pembaruan terakhir:** 2026-11-09 (Asia/Jakarta)

**Branch kerja:** feat/k8s-manifests

**Baseline source:** 747c958 (Express/Node.js, port 8000)

**Lab:** C:\cloud-capstone\Cloud_Computing_Common_Capstone_Infrastructure_Package


## 0. PERSIAPAN LAB

**Status tahap: SELESAI.** Layanan inti juga sudah dinyalakan dan diperiksa (D.1).

- [x] 0.1 Periksa repository; pisahkan pekerjaan pada feature branch.
- [x] 0.2 Ekstrak paket di luar repository tanpa menimpa folder yang ada.
- [x] 0.3 Verifikasi 62 file hasil ekstraksi terhadap isi ZIP (0 perbedaan).
- [x] 0.4 Baca skrip doctor, common, up-core dan konfigurasi Compose.
- [x] 0.5 Periksa keberadaan/version Docker CLI, Compose, Git, curl, kubectl, k3d,
        Node.js dan npm.cmd. Gunakan npm.cmd untuk menghindari blok npm.ps1.
- [x] 0.6 Verifikasi Docker Desktop Linux Engine siap menerima koneksi.
        Engine 29.7.2, Linux, 12 CPU, sekitar 7.4 GiB memori Docker.
- [x] 0.7 Periksa kapasitas, port, container/network dan cluster lama secara read-only.
        Disk C bebas sekitar 48.7 GiB; lab lama memakai port 3001/5432/5001/6550/8088.
        Context aktif k3d-funqy-lab; cluster lama bukan target JournalFit.
- [x] 0.8 Hentikan 15 container lab lama dan tetapkan restart policy `no`.
        Semua berstatus `exited`; tidak ada listener TCP pada port 3001/5432/5001/6550/8088.
        Container dan volume tetap tersimpan. Restart Docker Desktop belum diuji.
        Evidence: `evidence/platform/legacy-lab-stop.txt`.
- [x] 0.9 Siapkan .env lokal dari .env.example di folder lab, di luar repository.
- [x] 0.10 Jalankan doctor dan simpan output aktual: READY, exit code 0.
         Evidence: evidence/platform/lab-preflight.txt.
         READY dari doctor tidak membuktikan port bebas atau aplikasi sehat.
- [x] 0.11 Validasi Compose dengan `config --quiet`: exit code 0.
         Evidence: `evidence/platform/compose-validation.txt`.

## A. KONTRAK INTEGRASI

**Status tahap: SELESAI sebagai baseline sementara sesuai instruksi pengguna.**
Belum merupakan kesepakatan seluruh kelompok atau bukti integrasi runtime berhasil.
Dokumen review: [Kontrak Integrasi](deployment/INTEGRATION_CONTRACT.md).
Audit database read-only: `evidence/platform/integration-audit.txt`.

- [x] A.1 Pengguna menyetujui Node.js/Express terbaru di main sebagai runtime
        container pada 2026-11-09, menggantikan baseline Python awal.
- [x] A.2 Tetapkan sementara DB_HOST/PORT/USER/NAME dan referensi Secret DB_PASSWORD.
        Baseline: database journalfit, user lab capstone, password via Secret.
        Database journalfit dan enam tabel belum tersedia; penerapan skema milik Anggota 1.
- [x] A.3 Tetapkan rancangan persistensi sementara: PVC local-path RWO 1Gi pada
        /app/uploads; replica pada satu node storage. Pengujian persistensi masih tertunda.
- [x] A.4 Tetapkan identitas platform sementara dan dokumentasikan bahan penyelarasan
        dengan branch CI/CD cf78b0d: Node 20/24, namespace, tag, sumber GitOps dan rollback.
        Baseline platform: namespace capstone, image journalfit-backend:sha12,
        student/capstone-gitops path overlays/dev; belum diaktifkan sebagai Argo Application.

## B. DOCKER

- [x] B.1 Buat source/Dockerfile dan source/.dockerignore untuk Node.js 24,
        npm ci --omit=dev, port 8000 dan appuser UID/GID 10001. Backend tidak diubah.
- [x] B.2 Build image journalfit-backend:platform-dev berhasil; UID 10001 terverifikasi
        dan /app/uploads writable. Sepuluh tes aplikasi yang tersedia lulus dalam image.
- [x] B.3 /health/live dan /health/ready HTTP 200 terhadap database lab yang ada.
        Tidak mengubah skema; belum membuktikan transaksi end-to-end atau persistensi DOCX.
        Evidence: docker-build.txt, docker-runtime.txt, application-tests-container.txt
        dalam evidence/platform/. Container uji sementara sudah dihentikan.

## C. MANIFEST KUBERNETES

**Status tahap: SELESAI untuk draft dan validasi lokal.** Validasi API server dan
uji runtime menunggu cluster capstone pada tahap D. HPA tetap pada tahap E.

- [x] C.1 Adaptasi template menjadi deployment/configmap.yaml, deployment.yaml,
        service.yaml, namespace.yaml, pvc.yaml, ingress.yaml dan kustomization.yaml.
- [x] C.2 Terapkan requests CPU 100m/memory 128Mi, limits CPU 250m/memory 256Mi,
        port 8000, probes /health/live dan /health/ready serta referensi Secret.
- [x] C.3 Tetapkan dua replica, maxUnavailable 0/maxSurge 1, PVC RWO local-path 1Gi,
        /app/uploads, UID/fsGroup 10001 dan penempatan pada satu node storage berlabel.
- [x] C.4 Render enam resource dengan kubectl kustomize; periksa konsistensi selector,
        port, env, referensi ConfigMap/Secret/PVC dan Ingress secara lokal.
        Evidence: evidence/platform/manifest-validation.txt. Belum ada server dry-run.
        Kustomize adalah entry point; sumber GitOps final tetap mengikuti penyelarasan A.4.

## D. DEPLOYMENT DAN VERIFIKASI

- [ ] D.0 Sebelum integrasi aplikasi: pastikan database journalfit dan enam tabel siap
        melalui Anggota 1/koordinasi pengguna. Selaraskan Secret dengan Anggota 4.
        Sebelum aktivasi Argo CD: selaraskan perbedaan A.4 dengan Anggota 3.
- [x] D.1 Jalankan layanan inti paket: PostgreSQL healthy dan menerima koneksi,
        registry HTTP 200, Gitea HTTP 200, konfigurasi OIDC realm Keycloak HTTP 200.
        Evidence: `evidence/platform/core-health.txt`.
- [ ] D.2 Buat cluster capstone setelah memverifikasi nama/context; jangan gunakan
        cluster praktikum lama tanpa pemeriksaan.
        Setelah cluster siap, lakukan validasi API/schema dan server dry-run manifest.
- [ ] D.3 Verifikasi smoke test host -> registry -> cluster -> Service/Ingress.
- [ ] D.4 Publikasikan image: push localhost:5001, pull registry:5000.
- [ ] D.5 Siapkan Secret runtime tanpa menyimpan nilainya di Git.
- [ ] D.6 Deploy via alur yang disepakati; buktikan pod Ready, Service, probes dan
        transaksi aplikasi. Koordinasikan Argo CD dengan Anggota 3.

## E. RELIABILITY DAN HPA

- [ ] E.1 Bangun/publikasikan versi pengganti sebelum rolling update.
- [ ] E.2 Uji rollout sambil mengirim request; ukur error dan waktu, bukan hanya
        kubectl rollout status. Selaraskan perubahan dengan GitOps.
- [ ] E.3 Hapus satu pod secara normal; amati penggantian dan ukur recovery.
- [ ] E.4 Verifikasi Metrics API dan metrics pod; buat deployment/hpa.yaml.
- [ ] E.5 Uji HPA memakai beban terukur; verifikasi replica dan selaraskan replica
        dengan Argo CD. Jika metrik tidak tersedia, catat keterbatasan.

## F. EVIDENCE DAN PENYELESAIAN

- [ ] F.1 Simpan output aktual di evidence/platform/ setiap kali tahap diuji, dengan
        timestamp, versi/commit/image, metode, hasil, interpretasi dan keterbatasan.
- [ ] F.2 Review baseline sementara terhadap pembaruan Anggota 1/3/4; dokumentasikan
        perubahan kontrak dan ulangi pengujian terdampak. Jangan klaim persetujuan tanpa koordinasi.
- [ ] F.3 Siapkan ringkasan kontribusi dan PR sesuai template repository.
- [ ] F.4 Pastikan tidak ada credential/evidence palsu dan tidak ada commit di main.
- [ ] F.5 Setelah semua poin di atas terverifikasi, ubah status keseluruhan menjadi
        SELESAI SEMUA. Push hanya setelah persetujuan pengguna.

## BATAS KERJA

- Kerjakan manual bertahap; jelaskan perintah, output dan langkah berikutnya.
- Jangan menjalankan bootstrap-project: skrip bawaan memuat force push.
- Jangan menjalankan reset-lab atau menghapus volume/cluster tanpa otorisasi khusus.
- Jangan mengklaim rollout tanpa downtime, HPA berhasil atau persistensi data
  sebelum pengujian yang relevan benar-benar dilakukan.
