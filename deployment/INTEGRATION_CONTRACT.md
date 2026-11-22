# Kontrak Integrasi Platform JournalFit

## Status aktif per 2026-11-21

**Kontrak M2 ditelusuri; kandidat container telah diuji pada Tahap 2.**
Pengujian transaksi formal Tahap 5 menunjukkan core workflow lulus, tetapi
validasi tipe file dan respons error ukuran masih memerlukan tindak lanjut M2.
Tahap 6 kemudian membuktikan data dan file bertahan setelah penggantian pod serta
rolling update, dengan probe layanan 117/117 berhasil.
Dasar penelusuran adalah HEAD `d9ab35a10eab8e9c67e45bc53f8a22522846b038`.
Pemeriksaan `git diff --exit-code HEAD -- source` menghasilkan exit code 0 pada
2026-11-17T12:21:27+07:00. Perubahan lokal Tahap 0 berada di luar source aplikasi.

Pada Tahap 2, Dockerfile dan .dockerignore diubah; kode aplikasi, package files,
schema, dan source test M2 tetap sesuai baseline. Command Tahap 1 pada panduan
sekarang memeriksa cakupan aplikasi M2 tersebut, sedangkan packaging ditelusuri
melalui checksum dan metadata build Tahap 2.

Perilaku source dijelaskan pada [catatan Tahap 1](../evidence/platform/tahap-1-kontrak-m2.md).
Hasil runtime Docker terbatas pada [skenario Tahap 2](../evidence/platform/tahap-2/README.md).
Kubernetes dan transaksi DOCX kemudian lulus pada
[verifikasi langsung M3](../evidence/platform/m3-live-20261117/README.md).
Command utama berada di [panduan M3](PANDUAN_M3.md).

## 1. Ringkasan kontrak M2 ke M3

| Bagian | Kontrak berdasarkan source | Tindak lanjut platform |
| --- | --- | --- |
| Aplikasi | Satu backend Express, JavaScript ES modules | Jalankan satu proses API per container |
| Startup | `npm start` menjalankan `node src/index.js` dari folder `source/` | Dockerfile menggunakan working directory `/app` dan entrypoint yang sama |
| Port | `PORT`, fallback 8000 | Selaraskan container, Service, Ingress, dan probes |
| Dependency | `dotenv`, `express`, `mammoth`, `multer`, `pg`; lockfile tersedia | Instal dependency sesuai lockfile; tidak ada script transpile/build aplikasi |
| Database | PostgreSQL, enam tabel dari `schema.sql` | Siapkan database/schema terpisah dari proses startup backend |
| File | Direktori `uploads` relatif terhadap working directory | Direktori harus writable dan dipertahankan di luar umur pod |
| Liveness | `GET /health/live` | Periksa apakah proses melayani HTTP |
| Readiness | `GET /health/ready`, query `SELECT 1` | Periksa koneksi DB; uji schema dan transaksi secara terpisah |
| Pemrosesan | Upload, ekstraksi, evaluasi, dan penyimpanan selesai dalam satu request | Tidak ada proses worker atau broker yang dibutuhkan source saat ini |
| Identitas | Token mock dan tenant dari header | Integrasi identitas/otorisasi penuh memerlukan pekerjaan aplikasi dan keamanan |

Rujukan: [package.json](../source/package.json), [entrypoint](../source/src/index.js),
[factory aplikasi](../source/src/app.js), dan [Dockerfile](../source/Dockerfile).
Base Node 22 dipin ke digest pada Dockerfile. Pada Tahap 2, runtime yang teramati
adalah Node v22.23.5 dan UID/GID 10001:10001. Metadata image serta hasil uji ada pada
evidence Tahap 2; identitas artifact lama tidak digunakan ulang.

## 2. Bagaimana aplikasi dimulai

```text
npm start / node src/index.js
    -> modul konfigurasi membaca environment melalui dotenv
    -> modul database membuat pg.Pool dari konfigurasi tersebut
    -> createApp() memasang middleware dan router
    -> app.listen(PORT) menerima request HTTP
```

