# Tahap 1: penelusuran kontrak aplikasi M2

## Scope dan owner

- **Scope:** perilaku aplikasi yang tertulis pada source M2 dan implikasinya untuk
  container/Kubernetes M3.
- **Pelaksana:** agen coding atas instruksi pemilik pekerjaan M3. Dokumen ini
  menjadi bahan belajar dan review pemilik M3; tidak menyatakan bahwa pemahaman
  individu sudah diuji.
- **Jenis pemeriksaan:** pembacaan source dan pemeriksaan Git, bukan eksekusi
  aplikasi atau pengujian infrastruktur.

## Source/version dan timestamp

- Branch: `feat/k8s-manifests`.
- HEAD: `d9ab35a10eab8e9c67e45bc53f8a22522846b038`.
- Timestamp pemeriksaan source terhadap HEAD:
  `2026-11-17T12:21:27.6218456+07:00`.
- `git diff --exit-code HEAD -- source` menghasilkan **exit code 0**, tanpa output
  diff. Source tracked pada saat pemeriksaan sesuai dengan HEAD tersebut.
- Workspace memiliki perubahan dokumentasi dan pengarsipan Tahap 0. Versi source
  di atas tidak berarti seluruh workspace bersih atau perubahan sudah di-commit.

## Method

1. Membaca package scripts, entrypoint, factory Express, konfigurasi environment,
   dan konfigurasi `pg.Pool`.
2. Mengikuti router -> controller -> service -> repository untuk upload dan laporan.
3. Membaca schema, seed, health, auth mock, middleware tenant/error, serta source test.
4. Mencocokkan working directory dan file yang disalin Dockerfile dengan lokasi
   penyimpanan yang dipakai service; belum menjalankan build.
5. Memeriksa identitas revision dan perubahan pada `source/` melalui Git.

Command pemeriksaan revision tersedia di bagian Tahap 1 pada
[panduan utama](../../deployment/PANDUAN_M3.md). Rincian kontrak hasil penelusuran
ada di [INTEGRATION_CONTRACT.md](../../deployment/INTEGRATION_CONTRACT.md).

## Observation

| Temuan source | Rujukan dan baris saat pemeriksaan |
| --- | --- |
| Satu proses Express/ES modules; start melalui `node src/index.js` | `source/package.json:6-20`, `source/src/index.js:1-10` |
| Port dan lima parameter database dibaca dari environment; ada fallback lokal | `source/src/config/env.js:1-10`, `source/src/config/database.js:6-15` |
| Listener tidak menunggu migrasi atau pemeriksaan database | `source/src/index.js:4-10` |
| Liveness 200 tanpa query; readiness memakai `SELECT 1`, lalu 200/503 | `source/src/modules/health/controllers/health.controller.js:3-27` |
| Upload memerlukan header tenant dan multipart field file, maksimum 20 MiB di memory | `source/src/modules/manuscripts/index.js:7-18`, `source/src/common/middlewares/tenant.js:9-19` |
| Tenant/template dapat dibuat otomatis; file ditulis, diekstrak, dievaluasi, lalu hasil disimpan dalam request yang sama | `source/src/modules/manuscripts/services/manuscript.service.js:97-152`, `source/src/modules/manuscripts/repositories/manuscript.repository.js:4-42` |
| Aturan hanya jumlah kata, substring abstract, dan substring keyword/kata kunci | `source/src/modules/manuscripts/services/manuscript.service.js:19-94` |
| File berada di working directory/uploads; metadata dan hasil berada di enam tabel PostgreSQL | `source/src/modules/manuscripts/services/manuscript.service.js:106-146`, `source/schema.sql:6-62` |
| Report membaca hasil terbaru, lalu membandingkan tenant; 403/404 tersedia sebagai cabang logika | `source/src/modules/manuscripts/repositories/manuscript.repository.js:85-119`, `source/src/modules/manuscripts/services/manuscript.service.js:155-173` |
| Token masih mock; router naskah tidak memasang verifikasi token/RBAC | `source/src/modules/auth/controllers/auth.controller.js:4-38`, `source/src/modules/manuscripts/index.js:14-18` |
| SQL seed menulis manuscript dan skor secara langsung | `source/schema.sql:87-101` |
| Source suite berisi 10 test, termasuk satu teardown; repository laporan distub | `source/tests/app.test.js:7-154` |
| Dockerfile menyalin package files dan src, dengan working directory /app | `source/Dockerfile:12-30`, `source/.dockerignore:1-16` |

