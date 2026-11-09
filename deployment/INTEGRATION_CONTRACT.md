# Kontrak Integrasi Platform JournalFit

**Status:** baseline sementara platform ditetapkan atas instruksi pengguna.
Tahap A selesai sebagai penetapan kontrak kerja sementara; konfirmasi lintas anggota
dan verifikasi runtime tetap menjadi gate integrasi. Ini bukan persetujuan seluruh kelompok.

**Tanggal:** 2026-11-09, Asia/Jakarta.

**Basis:** aplikasi commit `747c958`, Panduan Eksekusi JournalFit v2, Infrastructure
Guide dan template paket dosen. Penyelarasan delivery juga mengacu pada branch
`origin/chore/cicd-gitops-pipeline`, commit `cf78b0d`, yang diperiksa read-only dan
belum digabung ke branch kerja. Pemilik dokumen: Anggota 2.

Tujuan kontrak ini adalah menetapkan antarmuka aplikasi, container, Kubernetes,
database dan delivery sebelum manifest dibuat. Dokumen ini tidak membuat database,
volume, cluster, repository Gitea, pipeline atau deployment.

## A.1 Runtime dan kesehatan

| Parameter | Kontrak |
| --- | --- |
| Framework | Node.js/Express modular monolith yang sudah ada di main |
| Runtime container | Node.js 24, base `node:24-bookworm-slim` |
| Build context | `source/` dari root repository |
| Instalasi runtime | `npm ci --omit=dev`, menggunakan package-lock.json |
| Entrypoint | `node src/index.js` |
| Working directory | `/app` |
| User dan group | `appuser`, UID/GID `10001:10001` |
| Port | `PORT=8000`, HTTP |
| Liveness | `GET /health/live`, HTTP 200 ketika proses melayani request |
| Readiness | `GET /health/ready`, HTTP 200 jika `SELECT 1` berhasil, 503 jika gagal |
| Requests | CPU `100m`, memory `128Mi` |
| Limits | CPU `250m`, memory `256Mi` |

Pengguna menyetujui penggunaan Node.js/Express pada 2026-11-09. Kode backend tidak
diubah oleh Anggota 2. Resource adalah baseline awal, bukan hasil optimasi.

Probe tidak memerlukan token atau header tenant. Readiness saat ini tidak
memeriksa keberadaan tabel; verifikasi skema dan transaksi harus dilakukan terpisah.

## A.2 Database dan konfigurasi runtime

| Key | Baseline sementara | Tempat konfigurasi Kubernetes |
| --- | --- | --- |
| `PORT` | `8000` | ConfigMap |
| `DB_HOST` | `host.k3d.internal`, mengikuti rute PostgreSQL host dalam panduan dosen | ConfigMap |
| `DB_PORT` | `5432` | ConfigMap |
| `DB_NAME` | `journalfit`, database aplikasi terpisah dari database lab `capstone` | ConfigMap |
| `DB_USER` | `capstone`, user lab dari konfigurasi paket; evaluasi hak akses bersama Anggota 4 | ConfigMap |
| `DB_PASSWORD` | Password user lab yang benar, dibaca dari konfigurasi lokal | Secret `journalfit-backend-secret`, key `DB_PASSWORD` |

Nama ConfigMap: `journalfit-backend-config`. Password tidak ditulis ke dokumen,
manifest, commit, image, log atau output Secret YAML. Secret harus tersedia sebelum
sinkronisasi aplikasi. Environment variable diberikan secara eksplisit agar default
`localhost` dan user/password bawaan kode tidak dipakai tanpa sengaja.

Untuk Docker lokal, `DB_HOST=postgres` hanya berlaku ketika container aplikasi
bergabung ke network Compose `capstone-net`; ini berbeda dari rute Kubernetes.
Tes Docker sebelumnya menggunakan database lab `capstone` untuk `SELECT 1` saja.
Konektivitas `host.k3d.internal:5432` dari pod wajib dibuktikan pada tahap D;
konfigurasi contoh belum menjadi bukti jaringan berhasil.

**Pembagian pekerjaan:**

