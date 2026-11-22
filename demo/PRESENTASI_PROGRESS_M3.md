# Presentasi progress M3 JournalFit

**Durasi utama:** sekitar 5 menit. Materi mengacu pada evidence Tahap 2–7:
image, dua pod Ready, Service/Ingress, PVC, transaksi DOCX, dan persistensi setelah
penggantian pod dan rolling restart.

Sebelum presentasi, buka Docker Desktop dan pastikan lab sudah aktif. Jalankan
ini dari root repo untuk rehearsal atau saat menampilkan upload baru:

```powershell
.\start-presentasi.ps1 -UploadFixture
```

Tunjukkan `[M3 SIAP]`, Deployment/PVC, readiness 200, upload 201 dan report 200
untuk ID yang sama. Fixture sintetis tersedia di repo dan memberi skor 100.
Tanpa `-UploadFixture`, starter membaca laporan demo lama. Mode upload menambah
satu naskah QA per run. Jika lab tidak tersedia saat presentasi, gunakan
[rekaman Tahap 7](../evidence/platform/tahap-7/README.md) dan sebutkan bahwa itu
hasil rehearsal tersimpan. Langkah detail ada di [panduan utama](../deployment/PANDUAN_M3.md#demo-langsung-m3).

## Pesan utama

> Saya sudah menjalankan backend JournalFit pada Kubernetes lokal. Image dapat
> dibangun ulang, dua pod siap melayani, aplikasi dapat diakses melalui Ingress,
> dan transaksi DOCX menghasilkan laporan. File serta laporan tetap tersedia
> setelah satu pod diganti. Hasilnya direkam sebagai evidence baru.

## Susunan presentasi 5 menit

### 1. Tanggung jawab dan kondisi awal — 45 detik

> Saya menangani platform pada milestone M3. Aplikasi dari M2 menggunakan Node.js,
> Express, dan PostgreSQL untuk memeriksa naskah DOCX. Agar platform sesuai dengan
> aplikasinya, saya terlebih dahulu menelusuri cara aplikasi dijalankan, konfigurasi,
> endpoint health, dan tempat penyimpanan datanya.
>
> Saya juga memisahkan evidence lama ke arsip belum terverifikasi. Dengan begitu,
> progress yang saya sampaikan mengacu pada pemeriksaan dan pengujian baru.

Tunjukkan [kontrak integrasi](../deployment/INTEGRATION_CONTRACT.md) atau
[roadmap M3](../deployment/PANDUAN_M3.md).

### 2. Kebutuhan aplikasi yang ditemukan — 45 detik

> Backend berjalan pada port 8000. PostgreSQL menyimpan metadata naskah, aturan,
> skor, dan temuan pemeriksaan. File DOCX aslinya disimpan terpisah di direktori
> upload. Artinya, platform harus menyediakan koneksi database dan penyimpanan
> file yang dapat ditulis serta dipertahankan saat container diganti.
>
> Pada implementasi sekarang, pemeriksaan berlangsung dalam satu request. AI dan
> background worker belum menjadi dependency source backend ini.

### 3. Perbaikan Dockerfile — 60 detik

> Saya menggunakan Node 22 dengan base image yang dipin menggunakan digest,
> sehingga snapshot yang digunakan dapat ditelusuri. Dependency dipasang dari
> package-lock.json melalui npm ci, dan dependency development tidak disertakan.
>
> Salah satu masalah yang ditemukan adalah user node pada base image memakai
> UID 1000, sedangkan manifest Kubernetes menetapkan 10001. Saya menyelaraskan
> image ke UID/GID 10001 dan memberi hak tulis pada direktori upload. Runtime
> yang diuji adalah Node 22.23.5.

Tunjukkan [Dockerfile](../source/Dockerfile). Fokus pada FROM, WORKDIR,
instalasi dependency, pembuatan user, direktori uploads, USER, dan CMD.

### 4. Hasil pengujian dan demo — 90 detik

> Build utama dan build ulang berbantuan cache berhasil. Sepuluh test aplikasi
> lulus, termasuk satu teardown. User proses terverifikasi non-root dengan UID/GID
> 10001, dan direktori upload dapat ditulis.
>
> Image kemudian dipublikasikan ke registry dan dijalankan pada cluster k3d.
> Kedua node Ready, deployment memiliki dua pod Ready, Service/Ingress tersedia,
> dan PVC Bound. Liveness serta readiness melalui Ingress memberikan HTTP 200.
>
> Upload DOCX menghasilkan HTTP 201 dan laporan HTTP 200. Pada Tahap 6, pod
> pengganti Ready dalam 13,23 detik dan rolling restart selesai dalam 22,44 detik.
> Database dan checksum file tidak berubah; seluruh 117 request uji saat rollout
> mendapat HTTP 200 pada skenario itu.

Jalankan bagian **Demo langsung M3** pada
[panduan command utama](../deployment/PANDUAN_M3.md#demo-langsung-m3).
Tunjukkan node/pod/PVC, buka http://journalfit.localhost:8088/, lalu ambil laporan
demo melalui API. File JSON adalah rekaman pengujian; request curl adalah akses baru.

### 5. Status dan rencana berikutnya — 40 detik

> Kesimpulan saya: baseline deployment M3 sudah memiliki bukti baru, dari build
> sampai aplikasi berjalan dan menyimpan data/file di Kubernetes lokal.
>
> Paket handoff M4 dan panduan setup laptop sudah tersedia. Uji laptop kedua dan
> penerimaan M4 masih terbuka. Dua replica berbagi satu node storage, sehingga
> hasil ini belum membuktikan high availability lintas node.

## Jika waktu hanya 1 menit

> Saya menangani platform M3. Backend sudah dikemas menggunakan Node 22 dan user
> non-root 10001, dengan sepuluh test lulus. Image dipublikasikan ke registry dan
> berjalan pada dua pod Ready di Kubernetes. Service/Ingress dan PVC tersedia;
> upload DOCX menghasilkan HTTP 201 dan laporan HTTP 200. Setelah satu pod diganti,
> checksum file tetap sama dan laporan tetap dapat diambil. Jadi baseline deployment
> M3 sudah dibuktikan secara lokal. Selanjutnya adalah penyelarasan CI/CD M4 dan
> pengujian lanjutan sesuai keterbatasan yang dicatat.

## File yang disiapkan sebelum presentasi

1. [Dockerfile](../source/Dockerfile): implementasi packaging.
2. [Ringkasan evidence langsung](../evidence/platform/m3-live-20261117/README.md): workload, transaksi, persistensi, dan batasnya.
3. [Hasil JSON](../evidence/platform/m3-live-20261117/run-20261117T063803Z/results.json): transaksi, checksum, pod replacement, dan timestamp.
4. [Log test](../evidence/platform/tahap-2/run-20261117T055216Z-33df42db/application-tests.tap): 10 pass dan 0 fail.
5. [Panduan utama](../deployment/PANDUAN_M3.md): command demo dan roadmap.
6. [Tahap 6](../evidence/platform/tahap-6/README.md) dan [Tahap 7](../evidence/platform/tahap-7/README.md): hasil rollout terukur dan rehearsal.

## Jawaban singkat untuk pertanyaan dosen

| Pertanyaan | Jawaban yang dapat dijelaskan |
| --- | --- |
| Apa bedanya image dan container? | Image adalah paket aplikasi/runtime; container adalah proses yang berjalan dari paket itu. |
| Mengapa memakai non-root? | Proses aplikasi tidak memerlukan hak root. Hak tulis diberikan pada direktori upload yang dibutuhkannya. |
| Mengapa UID 10001? | Agar identitas image sesuai dengan angka pada manifest. Izin PVC tetap harus diuji di Kubernetes. |
| Apa fungsi digest? | Mengidentifikasi snapshot image secara spesifik; tag seperti node:22-alpine dapat berpindah ke snapshot lain. |
| Apa bedanya liveness dan readiness? | Liveness memeriksa proses HTTP; readiness backend ini memeriksa query SELECT 1 ke database. |
| Apakah readiness 200 membuktikan upload berfungsi? | Belum. Schema, izin file, dan transaksi upload perlu diuji terpisah. |
| Apakah 10 test itu end-to-end? | Suite yang ada mencakup evaluator, logika laporan yang distub, endpoint mock, dan satu teardown. Upload DOCX nyata belum diuji pada Tahap 2. |
| Apakah Kubernetes sudah selesai? | Baseline manual lokal M3 sudah diuji. CI/CD end-to-end dan pengujian lanjutan tetap milestone tersendiri. |
| Apa bukti data bertahan? | Checksum DOCX sama pada kedua pod dan laporan tetap 200 setelah satu pod diganti. Backup/restore serta node failure belum diuji. |
| Mengapa ada demo dengan skor 50 dan 100? | Laporan lama memakai panduan DOCX yang menghasilkan tiga warning. Fixture sintetis 3.500 kata memenuhi tiga aturan MVP, sehingga skornya 100. Kedua upload berhasil. |
| Kenapa evidence lama diarsipkan? | Agar hasil lama terpisah dari kondisi dan versi yang diuji ulang, sehingga progress dapat ditelusuri. |
| Apakah bisa di laptop lain? | [Panduan setup Windows](../deployment/SETUP_LAPTOP_M3.md) tersedia. Smoke sudah berjalan di lab ini; setup dan smoke dari kosong di laptop kedua belum dilakukan. |

## Tiga target progress berikutnya

1. Serah terima image/manifest ke pemilik CI/CD dan bukti delivery M4.
2. Reproduksi lingkungan baru dan pematangan dokumentasi operasional.
3. Pengujian security, observability, backup/restore, dan kapasitas sesuai milestone.
