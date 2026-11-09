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

## A.4 Identitas Kubernetes, image dan GitOps

| Parameter | Baseline sementara untuk manifest platform |
| --- | --- |
| Cluster/context baru | `capstone` / `k3d-capstone` |
| Namespace aplikasi | `capstone`, konsisten dengan baseline dosen |
| Deployment / Service | `journalfit-backend` / `journalfit-backend` |
| Label selector | `app=journalfit` |
| Container | `backend` |
| Port Service | 80 menuju container 8000 |
| Push image dari runner host | `localhost:5001/journalfit-backend:<sha12>` |
| Image yang ditarik cluster | `registry:5000/journalfit-backend:<sha12>` |
| Identitas rilis | 12 karakter SHA commit source; tag tidak ditimpa untuk artifact berbeda |
| Repository aplikasi GitHub | `kemalsatya/capstone_cloud_computing`, yang sekarang digunakan |
| Target repository aplikasi Gitea | `student/capstone-app`, mengikuti nama baseline paket |
| Target repository GitOps Gitea | `student/capstone-gitops`, terpisah dari source aplikasi |
| URL Argo CD ke GitOps | `http://host.k3d.internal:3001/student/capstone-gitops.git` |
| Branch / path GitOps | `main` / `overlays/dev` |
| Base dan overlay GitOps | `base/` dan `overlays/dev/kustomization.yaml` |
| Argo Application | `journalfit-backend`, namespace controller `argocd` |

Nama dan URL Gitea di atas adalah target rancangan, belum repository yang dibuktikan
tersedia. Anggota 3 menentukan hubungan GitHub dengan mirror/source di Gitea dan
memastikan commit yang dibangun dapat ditelusuri ke commit GitHub; tidak melakukan
force push atau mengganti remote repository yang ada.

**Satu sumber konfigurasi aktif:**

1. Anggota 2 menyusun manifest di `deployment/` pada feature branch untuk review.
2. Anggota 3 mengintegrasikan versi yang disetujui ke `base/` repository GitOps.
3. Setelah Argo CD aktif, repository GitOps menjadi satu-satunya sumber desired
   state runtime. `deployment/` pada repository aplikasi adalah snapshot referensi
   versi yang diserahkan, bukan target rekonsiliasi kedua.
4. Perubahan manifest selanjutnya harus dipromosikan ke GitOps dan dicatat
   revision-nya; jangan menerapkan snapshot lama di atas aplikasi yang dikelola Argo.
   Anggota 2 dan 3 mereview perubahan manifest yang sama.

**Alur delivery milik Anggota 3:** checkout source, jalankan tes dari `source/`, build
dengan context `source/`, scan bersama Anggota 4, publish tag SHA, ubah image tag
overlay GitOps, lalu Argo CD melakukan rekonsiliasi. Contoh build dari root:

```powershell
docker build -t localhost:5001/journalfit-backend:<sha12> ./source
```

`<sha12>` harus diganti dengan SHA sebenarnya. `platform-dev` hanya tag tes lokal.
Pipeline tidak menjalankan `kubectl apply`. Workflow Gitea harus berada pada path
aktif `.gitea/workflows/` di root repository aplikasi Gitea; file di `automation/`
sendiri hanya arsip sampai ditempatkan pada path yang benar oleh Anggota 3.

Rollback dilakukan dengan mengembalikan referensi artifact melalui commit GitOps.
Jangan menguji `kubectl set image` atau `rollout undo` sebagai perubahan permanen
ketika Argo self-heal aktif. Saat HPA diaktifkan, overlay jangan terus memaksakan
replica tetap; Anggota 3 mengatur pengabaian `/spec/replicas` dan sinkronisasinya
agar Argo CD menghormati HPA. Ini harus diverifikasi pada tahap E.