- Anggota 1 menyiapkan database `journalfit`, meninjau dan menerapkan
  `source/schema.sql`, serta memverifikasi tabel dan seed. Tidak ada migrasi otomatis
  pada startup backend saat ini.
- Anggota 2 memasok konfigurasi koneksi dan referensi Secret, memverifikasi probe
  dan koneksi dari pod; tidak mengubah SQL, model, atau backend Anggota 1.
- Anggota 4 mengoordinasikan penyediaan Secret dan kontrol akses serta backup/restore.

**Gate sebelum transaksi:** enam tabel `tenants`, `users`, `format_rule_templates`,
`manuscripts`, `check_results`, dan `findings` tersedia di database tujuan. Upload
DOCX nyata menghasilkan laporan yang dapat diambil setelah restart aplikasi.
Tenant test memakai data aktual, bukan menganggap seed metadata sebagai file DOCX.

**Hasil audit:** pada 2026-11-09 database `journalfit` belum tersedia; database
`capstone` tidak memiliki keenam tabel tersebut. Tidak ada skema yang dibuat dalam
audit ini. Bukti: `evidence/platform/integration-audit.txt`.

**Pembaruan integrasi 2026-11-10:** setelah pengguna mengizinkan kelanjutan D.0,
database journalfit dibuat dan `source/schema.sql` diterapkan tanpa perubahan,
dalam satu transaksi. Enam tabel dan seed terverifikasi. Hash file SQL tetap sama.
Audit awal di atas tetap berlaku sebagai catatan historis, bukan status terbaru.
Bukti: `evidence/platform/database-initialization.txt`.

## A.3 Penyimpanan dokumen dan batas scaling lab

Kode menulis ke `path.resolve(process.cwd(), 'uploads')`, sehingga lokasi fisik
container adalah `/app/uploads`. Nilai `file_path` di database berbentuk
`/uploads/<nama-file>`; ini bukan bukti bahwa endpoint download tersedia.

**Baseline sementara implementasi lab tanpa perubahan backend:**

- Satu PVC `journalfit-uploads`, storage class `local-path`, request awal `1Gi`,
  access mode `ReadWriteOnce`, dimount pada `/app/uploads`.
- Seluruh replica backend ditempatkan pada satu node penyimpanan yang diberi label
  `journalfit-storage=uploads`. Label diberikan saat cluster baru siap. Node tersebut
  dipilih secara eksplisit; workload tidak diarahkan ke cluster praktikum lama.
- Semua replica menggunakan PVC yang sama pada node tersebut. RWO dapat dipakai
  beberapa pod pada node yang sama; ini bukan shared storage lintas node.
- Security context menggunakan UID/GID 10001 dan `fsGroup: 10001`. Izin volume harus
  diuji karena mount volume menggantikan direktori yang dibuat saat image dibangun.
- Awal deployment: dua replica, rolling update `maxUnavailable: 0`, `maxSurge: 1`.
  Kapasitas node harus cukup untuk satu pod tambahan saat rollout.
- Baseline HPA: CPU rata-rata 70% dari request, minimum dua dan maksimum tiga replica.
  HPA hanya diuji setelah Metrics API tersedia. Semua replica tetap pada node storage.

Pilihan ini mendukung pengujian penggantian pod dan rollout dalam lab, dengan batas
yang jelas: bukan high availability lintas node. Kerusakan node storage, penghapusan
PVC atau penghapusan cluster dapat membuat dokumen tidak tersedia atau hilang.
Request PVC 1Gi tidak boleh dianggap sebagai kuota disk yang sudah terbukti dipaksakan.

Metadata PostgreSQL dan berkas DOCX adalah dua aset berbeda. Anggota 4 perlu memasukkan
berkas dalam rencana backup/restore bila kelompok mengklaim pemulihan dokumen lengkap.
Jangan memperluas ke object storage, NFS atau layanan tambahan tanpa koordinasi.

**Gate implementasi:** upload DOCX nyata, catat ID dan checksum file, ganti satu pod,
lalu buktikan file tetap ada pada volume dan laporan tetap dapat diambil. Uji akses
tulis dari replica yang memakai volume yang sama. Kegagalan node bukan bagian klaim ini.