Startup tidak menjalankan `schema.sql`, tidak membuat database, dan tidak menunggu
keberhasilan `SELECT 1` sebelum membuka listener. Pembuatan pool bukan bukti bahwa
koneksi atau tabel sudah siap. Karena itu liveness dapat memberikan 200 ketika
database belum dapat dipakai.

Rujukan: [env.js](../source/src/config/env.js),
[database.js](../source/src/config/database.js), dan
[health controller](../source/src/modules/health/controllers/health.controller.js).

## 3. Konfigurasi yang perlu dipasok

| Nama | Penggunaan | Implikasi M3 |
| --- | --- | --- |
| `PORT` | Port HTTP, fallback 8000 | ConfigMap atau environment runtime |
| `DB_HOST` | Host PostgreSQL, fallback localhost | Tentukan dari jalur jaringan yang benar-benar diuji |
| `DB_PORT` | Port PostgreSQL, fallback 5432 | Cocokkan dengan service/port database |
| `DB_NAME` | Nama database, fallback journalfit | Pastikan enam tabel tersedia pada database tujuan |
| `DB_USER` | Pengguna PostgreSQL | Pasok secara eksplisit sesuai akun lingkungan |
| `DB_PASSWORD` | Password pengguna database; source memiliki fallback lokal | Pasok melalui Secret runtime dengan nilai lokal yang sesuai |
| `NODE_ENV` | Digunakan error handler untuk perilaku logging; Dockerfile menetapkan production | Bukan pengganti pengaturan koneksi atau autentikasi |

Source memakai `dotenv/config`. Ketika dijalankan dari `source/`, file `.env` lokal
dapat menjadi sumber konfigurasi. Dockerfile hanya menyalin package files dan
`src/`; schema SQL, test, dan file konfigurasi lokal tidak ikut disalin olehnya.
Untuk container, konfigurasi dipasok saat runtime.

`localhost` di dalam container/pod menunjuk lingkungan container/pod tersebut.
Nama seperti `postgres` atau `host.docker.internal` baru menjadi pilihan yang benar
setelah jaringan dan resolusinya diperiksa. Pada lab ini, host.docker.internal
telah dipakai pod untuk readiness dan transaksi; lingkungan lain perlu diuji ulang.

## 4. Kontrak HTTP

| Method dan path | Input penting | Perilaku yang tertulis pada source |
| --- | --- | --- |
| `GET /` | Tidak memerlukan tenant/token | 200, identitas backend dan daftar endpoint |
| `GET /health/live` | Tidak memerlukan tenant/token | 200, status alive; tidak mengakses database |
| `GET /health/ready` | Tidak memerlukan tenant/token | 200 jika `SELECT 1` berhasil, 503 jika query gagal |
| `POST /api/auth/token` | JSON username, role, tenantId opsional | 200, token mock dan profil; tanpa verifikasi password |
| `POST /api/manuscripts/upload` | `X-Tenant-ID`, multipart field `file`, `authorId` opsional | 201 setelah pemrosesan dan penyimpanan berhasil |
| `GET /api/manuscripts/:id/report` | `X-Tenant-ID`, ID naskah | 200 jika naskah ditemukan dan tenant cocok; 403 jika tenant berbeda; 404 jika tidak ditemukan |

Endpoint naskah mengembalikan 400 jika header tenant tidak ada atau kosong setelah
trim. Upload tanpa file menghasilkan `AppError` 400. Error lain mengikuti error
handler; status dari kegagalan database atau Multer perlu diperiksa lewat uji
negatif, bukan diasumsikan sebagai 400/413.

Respons upload dan laporan membungkus data dalam `data.manuscript`,
`data.checkResult`, dan `data.findings`, bersama field `success` dan `message`.

