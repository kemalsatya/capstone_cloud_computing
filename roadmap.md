# JournalFit - Roadmap Platform & Kubernetes

**Status keseluruhan:** BELUM SELESAI - M3 terverifikasi dan dokumentasi F disiapkan; D.8/M4 tertunda.

Checklist ini diperbarui setelah setiap poin terverifikasi. `[x]` berarti selesai; `[ ]` berarti belum selesai.

**Pembaruan terakhir:** 2026-11-10 (Asia/Jakarta)

**Branch kerja:** feat/k8s-manifests

**Baseline source:** 747c958 (Express/Node.js, port 8000)

**Lab:** C:\cloud-capstone\Cloud_Computing_Common_Capstone_Infrastructure_Package

**Catatan troubleshooting 2026-11-10:** readiness sempat gagal setelah restart
karena host.k3d.internal ENOTFOUND. DB_HOST diubah ke host.docker.internal setelah
koneksi database read-only terverifikasi. Catatan pemulihan disimpan di
evidence/platform/readiness-dns-recovery-20261110.txt; database/PVC tidak dibuat ulang.

## POSISI DAN URUTAN BERIKUTNYA

M3 platform lokal sudah diimplementasikan dan diuji. Dokumentasi F merangkum
hasil, versi, interpretasi dan batasnya; bukan memperluas M3 menjadi seluruh M4.
Update feature branch remote 2bd8428 sudah diserap fast-forward tanpa menimpa
perbaikan DNS lokal. Dockerfile Node 22 dari kelompok diuji kandidat secara terpisah;
workload Kubernetes tetap artifact 3bdf305 Node 24 sampai promosi berikutnya.

1. Selesaikan pemeriksaan F, commit perubahan terpilih dan push feat/k8s-manifests
   sesuai izin pengguna. Reference-docs, .env, PDF belajar dan file QA tmp tidak dipush.
2. Jangan membuat PR atau merge main; pengguna meminta commit dan push saja.
   Draft deskripsi PR hanya bahan review lokal/kelompok.
3. Paket evidence 04 memakai output asli yang terbaca; foto pengumpulan belum
   dinyatakan sudah dibuat/diserahkan hanya karena log tersedia.
4. D.8.4/D.8.5 tetap tertunda: Argo sync/revision/Healthy, drift dan handoff CI belum
   dibuktikan. Ini perlu koordinasi M4, bukan syarat menyatakan inti M3 terimplementasi.

Git membagikan source dan konfigurasi, bukan database/Secret/upload yang berjalan.
Penerapan schema.sql yang sudah ada dilakukan setelah izin pengguna, tanpa perubahan
SQL/backend. Perbaikan DNS memakai DB_HOST host.docker.internal untuk Windows ini.

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
        /app/uploads; replica pada satu node storage. Persistensi kemudian diuji pada D.6.
- [x] A.4 Tetapkan identitas platform sementara dan dokumentasikan bahan penyelarasan
        dengan branch CI/CD cf78b0d: Node 20/24, namespace, tag, sumber GitOps dan rollback.
        Diperbarui atas instruksi pengguna: namespace default, tag SHA7,
        Argo membaca GitHub aplikasi HEAD path deployment/. Tidak membuat repo GitOps kedua.

## B. DOCKER

- [x] B.1 Uji awal source/Dockerfile dan source/.dockerignore memakai Node.js 24,
        npm ci --omit=dev, port 8000 dan appuser UID/GID 10001. Backend tidak diubah.
- [x] B.2 Build image journalfit-backend:platform-dev berhasil; UID 10001 terverifikasi
        dan /app/uploads writable. Sepuluh tes aplikasi yang tersedia lulus dalam image.
- [x] B.3 /health/live dan /health/ready HTTP 200 terhadap database lab yang ada.
        Tidak mengubah skema; belum membuktikan transaksi end-to-end atau persistensi DOCX.
        Evidence: docker-build.txt, docker-runtime.txt, application-tests-container.txt
        dalam evidence/platform/. Container uji sementara sudah dihentikan.

## C. MANIFEST KUBERNETES

**Status tahap: SELESAI.** Render lokal dan validasi API lulus; runtime kemudian
diverifikasi pada D.6, dan HPA pada E. Evidence awal tidak dianggap run baru.

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
        Evidence: member3-alignment.txt. Dockerfile runtime tetap Node 24; tes eksplisit
        Node 20 lulus 10/10, tetapi npm test Node 20 gagal glob (evidence terpisah).
- [ ] D.8 Handoff Anggota 3: tindak lanjuti npm test Node 20, desired-state image update,
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
- [x] D.8.3 Patch CI Anggota 3 siap review: awal Node 24, diperbarui Node 22 saat F
        mengikuti Dockerfile terbaru; build/install strict, publish
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

**Status tahap: dokumentasi M3 dan review lokal diselesaikan; penutupan keseluruhan bersyarat.**

- [x] F.1 Indeks evidence aktual beserta timestamp, revisi, metode, hasil dan batasnya
        dirapikan pada evidence/platform/README.md dan ringkasan M3. Log asli tidak
        diganti menjadi klaim sukses; kegagalan DNS dan pemulihannya disimpan.
- [x] F.2 Update source/Anggota 3/Anggota 4 direview read-only. Dockerfile baru dibangun,
        10 tes dan health kandidat diuji terpisah. Riwayat temuan YAML Argo, perbaikannya di main 280a866 dan batas
        evidence restore dicatat, tanpa klaim persetujuan anggota lain.
        Evidence: final-source-validation-20261110.txt, final-integration-review-20261110.txt.
- [x] F.3 Ringkasan kontribusi, panduan demo, transkrip dan draft deskripsi PR disiapkan.
        Pengguna belum mengizinkan pembuatan PR; tidak ada PR yang dibuat.
- [x] F.4 Review final scope/credential pada 16 file lolos; Kustomize merender enam
        resource. Whitespace dokumen lolos; spasi output log asli dipertahankan. Path eksplisit;
        reference-docs, .env, output PDF dan QA tmp tidak dimasukkan.
- [ ] F.5 Penutupan SELESAI SEMUA hanya setelah seluruh poin roadmap terpenuhi.
        D.8.4/D.8.5 masih tertunda dan foto pengumpulan belum dinyatakan terverifikasi.
        Karena itu status keseluruhan tetap BELUM SELESAI, meskipun inti M3 sudah diuji.

## BATAS KERJA

- Kerjakan manual bertahap; jelaskan perintah, output dan langkah berikutnya.
- Jangan menjalankan bootstrap-project: skrip bawaan memuat force push.
- Jangan menjalankan reset-lab atau menghapus volume/cluster tanpa otorisasi khusus.
- Jangan mengklaim rollout tanpa downtime, HPA berhasil atau persistensi data
  sebelum pengujian yang relevan benar-benar dilakukan.