## A.4 Penyelarasan ke Anggota 3

Atas instruksi pengguna, konfigurasi platform mengikuti branch
`chore/cicd-gitops-pipeline` commit `cf78b0d`, diperiksa kembali melalui fetch.
Keputusan ini menggantikan usulan sebelumnya tentang namespace capstone, tag
12 karakter dan repository GitOps terpisah. Workflow Anggota 3 tidak diubah.

| Parameter | Konfigurasi yang diikuti |
| --- | --- |
| Cluster/context | capstone / k3d-capstone |
| Namespace workload, ConfigMap, Secret dan PVC | default |
| Deployment / Service / Argo Application | journalfit-backend |
| Container / label | backend / app=journalfit |
| Service | Port 80 menuju container 8000 |
| Tag artifact | 7 karakter SHA source; artifact saat ini 3bdf305 |
| Push / pull | localhost:5001/journalfit-backend / registry:5000/journalfit-backend |
| Sumber Argo CD | https://github.com/kemalsatya/capstone_cloud_computing.git |
| targetRevision / path | HEAD (default branch repository) / deployment |
| Entry point manifest | deployment/kustomization.yaml |
| Namespace controller Argo CD | argocd |

Namespace default adalah bawaan cluster dan tidak dikelola manifest Namespace,
sehingga file namespace.yaml tidak lagi digunakan. Jangan membuat Argo Application
kedua yang merekonsiliasi workload yang sama dari repository/path berbeda.

Sumber GitHub aplikasi ini mengikuti instruksi pengguna dan konfigurasi Anggota 3;
berbeda dari pemisahan app/GitOps repository pada Infrastructure Guide. Perbedaan
tersebut tetap dicatat untuk review kepatuhan kelompok, bukan diklaim sudah memenuhi
pemisahan repository. Tidak membuat repository GitOps lain secara bersamaan.

### Migrasi lokal dan data

Workload baru di default sudah memiliki dua replica Ready dengan PVC baru pada
node storage yang sama. Seluruh file upload yang ada disalin melalui stream biner,
checksum sumber/tujuan cocok. Health dan laporan lama tetap HTTP 200 setelah Ingress
dialihkan. Database PostgreSQL tetap sama. Deployment lama di capstone diskalakan
ke nol dan Ingress lamanya dilepas; PVC/Secret/namespace lama tidak dihapus.

Tag pendek 3bdf305 merujuk artifact yang sama dengan 3bdf305d106c:
sha256:a441538a80ffd8f2fad9e29b17ec9c3872f851bba8d8eb01c55674fdba9ccc95.
Tidak membangun artifact baru dengan tag commit lama. Image produksi masih Node.js
24 sesuai Dockerfile yang akan dipakai pipeline ketika file tersebut tersedia.

### Runtime CI dan pekerjaan delivery yang belum selesai

GitHub CI Anggota 3 menggunakan Node.js 20 untuk npm test, tetapi build image memakai
source/Dockerfile kita. Runtime CI dan runtime image merupakan dua pengaturan terpisah.
Uji diagnostik menunjukkan 10 tes lulus pada Node20 dengan path eksplisit
`node --test tests/app.test.js`. Namun perintah npm test saat ini memakai pola
`tests/**/*.test.js` yang tidak ditemukan oleh Node20 dalam lingkungan uji.

Anggota 1/3 perlu menyelaraskan perintah tes, misalnya memakai path eksplisit pada
script test atau versi Node CI yang mendukung pola tersebut. Tidak ada perubahan
package.json atau workflow oleh Anggota 2. Hasil tes eksplisit bukan klaim CI hijau.

Workflow Gitea yang diperiksa belum memperbarui tag pada manifest setelah push;
Argo tidak otomatis memilih image baru hanya karena registry mendapat tag baru.
Anggota 3 perlu memperbarui desired state dan membuktikan revision/image runtime.
Skrip rollout undo juga harus diselaraskan dengan selfHeal Argo: perubahan manual
bisa dikembalikan sesuai Git. HPA memerlukan koordinasi kepemilikan spec.replicas.