Rujukan: [router aplikasi](../source/src/app.js),
[router naskah](../source/src/modules/manuscripts/index.js),
[controller naskah](../source/src/modules/manuscripts/controllers/manuscript.controller.js),
[middleware tenant](../source/src/common/middlewares/tenant.js), dan
[error handler](../source/src/common/middlewares/errorHandler.js).

## 5. Alur satu upload sampai laporan

```text
POST upload + X-Tenant-ID + file
    -> tenant header diperiksa
    -> Multer menerima satu file ke memory, batas 20 MiB
    -> tenant dipastikan ada; tenant baru dapat dibuat otomatis
    -> satu template tenant diambil, atau template default dibuat
    -> direktori uploads dibuat bila perlu; DOCX asli ditulis ke file
    -> Mammoth mengekstrak raw text
    -> evaluator menghitung skor dan findings
    -> manuscript, check result COMPLETED, dan findings disimpan
    -> respons HTTP 201 dikirim

GET report + X-Tenant-ID + ID naskah
    -> repository mengambil naskah, hasil terbaru, dan findings
    -> service membandingkan tenant peminta dengan tenant pemilik
    -> respons HTTP 200, 403, atau 404 sesuai kondisi
```

`async/await` di alur ini mengatur operasi I/O dalam request yang sama. Source
belum memiliki producer/consumer antrean, worker terpisah, retry/DLQ, atau layanan
AI. Belum ada endpoint khusus daftar histori, revisi, pengelolaan template, ataupun
download DOCX.

Rujukan utama: [service naskah](../source/src/modules/manuscripts/services/manuscript.service.js)
dan [repository naskah](../source/src/modules/manuscripts/repositories/manuscript.repository.js).

## 6. Dua aset persisten

| Aset | Yang disimpan | Hal yang harus dibuktikan M3 |
| --- | --- | --- |
| PostgreSQL | Tenant, user, template, metadata naskah, hasil, dan findings | Database tujuan, schema, serta transaksi dapat dipakai |
| Filesystem | Byte file unggahan asli | Volume writable, file tetap tersedia, dan checksum cocok setelah penggantian pod |

Enam tabel pada [schema.sql](../source/schema.sql) adalah `tenants`, `users`,
`format_rule_templates`, `manuscripts`, `check_results`, dan `findings`. Relasi
utama adalah tenant -> naskah -> hasil pemeriksaan -> temuan, dengan user/author
dan template terkait tenant.

Lokasi fisik file adalah `path.resolve(process.cwd(), 'uploads')`:

- Dari `source/` melalui `npm start`: `source/uploads/`.
- Pada Dockerfile sekarang, `WORKDIR /app`: `/app/uploads/`.

Kolom `file_path` berisi `/uploads/<nama-file>`. Ini adalah nilai metadata, bukan
bukti adanya endpoint download. Judul yang disimpan berasal dari nama file.

Seed `ms-001` dan skor 85 adalah data SQL yang ditulis langsung, bukan hasil
parsing atau bukti bahwa `/uploads/ms-001.docx` tersedia. Pengujian M3 harus memakai
unggahan nyata dan memeriksa metadata serta file secara terpisah.

Penulisan file dan beberapa INSERT belum dibungkus transaksi/rollback bersama.
Kegagalan di tengah alur dapat meninggalkan file atau record parsial; hal ini
menjadi batas pengujian restart dan tindak lanjut ke pemilik M2.

## 7. Arti hasil pemeriksaan format

| Aturan | Cara pemeriksaan | Pengaruh skor |
| --- | --- | --- |
| Jumlah kata | Pecah teks berdasarkan whitespace; bandingkan dengan min/max template | Di bawah minimum -20; di atas maksimum -15 |
| Abstract | Regex `abstract`, case-insensitive, jika diwajibkan template | Tidak ditemukan -15 |
| Keywords | Regex `keyword` atau `kata kunci`, jika diwajibkan template | Tidak ditemukan -15 |

