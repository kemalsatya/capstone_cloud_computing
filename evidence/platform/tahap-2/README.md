# Tahap 2: image dan runtime Docker

**Status: build dan pengujian Docker lulus pada 2026-11-17.** Hasil ini berlaku
untuk skenario di bawah, bukan klaim bahwa deployment Kubernetes sudah selesai.

**Tindak lanjut:** image ini kemudian dipublikasikan dan diuji di Kubernetes.
Hasil baru ada pada [verifikasi langsung M3](../m3-live-20261117/README.md).
Pernyataan status dan keterbatasan di bawah tetap mengacu pada waktu Tahap 2.

## Scope dan owner

- Scope: build image produksi, identitas proses, filesystem, source test aplikasi,
  health dengan koneksi database positif/negatif, dan marker pada volume Docker.
- Pelaksana: agen coding atas instruksi pemilik M3; penjelasan dan command menjadi
  bahan belajar pemilik M3 melalui [panduan utama](../../../deployment/PANDUAN_M3.md).

## Source/version

| Bagian | Nilai yang direkam |
| --- | --- |
| Baseline kode M2 | `d9ab35a10eab8e9c67e45bc53f8a22522846b038` |
| Perubahan packaging lokal | `source/Dockerfile` dan `source/.dockerignore` |
| SHA-256 Dockerfile | `8b864229d838a099feee1c6df3635e46687498b86c88ac34e6f17b9207756b99` |
| SHA-256 .dockerignore | `2311981b0aba63d4cbd569367dcab056cbdcc331d1fc54f842dd02d198e9c498` |
| Script pemeriksaan | `automation/scripts/test-stage2-container.ps1` |
| SHA-256 script | `c684009689b9c5a8b154914cdaaa5256f4b4785aec26184b00a1a84414d694e9` |
| Base image | `node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a` |
| Image utama | `journalfit-backend:stage2-20261117t055120z-d9ab35a` |
| Image ID/OCI index utama | `sha256:9aa3893aa1a763fb818af769e98db305c4afcbd34e5685231e571783e4d91557` |
| Runtime teramati | Node `v22.23.5`, UID/GID `10001:10001`, working directory `/app`, PID 1 `dumb-init` |
| Lingkungan | Windows/PowerShell 5.1, Docker Desktop 4.89.0, Engine 29.7.2, Linux/amd64 |

Label `source.revision-state=working-tree` dan checksum packaging membedakan image
ini dari artifact murni commit baseline. Perubahan lokal belum menjadi commit baru.
Image utama masih lokal; metadata ini tidak menyatakan image telah dipush ke
registry atau dipakai cluster.

## Timestamp dan method

- Build utama dimulai dengan label waktu `2026-11-17T12:51:20.8057250+07:00`.
- Pemeriksaan container: `2026-11-17T12:52:17.1078986+07:00` sampai
  `2026-11-17T12:52:47.6604909+07:00`.
- Perbandingan build ulang: `2026-11-17T12:54:48.4163456+07:00`.
- Build context: `source/`; dependency dipasang melalui `npm ci --omit=dev`.
- Source test dimount read-only pada container dengan network `none`.
- Probe HTTP memakai container unik dan port acak pada `127.0.0.1`. Database positif
  adalah `journalfit` pada `capstone-postgres` melalui `capstone-net`; operasi
  database hanya `SELECT 1`.
- Skenario negatif memakai nama database acak yang tidak tersedia. Database itu
  tidak dibuat atau dihapus.
- Password dibaca dari konfigurasi container PostgreSQL di memory, diteruskan
  melalui environment proses, dan tidak dicetak/disimpan dalam hasil pemeriksaan.
- Container/volume probe dibuat khusus untuk run ini dan dibersihkan sesudahnya.

## Observation dan evidence mentah