Deployment masih manual. Pada preflight D.8, perubahan platform belum dipush
atau masuk main. Publikasi branch harus diverifikasi sebelum sinkronisasi; Argo
yang membaca HEAD/main tidak otomatis membaca feature branch.
Tidak mengaktifkan Argo atau mengubah pipeline tanpa handoff Anggota 3.

Pembaruan D.8: controller Argo CD v3.5.6 sudah dipasang. Application review tersedia
di automation/argocd/application.yaml, sementara membaca feat/k8s-manifests dan
auto-sync disabled. Setelah push/review, sync revision diuji; setelah PR merge,
targetRevision kembali main/HEAD. HPA diabaikan pada spec.replicas, dan PVC dilindungi
Prune=false,Delete=false. Ini persiapan konfigurasi, belum bukti sync dari GitHub.

Patch untuk workflow cf78b0d tersedia pada automation/handoff/; patch mengusulkan
Node24 agar npm test yang ada berjalan tanpa mengubah backend/package.json, serta
build/publish strict. Helper pembaruan tag menyiapkan diff setelah memverifikasi
image terpublikasi, tanpa commit/push otomatis. Handoff lengkap dan gate publikasi
ada pada automation/handoff/D8_INTEGRATION.md.

Bukti: evidence/platform/member3-alignment.txt dan
member3-node20-compatibility.txt. Kegagalan salin metadata direktori awal dan kegagalan
npm test dicatat apa adanya; checksum dan tes eksplisit diverifikasi setelahnya.

## Status tahap A dan gate integrasi

- [x] Runtime Node.js/Express disetujui pengguna dan sudah diuji dalam container.
- [x] Kontrak konfigurasi ditelusuri terhadap kode dan template yang tersedia.
- [x] Kondisi database diperiksa read-only; gap skema tercatat.
- [x] A.2: database, environment variable dan referensi Secret ditetapkan sementara.
- [x] A.3: PVC lokal, mount dan batas scaling satu node ditetapkan sementara.
- [x] A.4: identitas platform dan sumber GitOps disesuaikan ke branch Anggota 3
  atas instruksi pengguna; handoff/CI end-to-end masih harus dibuktikan.

Sesuai instruksi pengguna, penulisan dan validasi manifest pada tahap C dapat
dilanjutkan dengan baseline ini. Tidak diperlukan klaim kesepakatan kelompok untuk
menyusun draft platform. Namun, sebelum integrasi runtime:

- [x] Database dan skema dari Anggota 1 diterapkan lokal setelah izin pengguna;
  enam tabel dan seed terverifikasi, upload DOCX nyata dan report berhasil.
- [x] Koneksi database dari pod, readiness dan penggunaan Secret runtime berhasil;
  review hak akses lanjutan tetap dikoordinasikan dengan Anggota 4.
- [x] Izin PVC, penempatan dua replica dan persistensi file setelah satu pod diganti
  diverifikasi dengan checksum dan laporan yang sama.
- [ ] Konfirmasi dan uji cakupan backup file bersama Anggota 4; bukan hasil pengujian persistensi pod.
- [x] Sesuaikan namespace default, tag SHA7 dan sumber GitHub deployment/ ke Anggota 3.
- [ ] Anggota 1/3 menindaklanjuti perintah npm test Node20, desired-state update dan
  rollback sebelum aktivasi serta pembuktian delivery Argo CD.

Jika ada pembaruan anggota lain, bandingkan kode dan konfigurasi dengan baseline
ini, catat keputusan yang berubah dan alasannya, lalu perbarui kontrak, manifest
serta roadmap pada feature branch. Ulangi hanya pengujian yang terdampak. Jangan
menimpa pekerjaan anggota lain, memasang dua sumber rekonsiliasi, atau menghapus data
untuk menyesuaikan baseline. Penetapan sementara ini tidak mengotorisasi perubahan
backend, penerapan skema atau pipeline anggota lain.