Pembacaan dependency dan alur route/service tidak menemukan implementasi frontend,
AI, broker queue/worker, metrics endpoint, atau workflow histori revisi lengkap.
Ini adalah batas source yang diperiksa, bukan keputusan menghapus fitur konsep.

## Interpretation

- Baseline M3 adalah satu backend API, PostgreSQL eksternal, dan direktori upload
  yang writable/persisten. Broker, worker, dan API AI belum menjadi dependency
  runtime source ini.
- HTTP readiness 200 hanya mendukung kesimpulan query database berhasil. Schema,
  transaksi, dan file upload tetap membutuhkan pemeriksaan terpisah.
- Penggantian pod perlu memeriksa dua aset: data PostgreSQL dan byte DOCX.
- Status COMPLETED berarti alur selesai; skor/findings dapat tetap berisi warning.
- Logika tenant header tidak sama dengan identitas tenant yang sudah diverifikasi.

## Limitation

- Aplikasi, test, database, container, dan Kubernetes tidak dijalankan pada tahap
  penelusuran ini. Tidak ada klaim baru bahwa upload, report, probes, atau isolasi
  sudah lulus dalam runtime.
- Sepuluh test yang tercantum adalah source test, bukan hasil test baru. Suite
  tersebut juga tidak menguji upload DOCX/database nyata secara lengkap.
- Fallback UTF-8 ketika parser gagal, belum adanya file filter ketat, dan operasi
  file/INSERT tanpa transaksi bersama masih perlu tindak lanjut aplikasi.
- Versi image aktual, UID proses, hak tulis volume, jaringan database, penggunaan
  resource, shutdown, dan portabilitas belum dibuktikan.
- Bukti lama yang diarsipkan tidak dipakai untuk menetapkan hasil pemeriksaan ini.

## Decision supported

1. Gunakan kontrak source saat ini untuk meninjau Dockerfile pada Tahap 2.
2. Pertahankan kebutuhan database dan file storage sebagai dua pemeriksaan berbeda.
3. Pasok konfigurasi runtime secara eksplisit dan uji readiness serta transaksi
   secara terpisah.
4. Tinjau ketidaksesuaian USER node dengan UID/GID manifest, pemilihan host database,
   penempatan PVC/replica, dan resource pada tahap platform terkait.
5. Koordinasikan kekurangan auth/fitur dan konsistensi data dengan pemilik M2;
   deployment tidak dijadikan pengganti penyelesaian fungsi tersebut.

## Verifikasi pendamping dokumentasi

- Blok PowerShell Tahap 1 pada panduan dijalankan langsung dari isi dokumen pada
  `2026-11-17T12:29:11.083642+07:00`, exit code 0.
- Source dibandingkan dengan revision yang ditelusuri, bukan hanya HEAD terbaru;
  tidak ditemukan source untracked non-ignored.
- Output aktual:

  ```text
  PASS: source sesuai baseline d9ab35a10eab8e9c67e45bc53f8a22522846b038; HEAD saat ini d9ab35a10eab8e9c67e45bc53f8a22522846b038; tidak ada source untracked non-ignored.
  ```

- Pemeriksaan 65 tautan lokal pada sembilan dokumen aktif tidak menemukan target
  yang hilang. Tautan di dalam file arsip asli tidak termasuk cakupan.
- `git diff --check` menghasilkan exit code 0.

Pemeriksaan pendamping ini memvalidasi metadata dan konsistensi dokumen. Hasilnya
tidak mengubah batas pemeriksaan source menjadi klaim bahwa runtime telah lulus.

## Catatan tindak lanjut Tahap 2

Dockerfile dan .dockerignore kemudian diubah untuk packaging container. Hasil
diff serta output di atas tetap merupakan rekaman sebelum perubahan tersebut.
Command pada panduan kini membatasi pemeriksaan baseline ke kode/config aplikasi,
package files, schema, dan tests M2; packaging diperiksa melalui metadata build.
Hasil runtime yang baru ada pada [evidence Tahap 2](tahap-2/README.md).