| Pemeriksaan | Hasil aktual | Evidence |
| --- | --- | --- |
| Build utama | Exit 0; base digest dan label tercatat | [build-metadata.json](build-metadata.json) |
| Build ulang berbantuan cache | Exit 0; layer root filesystem dan konfigurasi runtime sama | [rebuild-metadata.json](rebuild-metadata.json) |
| User dan working directory | UID/GID 10001, `/app` | [results.json](run-20261117T055216Z-33df42db/results.json) |
| Filesystem produksi | Uploads writable; package manifest tidak writable oleh user aplikasi; .env, .env.example, schema, tests, dan nodemon tidak ada | [results.json](run-20261117T055216Z-33df42db/results.json) |
| Dependency produksi | dotenv 18.0.10, Express 5.3.0, Mammoth 1.13.0, Multer 2.5.0, pg 8.23.1 | [dependencies.json](run-20261117T055216Z-33df42db/dependencies.json) |
| Test aplikasi | 10 pass, 0 fail, exit 0; termasuk satu teardown | [application-tests.tap](run-20261117T055216Z-33df42db/application-tests.tap) |
| Database valid | Root 200, live 200, ready 200 | [results.json](run-20261117T055216Z-33df42db/results.json), [log positif](run-20261117T055216Z-33df42db/runtime-positive.log) |
| Database tujuan tidak tersedia | Live tetap 200, ready 503 | [results.json](run-20261117T055216Z-33df42db/results.json), [log negatif](run-20261117T055216Z-33df42db/runtime-negative.log) |
| Volume Docker | Marker ditulis sebagai UID 10001 dan terbaca dari container baru setelah container pertama dihapus | [results.json](run-20261117T055216Z-33df42db/results.json) |
| Cleanup | Dua container probe dan volume sementara sudah tidak tersisa | Field cleanup pada [results.json](run-20261117T055216Z-33df42db/results.json) |

## Interpretation

- Identitas image sekarang sesuai secara numerik dengan UID/GID pada manifest.
  User aplikasi dapat menulis direktori upload, tanpa memiliki package manifest.
- Image menjalankan kode dan source test yang tersedia pada Node 22. Sepuluh test
  tersebut tetap memiliki batas mock yang dijelaskan di Tahap 1.
- Skenario database negatif membuktikan perbedaan liveness dan readiness dalam
  kondisi database tujuan tidak tersedia.
- Named volume mempertahankan marker di luar umur container. Ini mendukung
  pemahaman storage, tetapi bukan pengujian DOCX/PVC Kubernetes.

Build ulang memakai tag
`journalfit-backend:stage2-20261117t055120z-d9ab35a-rebuild`, dengan image ID/OCI index
`sha256:1586556413f1f9f1b05a482bbfe2c09937e9a63f0ed0fa61285f3e13aa767f0b`.
Konfigurasi runtime dan layer rootfs sama, sedangkan OCI index berbeda karena
attestation/provenance build berubah. Ini adalah pengujian build ulang berbantuan
cache, bukan jaminan seluruh build bersih menghasilkan byte identik.

## Limitation

- Belum push/pull melalui registry, deploy Kubernetes, atau menguji PVC, Ingress,
  HPA, rollout pod, maupun laptop/arsitektur lain.
- Query readiness tidak memeriksa enam tabel. Tidak ada upload DOCX nyata atau
  perubahan data bisnis pada pemeriksaan ini.
- Marker volume berupa teks uji, bukan naskah dan bukan bukti backup/restore.
- Tidak menguji beban upload maksimal atau requests/limits Kubernetes.
- PID 1 dumb-init tidak membuktikan aplikasi melakukan request draining; source
  belum memiliki handler shutdown khusus.
- Base image dipin dan dependency memakai lockfile; paket APK saat build tetap
  bergantung repository. Build bersih/offline belum diuji.
- Bukti ini tidak menggantikan scan keamanan, RBAC, atau isolasi identitas tenant.

## Decision supported

1. Gunakan Dockerfile baru sebagai kandidat packaging untuk platform.
2. Pertahankan UID/GID 10001 dan mount upload yang sesuai, lalu uji izin PVC pada
   tahap Kubernetes.
3. Lanjutkan Tahap 3 untuk inventarisasi lengkap infrastruktur, database/schema,
   registry, dan jalur jaringan cluster sebelum mengubah manifest atau promosi image.
4. Pertahankan artifact lama dan rekam artifact baru dengan tag/digest berbeda;
   hasil ini tidak melabeli ulang evidence yang telah diarsipkan.

## Verifikasi dokumentasi dan artifact

- Tujuh blok PowerShell pada panduan lolos pemeriksaan sintaks; blok baseline M2
  yang cakupannya diperbarui juga dijalankan dan lulus.
- Pemeriksaan 85 tautan lokal pada sepuluh dokumen aktif tidak menemukan target
  yang hilang. Tautan historis dalam arsip asli tidak termasuk cakupan.
- ID image, digest pada metadata build, dan hasil runtime cocok. Hash Dockerfile,
  .dockerignore, serta script sesuai dengan file yang menghasilkan evidence.
- TAP mencatat 10 pass/0 fail; hasil JSON menyatakan probe dan cleanup berhasil.
- `git diff --check` menghasilkan exit code 0.