Skor dimulai dari 100 dan dibatasi ke 0-100. Findings menggunakan INFO atau WARNING.
Status `COMPLETED` berarti proses selesai, bukan berarti seluruh aturan lolos atau
naskah diterima jurnal. Nama template IEEE/ACM pada seed belum berarti layout
IEEE/ACM diperiksa.

Pemeriksaan belum mencakup margin, font, spasi, atau gaya sitasi. Pencarian substring
belum membuktikan adanya section abstrak/keywords yang benar. Jika Mammoth gagal,
fallback membaca buffer sebagai UTF-8; tidak ada file filter DOCX yang ketat pada
router. Validasi file dan konsistensi parsing adalah tindak lanjut aplikasi M2.

## 8. Identitas dan batas akses saat ini

[Auth controller](../source/src/modules/auth/controllers/auth.controller.js)
menerbitkan token mock untuk role author/editor/admin. Endpoint naskah tidak
memverifikasi Bearer token atau menegakkan perbedaan hak ketiga role. Tenant berasal
dari header klien, bukan klaim pengguna yang sudah diverifikasi.

Perbandingan tenant pada laporan adalah logika yang tersedia, tetapi belum
membuktikan identitas tenant yang terpercaya. `authorId` opsional berasal dari body;
pemeriksaan kepemilikan author dalam tenant belum terlihat pada service.

Keycloak, RBAC, dan isolasi tenant yang diikat pada identitas perlu diselaraskan
dengan pemilik aplikasi/keamanan. Menjalankan container Keycloak tidak otomatis
mengubah perilaku backend ini.

## 9. Keputusan platform yang masih terbuka

| Keputusan | Dasar yang sudah diketahui | Tahap tindak lanjut |
| --- | --- | --- |
| Versi image dan user | Node 22.23.5 dan UID/GID 10001 lulus pada Docker serta pod | Pertahankan versi dan traceability pada handoff |
| Jalur database | Readiness dan transaksi pod ke journalfit lulus; enam tabel tersedia | Tidak ada migrasi startup; reproduksi database baru perlu prosedur |
| Storage dan replica | File berada di working directory; manifest lama PVC lokal satu node | 4 dan 6: penempatan, sharing, serta persistensi |
| Resource dan request panjang | Upload maksimal 20 MiB ditampung di memory dan diproses dalam request | 2, 4, dan 5: penggunaan resource dan perilaku request |
| HPA/rollout | Belum ada handler shutdown/draining khusus pada entrypoint aplikasi | 4 dan 6: kepemilikan replica dan perilaku request saat pod berubah |
| Identitas/fitur konsep | Auth mock; AI, queue, histori revisi lengkap belum tersedia | Koordinasi pemilik M2/keamanan; bukan klaim selesai lewat deployment |
| Delivery | CI menghasilkan artifact; desired state dan rekonsiliasi milik jalur M4 | 7: serah terima versi image, manifest, config/Secret, dan sumber Git |

Kontrak source, hasil Docker, dan baseline Kubernetes menjadi dasar handoff M4.
Cakupan serta keterbatasan dicatat pada [indeks aktif](../evidence/platform/README.md).

## 10. Hasil pemeriksaan lingkungan Tahap 3

[Audit terstruktur](../evidence/platform/tahap-3/README.md) pada 2026-11-17
mengonfirmasi PostgreSQL 17.11/journalfit/public, enam tabel dan kolom wajib,
koneksi dari pod melalui host.docker.internal, registry/digest yang sesuai build,
dua node Ready, serta storage local-path Bound.

Lingkungan siap untuk review manifest Tahap 4. Tiga tindak lanjut tetap dicatat:
Gitea masih Installation untuk delivery M4, endpoint metrik aplikasi belum ada
untuk M5, dan role database lab masih superuser untuk review least-privilege M6.
Temuan tersebut tidak dianggap sudah selesai hanya karena aplikasi dapat diakses.

## 11. Hasil review manifest Tahap 4

