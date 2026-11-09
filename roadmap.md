# JournalFit - Roadmap Platform & Kubernetes

**Status keseluruhan:** BELUM SELESAI

Checklist ini diperbarui setelah setiap poin terverifikasi. `[x]` berarti selesai; `[ ]` berarti belum selesai.

**Pembaruan terakhir:** 2026-11-10 (Asia/Jakarta)

**Branch kerja:** feat/k8s-manifests

**Baseline source:** 747c958 (Express/Node.js, port 8000)

**Lab:** C:\cloud-capstone\Cloud_Computing_Common_Capstone_Infrastructure_Package

## POSISI DAN URUTAN BERIKUTNYA

Persiapan lab, baseline sementara A, Docker dan penulisan manifest sudah selesai.
Tahap D sudah memverifikasi cluster, registry, Secret dan deployment manual aplikasi,
termasuk transaksi DOCX nyata dan persistensi setelah satu pod diganti.
Tahap A tidak perlu diulang atau menunggu pengesahan semua anggota untuk pekerjaan
platform yang tidak bergantung pada keputusan tersebut.

1. Pengguna sudah mengizinkan dua commit progres D/E dan persiapan D.8, lalu push
   branch feat/k8s-manifests. Periksa hasil push sebelum melanjutkan sinkronisasi.
2. Jangan membuat PR atau merge main: pengguna meminta commit dan push saja.
   Pada preflight D.8, tiga commit sebelumnya belum dipublikasikan; status remote
   berikutnya diverifikasi melalui Git, bukan dianggap bukti sinkronisasi Argo.
3. D.0 dan D.6 sudah selesai setelah pengguna mengizinkan penerapan SQL lokal.
4. Persiapan lokal D.8 selesai; setelah branch dipublikasikan, buktikan Argo membaca
   revision tersebut, sync/health, ownership HPA dan rekonsiliasi drift.
5. E sudah diuji; selesaikan D.8 dan review/dokumentasi akhir F.

Git membagikan backend, SQL, Dockerfile dan manifest. Database, tabel, file upload,
Secret dan container harus disiapkan pada lingkungan integrasi yang dipilih.
Menjalankan SQL yang sudah ada merupakan pekerjaan integrasi lokal; mengubah desain
SQL tetap domain Anggota 1. Pengguna kemudian mengizinkan penerapan SQL yang sudah
ada untuk integrasi lokal pada 2026-11-10; file backend/SQL tidak diubah.


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
        Kesiapan database/tabel merupakan tugas integrasi D.0, bukan syarat menulis manifest.
- [x] A.3 Tetapkan rancangan persistensi sementara: PVC local-path RWO 1Gi pada
        /app/uploads; replica pada satu node storage. Pengujian persistensi masih tertunda.
- [x] A.4 Tetapkan identitas platform sementara dan dokumentasikan bahan penyelarasan
        dengan branch CI/CD cf78b0d: Node 20/24, namespace, tag, sumber GitOps dan rollback.
        Diperbarui atas instruksi pengguna: namespace default, tag SHA7,
        Argo membaca GitHub aplikasi HEAD path deployment/. Tidak membuat repo GitOps kedua.

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

**Status tahap: SELESAI untuk draft dan validasi lokal.** Validasi API server juga
sudah lulus pada D.2. Uji runtime aplikasi belum dilakukan. HPA tetap pada tahap E.

- [x] C.1 Adaptasi template menjadi deployment/configmap.yaml, deployment.yaml,
        service.yaml, namespace.yaml, pvc.yaml, ingress.yaml dan kustomization.yaml.
- [x] C.2 Terapkan requests CPU 100m/memory 128Mi, limits CPU 250m/memory 256Mi,
        port 8000, probes /health/live dan /health/ready serta referensi Secret.
- [x] C.3 Tetapkan dua replica, maxUnavailable 0/maxSurge 1, PVC RWO local-path 1Gi,
        /app/uploads, UID/fsGroup 10001 dan penempatan pada satu node storage berlabel.
- [x] C.4 Render enam resource dengan kubectl kustomize; periksa konsistensi selector,
        port, env, referensi ConfigMap/Secret/PVC dan Ingress secara lokal.
        Evidence saat tahap C: evidence/platform/manifest-validation.txt.
        Server dry-run kemudian lulus pada D.2, dengan evidence terpisah.
        Kustomize adalah entry point; sumber GitOps final tetap mengikuti penyelarasan A.4.

## D. DEPLOYMENT DAN VERIFIKASI