Dasar teknis yang diperiksa: [access mode PersistentVolume Kubernetes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes)
dan [opsi sinkronisasi Argo CD](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/#respect-ignore-differences-configs).

Deployment manual hanya dapat dipakai sebagai verifikasi awal sebelum handoff
Argo CD, dengan context/namespace eksplisit dan metode dicatat dalam evidence.

## Bahan penyelarasan A.4 dengan branch CI/CD

Branch `chore/cicd-gitops-pipeline` commit `cf78b0d` belum menjadi kontrak final.
Berikut perbedaan yang harus direview bersama Anggota 3 sebelum handoff Argo CD:

| Bagian | Baseline platform sementara | Temuan pada branch CI/CD | Tindak lanjut saat integrasi |
| --- | --- | --- | --- |
| Runtime | Node.js 24 | GitHub Actions menguji Node.js 20 | Selaraskan versi CI dengan runtime yang disepakati. |
| Dockerfile/context | source/Dockerfile, context source/ | Pipeline mendukung path tersebut | Gunakan Dockerfile aplikasi; fallback tidak diperlukan setelah tersedia pada commit source. |
| Image | journalfit-backend | journalfit-backend | Penamaan sudah cocok. |
| Tag | SHA 12 karakter | SHA 7 karakter | Sepakati satu format dan gunakan identik pada artifact, manifest dan evidence. |
| Namespace | capstone | default | Selaraskan Application, manifest, Secret dan perintah rollback. |
| Sumber Argo | student/capstone-gitops, main, overlays/dev | GitHub aplikasi, targetRevision HEAD, path deployment | Tetap usulkan repo GitOps terpisah sesuai Infrastructure Guide; jangan aktifkan dua Application untuk workload yang sama. |
| Desired-state update | CI memperbarui tag overlay | Belum ada langkah pembaruan manifest setelah push pada workflow Gitea yang diperiksa | Anggota 3 melengkapi alur artifact ke GitOps sebelum mengklaim auto-deploy. |
| Rollback | Commit GitOps merujuk artifact sebelumnya | Skrip memakai rollout undo, sementara selfHeal aktif | Selaraskan rollback dengan rekonsiliasi Argo. |

Pemeriksaan branch dilakukan lewat `git fetch` dan `git show`; workflow, Application,
dan skrip milik Anggota 3 tidak diubah atau dijalankan. Temuan kode bukan hasil CI.

## Status tahap A dan gate integrasi

- [x] Runtime Node.js/Express disetujui pengguna dan sudah diuji dalam container.
- [x] Kontrak konfigurasi ditelusuri terhadap kode dan template yang tersedia.
- [x] Kondisi database diperiksa read-only; gap skema tercatat.
- [x] A.2: database, environment variable dan referensi Secret ditetapkan sementara.
- [x] A.3: PVC lokal, mount dan batas scaling satu node ditetapkan sementara.
- [x] A.4: identitas platform dan sumber GitOps sementara ditetapkan; perbedaan dengan
  branch CI/CD dicatat sebagai bahan penyelarasan.

Sesuai instruksi pengguna, penulisan dan validasi manifest pada tahap C dapat
dilanjutkan dengan baseline ini. Tidak diperlukan klaim kesepakatan kelompok untuk
menyusun draft platform. Namun, sebelum integrasi runtime:

- [ ] Anggota 1 atau pengguna melalui koordinasi menyiapkan database tujuan dan
  skema; verifikasi enam tabel dan transaksi nyata. Skema tidak dibuat oleh dokumen ini.
- [ ] Uji koneksi database dari pod dan hak akses Secret bersama Anggota 4.
- [ ] Verifikasi izin PVC, penempatan replica, persistensi file dan cakupan backup.
- [ ] Selaraskan namespace/tag/source GitOps/versi Node/rollback dengan Anggota 3
  sebelum aktivasi Argo CD dan pengujian delivery.

Jika ada pembaruan anggota lain, bandingkan kode dan konfigurasi dengan baseline
ini, catat keputusan yang berubah dan alasannya, lalu perbarui kontrak, manifest
serta roadmap pada feature branch. Ulangi hanya pengujian yang terdampak. Jangan
menimpa pekerjaan anggota lain, memasang dua sumber rekonsiliasi, atau menghapus data
untuk menyesuaikan baseline. Penetapan sementara ini tidak mengotorisasi perubahan
backend, penerapan skema atau pipeline anggota lain.