[Review formal](../evidence/platform/tahap-4/README.md) lulus 26 check pada
2026-11-17: enam resource valid, diff desired/live exit 0, environment kedua pod
cocok dengan ConfigMap, Secret reference tersedia, serta Service/Ingress dan
volume berfungsi sesuai kontrak.

HPA menjadi pemilik replica; perubahan ConfigMap memerlukan pembaruan pod yang
terkontrol. Storage tetap satu node dengan reclaim policy Delete dan mode folder
2777, sehingga hardening serta backup/HA belum dianggap selesai. Resource masih
baseline. Tag artifact manual dan konvensi SHA7 updater perlu diselaraskan saat
handoff M4. Berikutnya adalah uji transaksi formal Tahap 5.

## 12. Hasil transaksi formal Tahap 5

[Pengujian 2026-11-18](../evidence/platform/tahap-5/README.md) membuktikan DOCX
3500/100/8500 kata menghasilkan skor 100/50/85, dan tenant kedua menghasilkan 100.
Metadata/result/findings cocok dengan PostgreSQL dan byte file cocok di kedua pod.
Header tenant/file yang hilang serta ID yang tidak ada memberi status sesuai.

Input TXT masih diterima 201, sedangkan file 20 MiB+1 ditolak sebagai 500 dengan
LIMIT_FILE_SIZE. File oversized tidak tersimpan. Status pengujian needs_attention
dipertahankan dan [handoff M2](../automation/handoff/STAGE5_APPLICATION_FINDINGS.md)
menjadi tindak lanjut aplikasi. 403 tenant mismatch tetap hanya membuktikan logika
header, bukan identitas tenant yang terautentikasi.

## 13. Persistensi dan rollout Tahap 6

[Pengujian 2026-11-21](../evidence/platform/tahap-6/README.md) menghapus satu pod
dan menjalankan rolling update. Pengganti Ready dalam 13,23 detik, seluruh UID pod
berganti, dan laporan, record PostgreSQL, serta byte file tetap sama. Selama
rollout, 94/94 probe readiness dan 23/23 probe report mendapat HTTP 200; pod baru
tidak restart dan PVC tetap Bound.

Data demo 17 November juga masih terbaca setelah lab berhenti 18 November dan
menyala 21 November. Ini observasi tambahan, bukan backup/restore atau uji node
failure. PVC RWO pada satu node tetap menjadi batas yang dicatat.

## Riwayat integrasi 2026-11-09 sampai 2026-11-10

Bagian berikut dipertahankan untuk menelusuri keputusan terdahulu. Seluruh
pernyataan keberhasilan, kotak centang, ungkapan "saat ini", versi runtime, dan
status branch di dalamnya mengacu pada catatan lama, **belum diverifikasi ulang**.
Rekaman terkait telah dipindahkan ke
[arsip platform](../evidence/_archive/platform-unverified-2026-11-17/ARCHIVE_STATUS.md).
Bagian ini bukan status aktif atau instruksi untuk langsung menerapkan konfigurasi.

<details>
<summary>Buka catatan integrasi lama yang belum diverifikasi ulang</summary>

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
| Runtime/source | Source terbaru node:22-alpine (kandidat diuji); artifact cluster3bdf305 masih Node 24. |
| Build context | `source/` dari root repository |
| Instalasi runtime | `npm ci --omit=dev`, menggunakan package-lock.json |
| Entrypoint | `node src/index.js` |
| Working directory | `/app` |
| User dan group | Manifest UID/GID10001; source Dockerfile terbaru USER node/UID 1000, kandidat override10001 dengan mount sementara diuji. |
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
| `DB_HOST` | `host.docker.internal`, rute Docker Desktop Windows yang diuji setelah restart | ConfigMap |
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
Pada pengujian awal D, koneksi memakai host.k3d.internal. Setelah restart Docker
pada 2026-11-10, alias itu hilang dari resolusi DNS pod dan readiness menjadi 503
ENOTFOUND. Rute host.docker.internal terbukti bisa TCP dan autentikasi SELECT ke
journalfit, sehingga baseline ConfigMap diperbarui untuk lingkungan Windows ini.
Perubahan ConfigMap envFrom memerlukan refresh pod agar environment diperbarui.
Bukti lama: [readiness-dns-recovery-20261110.txt](../evidence/_archive/platform-unverified-2026-11-17/readiness-dns-recovery-20261110.txt).

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
audit ini. Bukti lama: [integration-audit.txt](../evidence/_archive/platform-unverified-2026-11-17/integration-audit.txt).