**Status tahap: deployment manual dan verifikasi D.0-D.6 SELESAI.**
D.7 penyesuaian platform selesai; D.8 handoff GitOps belum selesai.
Belum ada klaim deployment via Argo CD. Evidence D.0-D.6 sebelumnya memakai namespace
capstone; workload aktif kemudian dipindah ke default sesuai Anggota 3.

- [x] D.0 Setelah pengguna mengizinkan kelanjutan, buat database journalfit dan terapkan
        source/schema.sql Anggota 1 tanpa perubahan menggunakan transaksi.
        Enam tabel dan seed terverifikasi, hash SQL tidak berubah.
        Evidence terbaru: evidence/platform/database-initialization.txt.
        database-gate.txt merekam kondisi sebelum inisialisasi, bukan kondisi terkini.
- [x] D.1 Jalankan layanan inti paket: PostgreSQL healthy dan menerima koneksi,
        registry HTTP 200, Gitea HTTP 200, konfigurasi OIDC realm Keycloak HTTP 200.
        Evidence: `evidence/platform/core-health.txt`.
- [x] D.2 Cluster capstone baru: 1 server + 1 agent, keduanya Ready, local-path dan
        Traefik tersedia. Kubeconfig cluster ini dikoreksi ke https://127.0.0.1:6550
        karena host.docker.internal tidak terjangkau dari Windows. Server dry-run enam
        manifest lulus. Evidence: cluster-setup.txt, cluster-api.txt, deployment-prerequisites.txt.
- [x] D.3 Smoke image paket dosen berhasil push/pull, rollout dan Ingress HTTP 200.
        Request awal belum siap; pengulangan sukses dicatat dalam registry-smoke-test.txt.
- [x] D.4 Image source commit 3bdf305d106c berhasil build/push ke localhost:5001;
        probe pod menarik dari registry:5000 dengan digest yang cocok. Node v24.22.2,
        UID 10001; koneksi TCP host.k3d.internal:5432 berhasil tanpa SQL/autentikasi.
        Evidence: registry-image.txt dan cluster-image-network.txt.
- [x] D.5 Secret journalfit-backend-secret key DB_PASSWORD tersedia di namespace
        capstone, diambil dari .env lab tanpa mencetak nilai. Label storage ada pada
        k3d-capstone-agent-0. Evidence: deployment-prerequisites.txt.
- [x] D.6 Apply Kustomize ke k3d-capstone: dua replica Ready dan PVC Bound.
        Health HTTP 200, upload DOCX nyata HTTP 201, report HTTP 200 via Ingress.
        Checksum file cocok pada kedua replica sebelum/sesudah penggantian satu pod;
        report tetap HTTP 200. Evidence: application-deployment.txt,
        application-transaction.txt/json dan pod-replacement-persistence.txt.
- [x] D.7 Ikuti Anggota 3 cf78b0d sesuai instruksi pengguna: namespace default,
        tag SHA7 dan sumber Argo GitHub aplikasi HEAD path deployment/. Salin DOCX
        ke PVC default dan verifikasi checksum; dua pod Ready, probes/report HTTP 200.
        Deployment lama capstone nol replica dan PVC-nya dipertahankan.
        Evidence: member3-alignment.txt. Dockerfile runtime tetap Node24; tes eksplisit
        Node20 lulus 10/10, tetapi npm test Node20 gagal glob (evidence terpisah).
- [ ] D.8 Handoff Anggota 3: tindak lanjuti npm test Node20, desired-state image update,
        rollback/selfHeal dan kepemilikan replica HPA; setelah push/PR diizinkan dan
        source tersedia di GitHub, buktikan Argo sync revision serta artifact runtime.
        Perbedaan dengan panduan pemisahan repo app/GitOps tetap dicatat untuk review.
- [x] D.8.1 Controller Argo CD v3.5.6 terpasang dan Ready dari manifest resmi pinned;
        tidak menjalankan bootstrap-project atau template Application Gitea yang berbeda.
        Evidence: argocd-installation.txt.
- [x] D.8.2 Siapkan automation/argocd/application.yaml untuk branch review,
        namespace default, ignore /spec/replicas dan RespectIgnoreDifferences.
        Auto-sync disabled sampai sumber dipublikasikan/review; PVC dilindungi prune/delete.
        Application server dry-run lulus, belum dibuat/disinkronkan.
- [x] D.8.3 Patch CI Anggota 3 siap review: Node24, build/install strict, publish
        hanya push main dan helper prepared image update tanpa direct commit/push main.
        Patch dicek pada salinan cf78b0d; helper tag valid/invalid teruji.
        Evidence: delivery-preflight.txt dan delivery-validation.txt. Bukan CI run sukses.