**Pembaruan integrasi 2026-11-10:** setelah pengguna mengizinkan kelanjutan D.0,
database journalfit dibuat dan `source/schema.sql` diterapkan tanpa perubahan,
dalam satu transaksi. Enam tabel dan seed terverifikasi. Hash file SQL tetap sama.
Audit awal di atas tetap berlaku sebagai catatan historis, bukan status terbaru.
Bukti lama: [database-initialization.txt](../evidence/_archive/platform-unverified-2026-11-17/database-initialization.txt).

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
Uji diagnostik menunjukkan 10 tes lulus pada Node 20 dengan path eksplisit
`node --test tests/app.test.js`. Namun perintah npm test saat ini memakai pola
`tests/**/*.test.js` yang tidak ditemukan oleh Node 20 dalam lingkungan uji.

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
Node 22 sesuai source Dockerfile terbaru agar npm test berjalan tanpa mengubah backend/package.json, serta
build/publish strict. Helper pembaruan tag menyiapkan diff setelah memverifikasi
image terpublikasi, tanpa commit/push otomatis. Handoff lengkap dan gate publikasi
ada pada automation/handoff/D8_INTEGRATION.md.

Bukti lama: [member3-alignment.txt](../evidence/_archive/platform-unverified-2026-11-17/member3-alignment.txt) dan
[member3-node20-compatibility.txt](../evidence/_archive/platform-unverified-2026-11-17/member3-node20-compatibility.txt). Kegagalan salin metadata direktori awal dan kegagalan
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
- [ ] Anggota 1/3 menindaklanjuti perintah npm test Node 20, desired-state update dan
  rollback sebelum aktivasi serta pembuktian delivery Argo CD.

Jika ada pembaruan anggota lain, bandingkan kode dan konfigurasi dengan baseline
ini, catat keputusan yang berubah dan alasannya, lalu perbarui kontrak, manifest
serta roadmap pada feature branch. Ulangi hanya pengujian yang terdampak. Jangan
menimpa pekerjaan anggota lain, memasang dua sumber rekonsiliasi, atau menghapus data
untuk menyesuaikan baseline. Penetapan sementara ini tidak mengotorisasi perubahan
backend, penerapan skema atau pipeline anggota lain.

## Review F 2026-11-10

Update remote feature branch 2bd8428 membawa Dockerfile Node 22 Alpine dan dumb-init
dari commit 3ffb92f. Source kelompok dipertahankan; build, 10 tes dan health kandidat
diuji, termasuk UID 10001 dengan mount sementara. Image tersebut belum dipromosikan
ke cluster; evidence Kubernetes tetap artifact 3bdf305 Node 24.

Anggota 3 commit 5b63bc1 sudah menambahkan aturan HPA ignore. Prefix YAML invalid
pada versi itu diperbaiki melalui a9d5993 dan masuk origin/main 280a866; parser
YAML main lulus saat fetch akhir. Main juga memperbaiki tes menjadi node --test.
Perubahan main terbaru direview read-only, belum digabung ke feature branch ini.
Branch Anggota 4 menyediakan rekaman tenant/restore yang dibaca sebagai evidence
anggota terkait, bukan hasil uji ulang Anggota 2. Detail lama:
[final-integration-review-20261110.txt](../evidence/_archive/platform-unverified-2026-11-17/final-integration-review-20261110.txt).

</details>