- [ ] D.8.4 Izin commit/push diberikan; setelah publikasi branch terverifikasi, apply Application,
        periksa comparison, lakukan sync revision yang direview dan buktikan Healthy/Synced
        beserta revision, digest image, probes, report dan checksum DOCX.
- [ ] D.8.5 Uji drift aman dan ownership replica dengan Argo/HPA; handoff patch CI
        serta pembaruan image melalui PR ke Anggota 3. Jangan klaim delivery end-to-end
        sampai CI/source/artifact/runtime yang sama terbukti.

## E. RELIABILITY DAN HPA

**Status tahap: SELESAI untuk pengujian platform manual lokal.**
Integrasi Argo CD/HPA tetap D.8; hasil tidak membuktikan HA lintas node atau semua kondisi produksi.

- [x] E.1 Artifact uji 3bdf305-e1-20261110003537 dibangun/push dengan metadata berbeda,
        backend tetap sama. Digest berbeda dari artifact awal; bukan commit fitur baru.
        Evidence: rolling-update-image.txt/json. Tag uji merupakan pengecualian lab,
        tag rilis tetap SHA7 mengikuti Anggota 3.
- [x] E.2 Rolling update manual dengan tiga worker HTTP (jeda 100 ms): 777 request,
        0 gagal teramati selama 31.58 detik, p95 latensi 26.73ms; rollout 22.53 detik.
        Evidence: rolling-update-requests.csv dan rolling-update-result.json.
        Argo belum aktif; hasil sampling satu run lokal, bukan jaminan tanpa downtime.
- [x] E.3 Dilakukan saat D.6 untuk memverifikasi persistensi: hapus satu pod secara
        normal, verifikasi UID pengganti dan dua pod Ready. Observasi recovery 32.5 detik
        termasuk overhead kubectl/polling; checksum DOCX dan report tetap cocok.
        Tidak mengukur request terus-menerus, downtime atau kegagalan node.
        Evidence: evidence/platform/pod-replacement-persistence.txt.
- [x] E.4 Metrics API tersedia dan CPU/memori pod terbaca. HPA autoscaling/v2 dibuat
        dan diintegrasikan ke Kustomize: CPU 70%, min 2/max 3, scale-down stabilization 60s.
        Deployment tidak lagi memaksakan replicas. Reapply saat 3 replica tetap mempertahankan 3.
        Evidence: metrics-api-preflight.txt, hpa-setup.txt, hpa-replica-ownership.txt.
- [x] E.5 Dengan 64 worker pembacaan report, HPA menunjukkan 2->3->2 replica.
        Generator mencatat 19.865 request selesai, 0 gagal; durasi beban 66.393 detik.
        CPU rata-rata maksimum teramati 249% dari request; HPA dibatasi maksimum 3.
        Scale-down ke 2 Ready teramati 74.59 detik setelah beban berhenti.
        Evidence: hpa-timeline.jsonl, hpa-result.json, hpa-load-generator.txt.
        Kepemilikan replica manual terverifikasi; Argo belum aktif dan tetap D.8.
        Tag image uji dikembalikan ke SHA7 normal setelah tes; lihat stage-e-final-state.txt.

## F. EVIDENCE DAN PENYELESAIAN

- [ ] F.1 Simpan output aktual di evidence/platform/ setiap kali tahap diuji, dengan
        timestamp, versi/commit/image, metode, hasil, interpretasi dan keterbatasan.
- [ ] F.2 Review baseline sementara terhadap pembaruan Anggota 1/3/4; dokumentasikan
        perubahan kontrak dan ulangi pengujian terdampak. Jangan klaim persetujuan tanpa koordinasi.
- [ ] F.3 Siapkan ringkasan kontribusi dan PR sesuai template repository.
        Push feature branch diizinkan; PR belum diizinkan. Konfirmasi publikasi melalui Git.
        Jangan membuat PR sampai ada instruksi baru.
- [ ] F.4 Pastikan tidak ada credential/evidence palsu dan tidak ada commit di main.
- [ ] F.5 Setelah semua poin di atas terverifikasi, ubah status keseluruhan menjadi
        SELESAI SEMUA. Push hanya setelah persetujuan pengguna.

## BATAS KERJA

- Kerjakan manual bertahap; jelaskan perintah, output dan langkah berikutnya.
- Jangan menjalankan bootstrap-project: skrip bawaan memuat force push.
- Jangan menjalankan reset-lab atau menghapus volume/cluster tanpa otorisasi khusus.
- Jangan mengklaim rollout tanpa downtime, HPA berhasil atau persistensi data
  sebelum pengujian yang relevan benar-benar dilakukan.
